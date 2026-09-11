import { ArrowRight, Plus, X } from 'lucide-react'
import { useMemo } from 'react'
import { InputSection } from './InputSection.jsx'
import { SearchableCombobox } from './form/SearchableCombobox.jsx'
import {
  COMORBIDITY_SUGGESTIONS,
  COPY_NUMBER_OPTIONS,
  CREATININE_UNITS,
  CYP2D6_ALLELE_OPTIONS,
  LIVER_TEST_SUGGESTIONS,
  LIVER_TEST_UNITS,
  MEDICATION_SUGGESTIONS,
  OPIOID_OPTIONS,
  PAIN_SCORE_MAX,
  PAIN_SCORE_MIN,
  PREVIOUS_RESPONSE_OPTIONS,
  ROUTE_OPTIONS,
  SCD_GENOTYPE_OPTIONS,
  SEX_OPTIONS,
  VITAL_SIGN_SUGGESTIONS,
  VITAL_SIGN_UNITS,
} from '../data/clinicalLists.js'
import { deriveMedicationFlags } from '../data/derivedFlags.js'
import { createRowId } from '../data/formState.js'

function Field({
  label,
  htmlFor,
  error,
  hint,
  requirement,
  unit,
  emphasized = false,
  className = '',
  children,
}) {
  return (
    <div className={`field${emphasized ? ' field--emphasis' : ''} ${className}`.trim()}>
      <label className="field-label" htmlFor={htmlFor}>
        <span>{label}</span>
        {requirement && (
          <span className={`req-badge req-badge--${requirement}`}>
            {requirement === 'required'
              ? 'Required'
              : requirement === 'optional'
                ? 'Optional'
                : 'Conditional'}
          </span>
        )}
        {unit && <span className="field-unit">{unit}</span>}
      </label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}

function RadioYesNo({ name, value, onChange }) {
  return (
    <div className="radio-row" role="group">
      {['Yes', 'No'].map((option) => (
        <label key={option} className={`radio-opt${value === option ? ' is-on' : ''}`}>
          <input
            type="radio"
            name={name}
            checked={value === option}
            onChange={() => onChange(name, option)}
          />
          <span className="radio-dot" />
          {option}
        </label>
      ))}
    </div>
  )
}

function updateRow(rows, id, patch) {
  return rows.map((row) => (row.id === id ? { ...row, ...patch } : row))
}

export function PatientAssessment({
  form,
  errors,
  progress,
  loading,
  onChange,
  onClear,
  onSubmit,
}) {
  const vitalSigns = form.vitalSigns ?? []
  const liverTests = form.liverTests ?? []
  const medications = form.medications ?? []
  const baselineOpioids = form.baselineOpioids ?? []
  const previousResponses = form.previousResponses ?? []
  const allergies = form.allergies ?? []
  const comorbidities = form.comorbidities ?? []
  const flags = useMemo(() => deriveMedicationFlags(medications), [medications])

  const addVital = () => {
    onChange('vitalSigns', [
      ...vitalSigns,
      { id: createRowId('vital'), name: '', value: '', unit: '' },
    ])
  }

  const addLiverTest = () => {
    onChange('liverTests', [
      ...liverTests,
      { id: createRowId('lft'), name: '', value: '', unit: 'U/L' },
    ])
  }

  const addBaselineOpioid = () => {
    onChange('baselineOpioids', [
      ...baselineOpioids,
      { id: createRowId('base'), drug: '', dose: '', route: '' },
    ])
  }

  const addPreviousResponse = () => {
    onChange('previousResponses', [
      ...previousResponses,
      { id: createRowId('prev'), opioid: '', response: '' },
    ])
  }

  const addAllergy = () => {
    onChange('allergies', [
      ...allergies,
      { id: createRowId('alg'), drug: '', reaction: '' },
    ])
  }

  return (
    <form
      className="assess"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <header className="assess-head">
        <div>
          <h1>Patient Assessment</h1>
          <p>Enter clinician inputs to generate individualized opioid guidance.</p>
        </div>
        <div className="assess-progress">
          <div className="progress-track" aria-hidden="true">
            <span style={{ width: `${Math.max(progress, 1) * 25}%` }} />
          </div>
          <span>{Math.max(progress, 1)} / 4</span>
        </div>
      </header>

      {Object.keys(errors).length > 0 && (
        <div className="form-banner" role="alert">
          Complete the required clinical fields highlighted below.
        </div>
      )}

      <div className="assessment-form-content">
        <InputSection index={1} title="Patient & VOC">
          <div className="grid-4">
            <Field label="Age" htmlFor="age" requirement="required" unit="years" error={errors.age}>
              <input
                id="age"
                className="control"
                type="number"
                min="18"
                placeholder="e.g. 28"
                value={form.age}
                onChange={(e) => onChange('age', e.target.value)}
              />
            </Field>
            <Field label="Sex" htmlFor="sex" requirement="required" error={errors.sex}>
              <select
                id="sex"
                className="control"
                value={form.sex}
                onChange={(e) => onChange('sex', e.target.value)}
              >
                <option value="">Select</option>
                {SEX_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Weight" htmlFor="weight" requirement="required" unit="kg" error={errors.weight}>
              <input
                id="weight"
                className="control"
                type="number"
                min="1"
                step="0.1"
                placeholder="e.g. 70"
                value={form.weight}
                onChange={(e) => onChange('weight', e.target.value)}
              />
            </Field>
            <Field label="BMI" htmlFor="bmi" requirement="optional" unit="kg/m²" error={errors.bmi}>
              <input
                id="bmi"
                className="control"
                type="number"
                min="0"
                step="0.1"
                placeholder="If available"
                value={form.bmi}
                onChange={(e) => onChange('bmi', e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Baseline pain score"
            htmlFor="baselinePainScore"
            requirement="required"
            error={errors.baselinePainScore}
          >
            <div className="slider-row">
              <input
                id="baselinePainScore"
                className="pain-slider"
                type="range"
                min={PAIN_SCORE_MIN}
                max={PAIN_SCORE_MAX}
                value={form.baselinePainScore}
                onChange={(e) => onChange('baselinePainScore', Number(e.target.value))}
              />
              <strong className="slider-value">{form.baselinePainScore}</strong>
            </div>
          </Field>

          <div className="config-group" data-configurable="vital-signs">
            <div className="config-group-head">
              <div>
                <h3>Relevant Vital Signs</h3>
                <p>Configurable group. Exact vital-sign fields are not yet finalized.</p>
              </div>
              <span className="req-badge req-badge--conditional">Conditional</span>
            </div>
            {vitalSigns.map((row) => (
              <div key={row.id} className="dynamic-row">
                <SearchableCombobox
                  value={row.name}
                  onChange={(value) =>
                    onChange('vitalSigns', updateRow(vitalSigns, row.id, { name: value }))
                  }
                  options={VITAL_SIGN_SUGGESTIONS}
                  placeholder="Field name"
                  allowCustom
                />
                <input
                  className="control"
                  type="text"
                  placeholder="Value"
                  value={row.value}
                  onChange={(e) =>
                    onChange('vitalSigns', updateRow(vitalSigns, row.id, { value: e.target.value }))
                  }
                />
                <SearchableCombobox
                  value={row.unit}
                  onChange={(value) =>
                    onChange('vitalSigns', updateRow(vitalSigns, row.id, { unit: value }))
                  }
                  options={VITAL_SIGN_UNITS}
                  placeholder="Unit"
                  allowCustom
                />
                <button
                  type="button"
                  className="row-remove"
                  aria-label="Remove vital sign"
                  onClick={() =>
                    onChange(
                      'vitalSigns',
                      vitalSigns.filter((item) => item.id !== row.id),
                    )
                  }
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button type="button" className="add-row-btn" onClick={addVital}>
              <Plus size={14} />
              Add vital sign
            </button>
          </div>

          <div className="grid-2">
            <Field
              label="SCD genotype"
              htmlFor="scdGenotype"
              requirement="optional"
              hint="Sickle cell genotype — not CYP2D6."
            >
              <SearchableCombobox
                id="scdGenotype"
                value={form.scdGenotype}
                onChange={(value) => onChange('scdGenotype', value)}
                options={SCD_GENOTYPE_OPTIONS}
                placeholder="Search or select genotype"
                allowCustom
              />
            </Field>
            <Field
              label="VOC history"
              htmlFor="vocHistory"
              requirement="optional"
              hint="Configurable summary until the exact format is finalized."
            >
              <textarea
                id="vocHistory"
                className="control control-textarea"
                rows={3}
                placeholder="Available VOC history"
                value={form.vocHistory}
                onChange={(e) => onChange('vocHistory', e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Relevant comorbidities"
            htmlFor="comorbidities"
            requirement="conditional"
            hint="Searchable multi-select. Condition list is configurable."
          >
            <SearchableCombobox
              id="comorbidities"
              multiple
              allowCustom
              values={comorbidities}
              onChange={(values) => onChange('comorbidities', values)}
              options={COMORBIDITY_SUGGESTIONS}
              placeholder="Search or type a condition"
            />
          </Field>
        </InputSection>

        <InputSection index={2} title="Organ Function">
          <div className="grid-3">
            <Field
              label="Serum creatinine"
              htmlFor="serumCreatinine"
              requirement="conditional"
              hint="If available or needed."
            >
              <div className="control-with-unit">
                <input
                  id="serumCreatinine"
                  className="control"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 0.9"
                  value={form.serumCreatinine}
                  onChange={(e) => onChange('serumCreatinine', e.target.value)}
                />
                <select
                  className="control unit-select"
                  aria-label="Creatinine unit"
                  value={form.creatinineUnit}
                  onChange={(e) => onChange('creatinineUnit', e.target.value)}
                >
                  {CREATININE_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
            <Field
              label="eGFR"
              htmlFor="egfr"
              requirement="required"
              unit="mL/min/1.73m²"
              emphasized
              error={errors.egfr}
              hint="Primary renal-safety field."
            >
              <input
                id="egfr"
                className="control"
                type="number"
                min="0"
                placeholder="e.g. 90"
                value={form.egfr}
                onChange={(e) => onChange('egfr', e.target.value)}
              />
            </Field>
          </div>

          <div className="config-group" data-configurable="liver-function-tests">
            <div className="config-group-head">
              <div>
                <h3>Relevant Liver Function Tests</h3>
                <p>Configurable grouped labs. Exact tests are not limited to AST/ALT.</p>
              </div>
              <span className="req-badge req-badge--conditional">Conditional</span>
            </div>
            {liverTests.map((row) => (
              <div key={row.id} className="dynamic-row">
                <SearchableCombobox
                  value={row.name}
                  onChange={(value) =>
                    onChange('liverTests', updateRow(liverTests, row.id, { name: value }))
                  }
                  options={LIVER_TEST_SUGGESTIONS}
                  placeholder="Test name"
                  allowCustom
                />
                <input
                  className="control"
                  type="text"
                  placeholder="Value"
                  value={row.value}
                  onChange={(e) =>
                    onChange('liverTests', updateRow(liverTests, row.id, { value: e.target.value }))
                  }
                />
                <SearchableCombobox
                  value={row.unit}
                  onChange={(value) =>
                    onChange('liverTests', updateRow(liverTests, row.id, { unit: value }))
                  }
                  options={LIVER_TEST_UNITS}
                  placeholder="Unit"
                  allowCustom
                />
                <button
                  type="button"
                  className="row-remove"
                  aria-label="Remove liver test"
                  onClick={() =>
                    onChange(
                      'liverTests',
                      liverTests.filter((item) => item.id !== row.id),
                    )
                  }
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button type="button" className="add-row-btn" onClick={addLiverTest}>
              <Plus size={14} />
              Add test
            </button>
          </div>
        </InputSection>

        <InputSection index={3} title="Medication & Opioid History">
          <Field
            label="Current medications"
            htmlFor="medications"
            requirement="required"
            error={errors.medications}
          >
            <SearchableCombobox
              id="medications"
              multiple
              allowCustom
              values={medications}
              onChange={(values) => onChange('medications', values)}
              options={MEDICATION_SUGGESTIONS}
              placeholder="Search or type a medication"
            />
          </Field>

          {medications.length > 0 && (
            <div className="derived-flags" aria-live="polite">
              <p className="derived-flags-label">System-derived from current medications</p>
              <div className="derived-flag-grid">
                <div className="derived-flag">
                  <span>CYP2D6 inhibitor exposure</span>
                  <strong>{flags.inhibitorExposure}</strong>
                </div>
                <div className="derived-flag">
                  <span>Relevant interactions</span>
                  <strong>{flags.interactions}</strong>
                </div>
                <div className="derived-flag">
                  <span>CNS depressants</span>
                  <strong>
                    {flags.cnsDepressants}
                    {flags.cnsAgents.length > 0 ? ` — ${flags.cnsAgents.join(', ')}` : ''}
                  </strong>
                </div>
              </div>
            </div>
          )}

          <Field
            label="Baseline opioid therapy"
            requirement="required"
            error={errors.baselineOpioids}
          >
            <label className="check-row">
              <input
                type="checkbox"
                checked={form.noBaselineOpioid}
                onChange={(e) => {
                  const checked = e.target.checked
                  onChange('noBaselineOpioid', checked)
                  if (checked) onChange('baselineOpioids', [])
                }}
              />
              <span>No baseline opioid therapy</span>
            </label>
            {!form.noBaselineOpioid && (
              <>
                {baselineOpioids.map((row) => (
                  <div key={row.id} className="dynamic-row dynamic-row--opioid">
                    <SearchableCombobox
                      value={row.drug}
                      onChange={(value) =>
                        onChange('baselineOpioids', updateRow(baselineOpioids, row.id, { drug: value }))
                      }
                      options={OPIOID_OPTIONS}
                      placeholder="Opioid / drug"
                      allowCustom
                    />
                    <input
                      className="control"
                      placeholder="Dose"
                      value={row.dose}
                      onChange={(e) =>
                        onChange(
                          'baselineOpioids',
                          updateRow(baselineOpioids, row.id, { dose: e.target.value }),
                        )
                      }
                    />
                    <select
                      className="control"
                      value={row.route}
                      onChange={(e) =>
                        onChange(
                          'baselineOpioids',
                          updateRow(baselineOpioids, row.id, { route: e.target.value }),
                        )
                      }
                    >
                      <option value="">Route</option>
                      {ROUTE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="row-remove"
                      aria-label="Remove baseline opioid"
                      onClick={() =>
                        onChange(
                          'baselineOpioids',
                          baselineOpioids.filter((item) => item.id !== row.id),
                        )
                      }
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button type="button" className="add-row-btn" onClick={addBaselineOpioid}>
                  <Plus size={14} />
                  Add baseline opioid
                </button>
              </>
            )}
          </Field>

          <Field
            label="Opioid tolerance"
            htmlFor="opioidTolerance"
            requirement="required"
            error={errors.opioidTolerance}
          >
            <RadioYesNo name="opioidTolerance" value={form.opioidTolerance} onChange={onChange} />
          </Field>

          <Field
            label="Previous opioid response"
            requirement="conditional"
            error={errors.previousResponses}
            hint="Required when previous treatment history exists. Add one row per opioid."
          >
            {previousResponses.map((row) => (
              <div key={row.id} className="dynamic-row">
                <SearchableCombobox
                  value={row.opioid}
                  onChange={(value) =>
                    onChange('previousResponses', updateRow(previousResponses, row.id, { opioid: value }))
                  }
                  options={OPIOID_OPTIONS}
                  placeholder="Opioid"
                  allowCustom
                />
                <select
                  className="control"
                  value={row.response}
                  onChange={(e) =>
                    onChange(
                      'previousResponses',
                      updateRow(previousResponses, row.id, { response: e.target.value }),
                    )
                  }
                >
                  <option value="">Previous response</option>
                  {PREVIOUS_RESPONSE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="row-remove"
                  aria-label="Remove previous opioid"
                  onClick={() =>
                    onChange(
                      'previousResponses',
                      previousResponses.filter((item) => item.id !== row.id),
                    )
                  }
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button type="button" className="add-row-btn" onClick={addPreviousResponse}>
              <Plus size={14} />
              Add previous opioid
            </button>
          </Field>

          <Field
            label="Allergy / intolerance"
            requirement="required"
            error={errors.allergies}
          >
            <label className="check-row">
              <input
                type="checkbox"
                checked={form.noKnownAllergy}
                onChange={(e) => {
                  const checked = e.target.checked
                  onChange('noKnownAllergy', checked)
                  if (checked) onChange('allergies', [])
                }}
              />
              <span>No known opioid allergy/intolerance</span>
            </label>
            {!form.noKnownAllergy && (
              <>
                {allergies.map((row) => (
                  <div key={row.id} className="dynamic-row">
                    <SearchableCombobox
                      value={row.drug}
                      onChange={(value) =>
                        onChange('allergies', updateRow(allergies, row.id, { drug: value }))
                      }
                      options={OPIOID_OPTIONS}
                      placeholder="Drug"
                      allowCustom
                    />
                    <input
                      className="control"
                      placeholder="Reaction / intolerance if known"
                      value={row.reaction}
                      onChange={(e) =>
                        onChange(
                          'allergies',
                          updateRow(allergies, row.id, { reaction: e.target.value }),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="row-remove"
                      aria-label="Remove allergy"
                      onClick={() =>
                        onChange(
                          'allergies',
                          allergies.filter((item) => item.id !== row.id),
                        )
                      }
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button type="button" className="add-row-btn" onClick={addAllergy}>
                  <Plus size={14} />
                  Add allergy / intolerance
                </button>
              </>
            )}
          </Field>
        </InputSection>

        <InputSection index={4} title="Pharmacogenomics — CYP2D6">
          <Field
            label="CYP2D6 genotype available?"
            htmlFor="genotypeAvailable"
            requirement="required"
            error={errors.genotypeAvailable}
          >
            <RadioYesNo
              name="genotypeAvailable"
              value={form.genotypeAvailable}
              onChange={(name, value) => {
                onChange(name, value)
                if (value === 'No') {
                  onChange('allele1', '')
                  onChange('allele2', '')
                  onChange('hasCnv', false)
                  onChange('copyNumber', '')
                  onChange('duplicatedAllele', '')
                }
              }}
            />
          </Field>

          {form.genotypeAvailable === 'No' && (
            <p className="info-note">
              Genetic data unavailable. Medication-related CYP2D6 inhibition will still be assessed.
            </p>
          )}

          {form.genotypeAvailable === 'Yes' && (
            <>
              <div className="grid-2">
                <Field
                  label="CYP2D6 star allele 1"
                  htmlFor="allele1"
                  requirement="conditional"
                  error={errors.allele1}
                >
                  <SearchableCombobox
                    id="allele1"
                    value={form.allele1}
                    onChange={(value) => onChange('allele1', value)}
                    options={CYP2D6_ALLELE_OPTIONS}
                    placeholder="CPIC allele, e.g. *1"
                    allowCustom={false}
                  />
                </Field>
                <Field
                  label="CYP2D6 star allele 2"
                  htmlFor="allele2"
                  requirement="conditional"
                  error={errors.allele2}
                >
                  <SearchableCombobox
                    id="allele2"
                    value={form.allele2}
                    onChange={(value) => onChange('allele2', value)}
                    options={CYP2D6_ALLELE_OPTIONS}
                    placeholder="CPIC allele, e.g. *4"
                    allowCustom={false}
                  />
                </Field>
              </div>

              <label className="check-row">
                <input
                  type="checkbox"
                  checked={form.hasCnv}
                  onChange={(e) => {
                    const checked = e.target.checked
                    onChange('hasCnv', checked)
                    if (!checked) {
                      onChange('copyNumber', '')
                      onChange('duplicatedAllele', '')
                    }
                  }}
                />
                <span>Copy-number variation / duplication available</span>
              </label>

              {form.hasCnv && (
                <div className="grid-2">
                  <Field label="Copy number" htmlFor="copyNumber" requirement="conditional">
                    <select
                      id="copyNumber"
                      className="control"
                      value={form.copyNumber}
                      onChange={(e) => onChange('copyNumber', e.target.value)}
                    >
                      <option value="">Select</option>
                      {COPY_NUMBER_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Duplicated allele" htmlFor="duplicatedAllele" requirement="conditional">
                    <SearchableCombobox
                      id="duplicatedAllele"
                      value={form.duplicatedAllele}
                      onChange={(value) => onChange('duplicatedAllele', value)}
                      options={CYP2D6_ALLELE_OPTIONS}
                      placeholder="If known"
                      allowCustom={false}
                    />
                  </Field>
                </div>
              )}
            </>
          )}
        </InputSection>
      </div>

      <div className="assess-actions">
        <button type="button" className="btn btn-ghost" onClick={onClear} disabled={loading}>
          Clear
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Assessing…' : 'Get Recommendation'}
          {!loading && <ArrowRight size={15} />}
        </button>
      </div>
    </form>
  )
}
