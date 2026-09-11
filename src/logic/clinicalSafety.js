/**
 * Rule-based SCDAid clinical safety / eligibility engine.
 * This module is not machine learning and does not issue doses or rankings.
 *
 * Restrictiveness: Avoid / Not recommended > Caution > Eligible
 *
 * Hepatic impairment is NOT inferred from a single AST/ALT cutoff.
 * CYP2D6 phenotype is taken only from verified PGx output.
 */

export const CANDIDATE_OPIOIDS = [
  'Morphine',
  'Hydromorphone',
  'Fentanyl',
  'Oxycodone',
  'Codeine',
  'Tramadol',
]

/**
 * Explicit CNS-depressant names from the project medication vocabulary.
 * Matching is exact after trim + lowercase. Strength is not inferred by class.
 */
export const CNS_DEPRESSANT_MEDICATIONS = [
  'lorazepam',
  'diazepam',
  'clonazepam',
  'gabapentin',
  'pregabalin',
  'zolpidem',
]

const RANK = {
  Eligible: 0,
  Caution: 1,
  'Avoid / Not recommended': 2,
}

const RENAL_CAUTION_OPIOIDS = new Set([
  'Morphine',
  'Hydromorphone',
  'Oxycodone',
  'Codeine',
  'Tramadol',
])

function normalizeName(value) {
  return String(value ?? '').trim().toLowerCase()
}

function parseEgfr(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

function applyRule(candidate, eligibility, reason, flag) {
  if (RANK[eligibility] > RANK[candidate.eligibility]) {
    candidate.eligibility = eligibility
  }
  if (reason) candidate.reasons.push(reason)
  if (flag) candidate.safetyFlags.push(flag)
}

function allergyApplies(form, opioidName) {
  if (form?.noKnownAllergy) return false
  const target = normalizeName(opioidName)
  return (form?.allergies || []).some((row) => normalizeName(row.drug) === target)
}

function matchedCnsDepressants(medications) {
  const allowed = new Set(CNS_DEPRESSANT_MEDICATIONS)
  const hits = []
  for (const item of medications || []) {
    const normalized = normalizeName(item)
    if (normalized && allowed.has(normalized) && !hits.includes(item)) {
      hits.push(item)
    }
  }
  return hits
}

function pgxPhenotype(pgx) {
  if (!pgx?.genotypeAvailable) return null
  return pgx.functionalPhenotype || pgx.predictedPhenotype || null
}

function hasFunctionalInhibitionRisk(pgx) {
  if (pgx?.genotypeAvailable) return false
  if (pgx?.inhibitionRisk) return true
  return pgx?.inhibitorExposure === 'Strong' || pgx?.inhibitorExposure === 'Moderate'
}

function renalReason(opioidName, egfr) {
  if (opioidName === 'Tramadol') {
    return egfr < 30
      ? 'Severe renal impairment requires drug-specific dosing/safety review. Renal dosing is formulation-specific; automatic dose guidance is not issued by this prototype.'
      : 'Reduced tramadol clearance in moderate renal impairment requires careful titration. Automatic dose guidance is not issued by this prototype.'
  }
  if (opioidName === 'Morphine' || opioidName === 'Codeine') {
    return egfr < 30
      ? 'Severe renal impairment requires drug-specific dosing/safety review. Active metabolites may accumulate; use careful titration.'
      : 'Active metabolites may accumulate in moderate renal impairment; use careful titration.'
  }
  return egfr < 30
    ? 'Severe renal impairment requires drug-specific dosing/safety review. Reduced clearance may require careful titration.'
    : 'Reduced clearance in moderate renal impairment may require careful titration.'
}

function assessHepatic(form) {
  const tests = (form?.liverTests || []).filter((row) => String(row?.name ?? '').trim())
  if (tests.length === 0) {
    return {
      status: 'No data',
      message:
        'No liver-function tests were entered. Hepatic function is not assumed to be normal.',
    }
  }

  return {
    status: 'Review required',
    message:
      'Liver-function tests were entered, but this prototype cannot classify hepatic impairment severity without reference ranges, bilirubin/INR/albumin context, or Child-Pugh data. Clinician review is required. No opioid is automatically marked Avoid from these labs alone.',
  }
}

function priorAdverseFor(form, opioidName) {
  const target = normalizeName(opioidName)
  return (form?.previousResponses || []).some(
    (row) => normalizeName(row.opioid) === target && row.response === 'Adverse',
  )
}

/**
 * Evaluates safety/eligibility for the six prototype candidate opioids.
 * Does not rank options or calculate doses.
 */
export function evaluateOpioidSafety({ form = {}, pgx = {} } = {}) {
  const evaluated = CANDIDATE_OPIOIDS.map((name) => ({
    name,
    eligibility: 'Eligible',
    reasons: [],
    safetyFlags: [],
  }))

  const hepaticAssessment = assessHepatic(form)
  const globalAlerts = []
  const egfr = parseEgfr(form.egfr)
  const error =
    egfr === null
      ? 'eGFR is missing or invalid. Renal safety cannot be assessed and normal renal function is not assumed.'
      : null

  const phenotype = pgxPhenotype(pgx)
  const inhibitionRisk = hasFunctionalInhibitionRisk(pgx)
  const cnsAgents = matchedCnsDepressants(form.medications)

  if (hepaticAssessment.status === 'Review required') {
    globalAlerts.push({
      type: 'hepatic',
      status: hepaticAssessment.status,
      message: hepaticAssessment.message,
    })
  }

  if (cnsAgents.length > 0) {
    globalAlerts.push({
      type: 'cns',
      agents: cnsAgents,
      message:
        'Concomitant CNS depressant exposure may increase sedation and respiratory-depression risk.',
    })
  }

  for (const candidate of evaluated) {
    if (allergyApplies(form, candidate.name)) {
      applyRule(candidate, 'Avoid / Not recommended', 'Documented allergy or intolerance to this opioid.', {
        type: 'allergy',
        opioid: candidate.name,
      })
    }

    const cyp2d6Dependent = candidate.name === 'Codeine' || candidate.name === 'Tramadol'
    if (cyp2d6Dependent) {
      if (phenotype === 'Poor metabolizer') {
        applyRule(
          candidate,
          'Avoid / Not recommended',
          `${candidate.name} is not recommended for a CYP2D6 poor metabolizer because of reduced conversion to active metabolite.`,
          { type: 'pgx', phenotype },
        )
      } else if (phenotype === 'Ultrarapid metabolizer') {
        applyRule(
          candidate,
          'Avoid / Not recommended',
          `${candidate.name} is not recommended for a CYP2D6 ultrarapid metabolizer because of increased conversion to active metabolite.`,
          { type: 'pgx', phenotype },
        )
      } else if (phenotype === 'Intermediate metabolizer') {
        applyRule(
          candidate,
          'Caution',
          `${candidate.name} may have reduced CYP2D6-dependent activation in an intermediate metabolizer. Monitor response and consider an alternative if ineffective.`,
          { type: 'pgx', phenotype },
        )
      } else if (!phenotype && inhibitionRisk) {
        applyRule(
          candidate,
          'Caution',
          `CYP2D6 genotype is unavailable. Functional CYP2D6 inhibition risk may affect ${candidate.name} activation. This is not a genetically predicted phenotype.`,
          { type: 'pgx', inhibitionRisk: true },
        )
      }
    }

    if (egfr !== null && egfr < 60 && RENAL_CAUTION_OPIOIDS.has(candidate.name)) {
      applyRule(candidate, 'Caution', renalReason(candidate.name, egfr), {
        type: 'renal',
        egfr,
      })
    }

    if (cnsAgents.length > 0) {
      applyRule(
        candidate,
        'Caution',
        'Concomitant CNS depressant exposure may increase sedation and respiratory-depression risk.',
        { type: 'cns', agents: cnsAgents },
      )
    }

    if (priorAdverseFor(form, candidate.name)) {
      applyRule(
        candidate,
        'Caution',
        `Previous adverse response to ${candidate.name} was recorded. This is a monitoring caution; documented allergy/intolerance remains the hard exclusion source.`,
        { type: 'prior-adverse', opioid: candidate.name },
      )
    }
  }

  return {
    evaluated,
    hepaticAssessment,
    globalAlerts,
    error,
  }
}
