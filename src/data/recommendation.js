/**
 * SCDAid recommendation assembler.
 * Verified rule modules: CYP2D6, phenoconversion, clinical safety.
 * Treatment-response ranking comes from the FastAPI ML service.
 * Simulation-based proof-of-concept. Not clinically validated.
 */

import { predictTreatmentResponse } from '../api/scdaidApi.js'
import { calculateCYP2D6ActivityScore } from '../logic/cyp2d6.js'
import { applyPhenoconversion } from '../logic/phenoconversion.js'
import { CNS_DEPRESSANT_MEDICATIONS, evaluateOpioidSafety } from '../logic/clinicalSafety.js'

export const LOADING_STEPS = [
  'Analyzing patient data...',
  'Evaluating organ function...',
  'Screening medications and interactions...',
  'Assessing CYP2D6 pharmacogenomics...',
  'Applying clinical safety rules...',
  'Ranking rankable opioid strategies...',
]

export const EVALUATION_DISCLAIMER =
  'Simulation-based proof-of-concept. Performance reflects recovery of an evidence-informed synthetic simulation and does not establish clinical predictive validity.'

const ML_UNAVAILABLE =
  'ML prediction service unavailable. Safety assessment remains available, but treatment-response ranking could not be generated.'

function inhibitionRiskAlert(conversion) {
  if (!conversion.inhibitionRisk) return null

  const agents =
    conversion.inhibitorAgents.length > 0 ? ` (${conversion.inhibitorAgents.join(', ')})` : ''

  return {
    title: 'CYP2D6 Functional Inhibition Risk Alert',
    message: `Genotype is unavailable. Relevant ${conversion.inhibitorExposure.toLowerCase()} CYP2D6 inhibitor exposure was detected${agents}. Functional inhibition risk is flagged without assigning a phenotype.`,
  }
}

export function buildPgx(form) {
  const genotypeAvailable = form.genotypeAvailable === 'Yes'
  const medications = form.medications || []

  if (!genotypeAvailable) {
    const conversion = applyPhenoconversion({
      genotypeAvailable: false,
      activityScore: null,
      predictedPhenotype: null,
      medications,
    })

    return {
      genotypeAvailable: false,
      activityScore: null,
      predictedPhenotype: null,
      adjustedScore: null,
      functionalPhenotype: null,
      phenoconversion: false,
      inhibitorExposure: conversion.inhibitorExposure,
      inhibitorAgents: conversion.inhibitorAgents,
      inhibitionRisk: inhibitionRiskAlert(conversion),
      error: null,
      apiFunctionalPhenotype: null,
    }
  }

  const genotype = calculateCYP2D6ActivityScore({
    allele1: form.allele1,
    allele2: form.allele2,
    hasCnv: form.hasCnv,
    copyNumber: form.copyNumber,
    duplicatedAllele: form.duplicatedAllele,
  })

  if (genotype.error) {
    return {
      genotypeAvailable: true,
      activityScore: null,
      predictedPhenotype: null,
      adjustedScore: null,
      functionalPhenotype: null,
      phenoconversion: false,
      inhibitorExposure: 'None',
      inhibitorAgents: [],
      inhibitionRisk: null,
      error: genotype.error,
      apiFunctionalPhenotype: null,
    }
  }

  const conversion = applyPhenoconversion({
    genotypeAvailable: true,
    activityScore: genotype.activityScore,
    predictedPhenotype: genotype.predictedPhenotype,
    medications,
  })

  const relevantInhibitor = conversion.inhibitorExposure !== 'None'

  return {
    genotypeAvailable: true,
    activityScore: genotype.activityScore,
    predictedPhenotype: genotype.predictedPhenotype,
    adjustedScore: relevantInhibitor ? conversion.adjustedActivityScore : null,
    functionalPhenotype: relevantInhibitor ? conversion.functionalPhenotype : null,
    phenoconversion: Boolean(conversion.phenoconversion),
    inhibitorExposure: conversion.inhibitorExposure,
    inhibitorAgents: conversion.inhibitorAgents,
    inhibitionRisk: null,
    error: conversion.error,
    apiFunctionalPhenotype: conversion.error ? null : conversion.functionalPhenotype,
  }
}

function buildSafetyFromEngine(form, safetyEval) {
  const renalHit = safetyEval.evaluated
    .flatMap((item) => item.safetyFlags)
    .find((flag) => flag.type === 'renal')

  let renal = null
  if (renalHit) {
    const severe = renalHit.egfr < 30
    renal = {
      title: severe ? 'Severe Renal Review' : 'Renal Safety Alert',
      message: severe
        ? `eGFR ${form.egfr} mL/min/1.73m². Severe renal impairment requires drug-specific dosing/safety review.`
        : `eGFR ${form.egfr} mL/min/1.73m². Moderate renal impairment may lead to metabolite accumulation or reduced clearance for some opioids; careful titration is required. Fentanyl has no renal restriction from this rule.`,
    }
  }

  const hepatic = {
    title: `Hepatic Assessment — ${safetyEval.hepaticAssessment.status}`,
    message: safetyEval.hepaticAssessment.message,
  }

  const cns = safetyEval.globalAlerts.find((alert) => alert.type === 'cns')
  const interaction = cns
    ? {
        title: 'Drug-Interaction Alert',
        message: `${cns.message} Matched medications: ${cns.agents.join(', ')}.`,
      }
    : null

  const allergyHits = safetyEval.evaluated.filter((item) =>
    item.safetyFlags.some((flag) => flag.type === 'allergy'),
  )
  const allergy = allergyHits.length
    ? {
        title: 'Allergy / Intolerance Alert',
        message: allergyHits
          .map((item) => `${item.name}: Documented allergy or intolerance to this opioid.`)
          .join(' '),
      }
    : null

  return { renal, hepatic, interaction, allergy }
}

function cnsDepressantPresent(medications) {
  const names = medications || []
  if (names.length === 0) return null
  const allowed = new Set(CNS_DEPRESSANT_MEDICATIONS)
  const hit = names.some((item) => allowed.has(String(item).trim().toLowerCase()))
  return hit ? 'Yes' : 'No'
}

export function previousResponseFor(form, opioidName) {
  const target = String(opioidName || '')
    .trim()
    .toLowerCase()
  const row = (form.previousResponses || []).find(
    (item) => String(item.opioid || '').trim().toLowerCase() === target && item.response,
  )
  return row?.response || 'Unknown'
}

function buildRuleBasedFindings(form, pgx, safetyEval, safety, preferred) {
  const findings = []

  if (preferred) {
    findings.push(
      `${preferred.name} has the highest predicted response among rankable options (${preferred.eligibility}).`,
    )
  }

  if (pgx.error) {
    findings.push(`CYP2D6 genotype could not be interpreted: ${pgx.error}`)
  } else if (pgx.predictedPhenotype) {
    findings.push(`Genotype-predicted CYP2D6 phenotype: ${pgx.predictedPhenotype}.`)
    if (pgx.functionalPhenotype && pgx.phenoconversion) {
      findings.push(
        `Functional CYP2D6 phenotype after inhibitor adjustment: ${pgx.functionalPhenotype}.`,
      )
    }
  } else if (pgx.genotypeAvailable === false) {
    findings.push('CYP2D6 genotype was not available.')
  }

  if (pgx.inhibitorExposure && pgx.inhibitorExposure !== 'None') {
    const agents = pgx.inhibitorAgents.length > 0 ? ` (${pgx.inhibitorAgents.join(', ')})` : ''
    findings.push(`${pgx.inhibitorExposure} CYP2D6 inhibitor exposure${agents}.`)
  }

  if (pgx.inhibitionRisk) {
    findings.push(pgx.inhibitionRisk.message)
  }

  if (safetyEval.error) {
    findings.push(safetyEval.error)
  } else if (safety.renal) {
    findings.push(safety.renal.message)
  }

  if (safety.hepatic?.message) {
    findings.push(safety.hepatic.message)
  }

  if (safety.interaction) {
    findings.push(safety.interaction.message)
  }

  if (safety.allergy) {
    findings.push(safety.allergy.message)
  }

  const avoided = (safetyEval.evaluated || []).filter(
    (item) => item.eligibility === 'Avoid / Not recommended',
  )
  if (avoided.length > 0) {
    findings.push(`Excluded from ranking: ${avoided.map((item) => item.name).join(', ')}.`)
  }

  const previous = (form.previousResponses || []).filter((row) => row.opioid && row.response)
  if (previous.length > 0) {
    findings.push(
      `Documented previous responses: ${previous
        .map((row) => `${row.opioid} (${row.response})`)
        .join('; ')}.`,
    )
  } else {
    findings.push('No documented previous opioid response was entered.')
  }

  return findings
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function buildPredictPayload(form, pgx, rankable) {
  if (rankable.some((item) => item.eligibility === 'Avoid / Not recommended')) {
    throw new Error('Avoid / Not recommended candidates must never be sent to the ML service.')
  }

  return {
    patient: {
      age: numberOrNull(form.age),
      sex: form.sex || null,
      weight_kg: numberOrNull(form.weight),
      BMI: numberOrNull(form.bmi),
      baseline_pain: numberOrNull(form.baselinePainScore),
      eGFR: numberOrNull(form.egfr),
      serum_creatinine: numberOrNull(form.serumCreatinine),
      creatinine_unit: form.creatinineUnit || null,
      vital_signs: (form.vitalSigns || []).map((row) => ({
        name: row.name || '',
        value: row.value ?? '',
        unit: row.unit || '',
      })),
      opioid_tolerance: form.opioidTolerance || null,
      SCD_genotype: form.scdGenotype || null,
      CYP2D6_genotype_available: form.genotypeAvailable || null,
      genotype_activity_score: pgx.activityScore,
      genotype_predicted_phenotype: pgx.predictedPhenotype,
      functional_phenotype: pgx.apiFunctionalPhenotype,
      CYP2D6_inhibitor_strength: pgx.inhibitorExposure,
      CNS_depressant_present: cnsDepressantPresent(form.medications),
    },
    candidates: rankable.map((item) => ({
      candidate_opioid: item.name,
      previous_response_this_opioid: previousResponseFor(form, item.name),
    })),
  }
}

function finalizeRecommendation(form, pgx, safetyEval, safety, evaluated, extra = {}) {
  const preferred = extra.preferred || null
  const alternatives = extra.alternatives || evaluated.filter((item) => item.name !== preferred?.name)

  return {
    generatedAt: new Date().toISOString(),
    error: safetyEval.error,
    mlError: extra.mlError || null,
    missingRuntimeFeatures: extra.missingRuntimeFeatures || [],
    disclaimer: EVALUATION_DISCLAIMER,
    hepaticAssessment: safetyEval.hepaticAssessment,
    preferred: preferred
      ? {
          ...preferred,
          subtitle: 'Highest predicted response among rankable options',
        }
      : null,
    alternatives,
    evaluated,
    pgx,
    safety,
    prediction: {
      label: 'Predicted pain reduction at 60 min',
      value:
        preferred?.predictedDeltaPain60 != null ? `${preferred.predictedDeltaPain60} points` : 'Not applicable',
      note: 'Simulation-based proof-of-concept prediction; not clinically validated.',
    },
    explanation: {
      title: 'Why SCDAid Recommended This',
      disclaimer:
        'Model-level explainability has not yet been integrated. The items below are verified rule-based findings from this assessment, not feature-importance scores.',
      findings: buildRuleBasedFindings(form, pgx, safetyEval, safety, preferred),
    },
    followUp: {
      title: 'Recommended Pain Reassessment',
      timing: '15–30 minutes after IV opioid administration',
      message:
        'Reassess pain intensity, sedation, and respiratory status after the initial dose and before further titration.',
    },
    context: {
      age: form.age || null,
      sex: form.sex || null,
      weight: form.weight || null,
      bmi: form.bmi || null,
      scdGenotype: form.scdGenotype || null,
      vocHistory: form.vocHistory || null,
      comorbidities: form.comorbidities || [],
      baselinePainScore: form.baselinePainScore,
      opioidTolerance: form.opioidTolerance,
      previousResponses: form.previousResponses || [],
      medicationCount: (form.medications || []).length,
    },
  }
}

export async function buildRecommendation(form = {}) {
  const pgx = buildPgx(form)
  const safetyEval = evaluateOpioidSafety({ form, pgx })
  const safety = buildSafetyFromEngine(form, safetyEval)

  const evaluated = safetyEval.evaluated.map((item) => ({
    id: item.name.toLowerCase(),
    name: item.name,
    eligibility: item.eligibility,
    note:
      item.reasons.length > 0
        ? item.reasons.join(' ')
        : 'No safety rule excluded this option.',
    reasons: item.reasons,
    safetyFlags: item.safetyFlags,
    predictedDeltaPain60: null,
    predictedDeltaPain60Raw: null,
  }))

  const rankable = evaluated.filter((item) => item.eligibility !== 'Avoid / Not recommended')
  const avoided = evaluated.filter((item) => item.eligibility === 'Avoid / Not recommended')

  if (rankable.length === 0) {
    return finalizeRecommendation(form, pgx, safetyEval, safety, [...avoided], {
      preferred: null,
      alternatives: avoided,
    })
  }

  try {
    const payload = buildPredictPayload(form, pgx, rankable)
    const api = await predictTreatmentResponse(payload)
    const byName = new Map(
      (api.predictions || []).map((item) => [item.candidate_opioid, item]),
    )

    const scored = rankable.map((item) => {
      const prediction = byName.get(item.name)
      if (!prediction) {
        throw new Error(`Missing ML prediction for ${item.name}.`)
      }
      return {
        ...item,
        predictedDeltaPain60: prediction.predicted_delta_pain_60,
        predictedDeltaPain60Raw: prediction.predicted_delta_pain_60_raw,
      }
    })

    // Eligible and Caution are co-ranked by predicted ΔPain60.
    // Avoid candidates are never ranked or sent to the ML service.
    scored.sort((a, b) => (b.predictedDeltaPain60Raw ?? -Infinity) - (a.predictedDeltaPain60Raw ?? -Infinity))
    const ranked = [...scored, ...avoided]
    return finalizeRecommendation(form, pgx, safetyEval, safety, ranked, {
      preferred: scored[0],
      alternatives: ranked.filter((item) => item.name !== scored[0].name),
      missingRuntimeFeatures: api.missing_runtime_features || [],
    })
  } catch {
    return finalizeRecommendation(form, pgx, safetyEval, safety, evaluated, {
      preferred: null,
      alternatives: evaluated,
      mlError: ML_UNAVAILABLE,
    })
  }
}

export function formatRecommendationReport(result, form) {
  const rec = result.preferred
  const lines = [
    'SCDAid — Clinical Decision Support Report',
    EVALUATION_DISCLAIMER,
    `Generated: ${new Date(result.generatedAt).toLocaleString()}`,
    '',
    'Patient snapshot',
    `Age: ${form.age || '—'}   Sex: ${form.sex || '—'}   Weight: ${form.weight || '—'} kg`,
    `SCD genotype: ${form.scdGenotype || '—'}   Pain score: ${form.baselinePainScore === '' ? '—' : form.baselinePainScore}/10`,
    '',
  ]

  if (result.mlError) {
    lines.push(result.mlError, '')
  }

  if (rec) {
    lines.push(`Top-ranked option: ${rec.name} (${rec.eligibility})`)
    lines.push(
      rec.predictedDeltaPain60 != null
        ? `Predicted pain reduction at 60 min: ${rec.predictedDeltaPain60} points`
        : 'Predicted pain reduction at 60 min: not applicable',
    )
    lines.push('Dose guidance not implemented in this proof-of-concept version.')
  } else {
    lines.push('No rankable opioid strategy was generated.')
  }

  const strategyItems = result.evaluated?.length
    ? result.evaluated
    : [rec, ...(result.alternatives || [])].filter(Boolean)

  lines.push('', 'Opioid strategies:')
  for (const item of strategyItems) {
    const delta =
      item.predictedDeltaPain60 != null ? `  ΔPain60 ${item.predictedDeltaPain60} points` : ''
    lines.push(`  - ${item.name}  ${item.eligibility}${delta}`)
  }

  lines.push('', `Pain reassessment: ${result.followUp.timing}`)

  if (result.explanation?.findings?.length) {
    lines.push('', 'Rule-based findings:')
    for (const finding of result.explanation.findings) {
      lines.push(`  - ${finding}`)
    }
  }

  return lines.join('\n')
}
