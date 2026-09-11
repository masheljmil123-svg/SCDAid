import { useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  ClipboardList,
  Clock,
  Dna,
  Download,
  HeartPulse,
  Link2,
  Search,
  ShieldAlert,
} from 'lucide-react'
import { LOADING_STEPS, formatRecommendationReport } from '../data/recommendation.js'

function EligibilityBadge({ status }) {
  const key =
    status === 'Avoid / Not recommended' || status === 'Avoid' ? 'avoid' : status.toLowerCase()
  return <span className={`eligibility-badge eligibility-badge--${key}`}>{status}</span>
}

function PhenotypeBadge({ value }) {
  return <span className="phenotype-badge">{value}</span>
}

function SafetyCard({ icon: Icon, title, body, tone = 'warning' }) {
  return (
    <article className={`status-card status-card--${tone}`}>
      <h3>
        <span className="status-icon">
          <Icon size={13} strokeWidth={2.2} />
        </span>
        {title}
      </h3>
      <p>{body}</p>
    </article>
  )
}

export function RecommendationResults({ result, form, loading, loadingStep = 0 }) {
  const [openAlt, setOpenAlt] = useState(null)
  const [shapOpen, setShapOpen] = useState(true)
  const [query, setQuery] = useState('')

  const handleDownload = () => {
    if (!result) return
    const content = formatRecommendationReport(result, form)
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'SCDAid-recommendation-report.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  const pgx = result?.pgx
  const showActivity = Boolean(pgx?.genotypeAvailable && pgx.activityScore !== null)
  const showPredictedPhenotype = Boolean(pgx?.genotypeAvailable && pgx.predictedPhenotype)
  const showAdjusted = Boolean(pgx?.genotypeAvailable && pgx.adjustedScore !== null)
  const showFunctional = Boolean(pgx?.genotypeAvailable && pgx.functionalPhenotype)
  const showPhenoconversion = Boolean(pgx?.phenoconversion)
  const showInhibitionRisk = Boolean(pgx?.inhibitionRisk)
  const showPgxError = Boolean(pgx?.error)
  const showPgx =
    showActivity ||
    showPredictedPhenotype ||
    showAdjusted ||
    showFunctional ||
    showPhenoconversion ||
    showInhibitionRisk ||
    showPgxError

  const safety = result?.safety
  const safetyItems = safety
    ? [
        safety.renal && { ...safety.renal, icon: HeartPulse, tone: 'warning' },
        safety.hepatic && { ...safety.hepatic, icon: ShieldAlert, tone: 'warning' },
        safety.interaction && { ...safety.interaction, icon: Link2, tone: 'info' },
        safety.allergy && { ...safety.allergy, icon: AlertTriangle, tone: 'warning' },
      ].filter(Boolean)
    : []
  const showSafety = safetyItems.length > 0 || Boolean(result?.error)

  return (
    <section className="results">
      <div className="results-toolbar">
        <label className="results-search">
          <Search size={14} />
          <input
            type="search"
            placeholder="Search patient ID or name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span className="results-avatar" aria-hidden="true">
          MA
        </span>
      </div>

      <header className="results-head">
        <div>
          <h1>Recommendation Results</h1>
          <p>Based on the provided patient data. Please review and use clinical judgment.</p>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={handleDownload}
          disabled={!result || loading}
        >
          <Download size={14} />
          Download Report
        </button>
      </header>

      <div className="results-content">
        {loading && (
          <div className="results-loading-panel" aria-live="polite">
            <p className="results-loading">{LOADING_STEPS[loadingStep]}</p>
            <ol className="loading-steps">
              {LOADING_STEPS.map((step, index) => (
                <li
                  key={step}
                  className={
                    index === loadingStep ? 'is-current' : index < loadingStep ? 'is-done' : ''
                  }
                >
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        {!result && !loading && (
          <div className="awaiting">
            <span className="awaiting-icon">
              <ClipboardList size={22} />
            </span>
            <h2>Awaiting Assessment</h2>
            <p>
              Complete the patient information and click
              <br />
              “Get Recommendation” to generate individualized opioid guidance.
            </p>
          </div>
        )}

        {result && (
          <div className={`results-body${loading ? ' is-dim' : ''}`}>
            {result.disclaimer && <p className="info-note">{result.disclaimer}</p>}
            {result.mlError && <p className="info-note">{result.mlError}</p>}

            <section className="results-block">
              <h2 className="results-block-title">Recommendation</h2>
              {result.preferred ? (
              <article className="reco-card">
                <div className="reco-card-top">
                  <span className="reco-kicker">Top-ranked option</span>
                  <EligibilityBadge status={result.preferred.eligibility} />
                </div>
                <div className="reco-name">
                  <span className="reco-check">
                    <Check size={14} strokeWidth={3} />
                  </span>
                  <div>
                    <h2>{result.preferred.name}</h2>
                    <p>Highest predicted response among rankable options</p>
                  </div>
                </div>

                {result.preferred.predictedDeltaPain60 != null && (
                  <div className="prediction-inline">
                    <span>Predicted pain reduction at 60 min</span>
                    <strong>{result.preferred.predictedDeltaPain60} points</strong>
                    <em>Simulation-based proof-of-concept prediction; not clinically validated.</em>
                  </div>
                )}

                <div className="dose-card">
                  <h3>Individualized dose / dose-adjustment guidance</h3>
                  <p className="dose-note">
                    Dose guidance not implemented in this proof-of-concept version.
                  </p>
                </div>
              </article>
              ) : (
                !result.mlError && (
                  <p className="info-note">No rankable opioid remains after safety review.</p>
                )
              )}
            </section>

            <section className="results-block">
              <h2 className="results-block-title">Alternative Strategies</h2>
              <div className="alt-wrap">
                <div className="alt-head">
                  <span>Ranked alternative opioid strategies</span>
                  <span>Eligibility</span>
                </div>
                {result.alternatives.map((alt) => {
                  const expanded = openAlt === alt.id
                  return (
                    <div key={alt.id} className={`alt-row${expanded ? ' is-open' : ''}`}>
                      <button
                        type="button"
                        className="alt-row-toggle"
                        aria-expanded={expanded}
                        onClick={() => setOpenAlt(expanded ? null : alt.id)}
                      >
                        <span className="alt-main">
                          <strong>{alt.name}</strong>
                          {alt.predictedDeltaPain60 != null && (
                            <em>
                              Predicted pain reduction at 60 min: {alt.predictedDeltaPain60} points
                            </em>
                          )}
                        </span>
                        <EligibilityBadge status={alt.eligibility} />
                        <span className="alt-why">{alt.note}</span>
                        <ChevronDown size={14} className="alt-chevron" />
                      </button>
                      {expanded && alt.note && <p className="alt-detail">{alt.note}</p>}
                    </div>
                  )
                })}
              </div>
            </section>

            {showPgx && (
              <section className="results-block">
                <h2 className="results-block-title">Pharmacogenomics</h2>
                {showPgxError && <p className="info-note">{pgx.error}</p>}
                {(showActivity || showPredictedPhenotype || showAdjusted || showFunctional) && (
                  <div className="pgx-grid">
                    {showActivity && (
                      <article className="metric-card">
                        <span>CYP2D6 activity score</span>
                        <strong>{pgx.activityScore}</strong>
                      </article>
                    )}
                    {showPredictedPhenotype && (
                      <article className="metric-card">
                        <span>Genotype-predicted CYP2D6 phenotype</span>
                        <PhenotypeBadge value={pgx.predictedPhenotype} />
                      </article>
                    )}
                    {showAdjusted && (
                      <article className="metric-card">
                        <span>Adjusted CYP2D6 activity score</span>
                        <strong>{pgx.adjustedScore}</strong>
                      </article>
                    )}
                    {showFunctional && (
                      <article className="metric-card">
                        <span>Functional CYP2D6 phenotype</span>
                        <PhenotypeBadge value={pgx.functionalPhenotype} />
                      </article>
                    )}
                  </div>
                )}
                {showPhenoconversion && (
                  <SafetyCard
                    icon={Dna}
                    tone="genetic"
                    title="Phenoconversion alert"
                    body="Genotype-predicted phenotype and functional phenotype differ after inhibitor adjustment."
                  />
                )}
                {showInhibitionRisk && (
                  <SafetyCard
                    icon={Dna}
                    tone="genetic"
                    title={pgx.inhibitionRisk.title}
                    body={pgx.inhibitionRisk.message}
                  />
                )}
              </section>
            )}

            {showSafety && (
              <section className="results-block">
                <h2 className="results-block-title">Safety</h2>
                {result.error && <p className="info-note">{result.error}</p>}
                {safetyItems.length > 0 && (
                  <div className="status-grid status-grid--safety">
                    {safetyItems.map((item) => (
                      <SafetyCard
                        key={item.title}
                        icon={item.icon}
                        tone={item.tone}
                        title={item.title}
                        body={item.message}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="results-block">
              <h2 className="results-block-title">Explainability</h2>
              <div className={`expand-block${shapOpen ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="expand-toggle"
                  aria-expanded={shapOpen}
                  onClick={() => setShapOpen((open) => !open)}
                >
                  <BarChart3 size={15} />
                  <span>Why SCDAid Recommended This</span>
                  <ChevronDown size={14} />
                </button>
                {shapOpen && (
                  <div className="expand-body">
                    <p>{result.explanation.disclaimer}</p>
                    <h3 className="shap-heading">Verified rule-based findings</h3>
                    <ul className="shap-list">
                      {(result.explanation.findings || []).map((finding) => (
                        <li key={finding}>
                          <div className="shap-meta">
                            <span>{finding}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>

            <section className="results-block">
              <h2 className="results-block-title">Follow-up</h2>
              <article className="followup-card">
                <h3>
                  <Clock size={15} />
                  Recommended pain reassessment
                </h3>
                <strong>{result.followUp.timing}</strong>
                <p>{result.followUp.message}</p>
              </article>
            </section>
          </div>
        )}
      </div>
    </section>
  )
}
