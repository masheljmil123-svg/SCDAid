/**
 * Rule-based CYP2D6 inhibitor assessment and phenoconversion.
 * This module is not machine learning and is independent of React UI code.
 *
 * Inhibitor classifications are explicit. Weak or unclassified medications
 * do not change the activity score. Strength is never inferred from drug
 * class or name similarity.
 *
 * derivedFlags.js is a frontend mock and is not used here. Quinidine,
 * terbinafine, and amiodarone from that mock list are intentionally omitted
 * until they are added as explicit, traceable classifications.
 */

import { phenotypeFromActivityScore } from './cyp2d6.js'

/** Explicit strong CYP2D6 inhibitors. Factor = 0. */
export const STRONG_CYP2D6_INHIBITORS = ['fluoxetine', 'paroxetine', 'bupropion']

/** Explicit moderate CYP2D6 inhibitors. Factor = 0.5. */
export const MODERATE_CYP2D6_INHIBITORS = ['duloxetine', 'mirabegron']

function normalizeDrugName(name) {
  return String(name ?? '').trim().toLowerCase()
}

function matchAgents(medications, catalog) {
  const allowed = new Set(catalog.map(normalizeDrugName))
  const hits = []

  for (const item of medications || []) {
    const normalized = normalizeDrugName(item)
    if (!normalized) continue
    if (allowed.has(normalized) && !hits.includes(item)) {
      hits.push(item)
    }
  }

  return hits
}

/**
 * Inspects the current medication list for explicit CYP2D6 inhibitors.
 * Strong exposure takes precedence over moderate. Factors are never multiplied.
 */
export function getCYP2D6Inhibition(medications = []) {
  const strongAgents = matchAgents(medications, STRONG_CYP2D6_INHIBITORS)
  const moderateAgents = matchAgents(medications, MODERATE_CYP2D6_INHIBITORS)

  if (strongAgents.length > 0) {
    return {
      inhibitorExposure: 'Strong',
      inhibitorFactor: 0,
      inhibitorAgents: strongAgents,
    }
  }

  if (moderateAgents.length > 0) {
    return {
      inhibitorExposure: 'Moderate',
      inhibitorFactor: 0.5,
      inhibitorAgents: moderateAgents,
    }
  }

  return {
    inhibitorExposure: 'None',
    inhibitorFactor: 1,
    inhibitorAgents: [],
  }
}

function emptyPhenoconversionResult(inhibition, extra = {}) {
  return {
    inhibitorExposure: inhibition.inhibitorExposure,
    inhibitorFactor: inhibition.inhibitorFactor,
    inhibitorAgents: inhibition.inhibitorAgents,
    adjustedActivityScore: null,
    functionalPhenotype: null,
    phenoconversion: false,
    inhibitionRisk: false,
    error: null,
    ...extra,
  }
}

/**
 * Applies inhibitor-based phenoconversion to a genotype-predicted CYP2D6 score.
 * If genotype is unavailable, medications are still screened for functional
 * inhibition risk, but no phenotype is assigned.
 */
export function applyPhenoconversion({
  genotypeAvailable,
  activityScore,
  predictedPhenotype,
  medications,
} = {}) {
  const inhibition = getCYP2D6Inhibition(medications)
  const relevantInhibitor = inhibition.inhibitorExposure !== 'None'

  if (genotypeAvailable !== true) {
    return emptyPhenoconversionResult(inhibition, {
      inhibitionRisk: relevantInhibitor,
    })
  }

  const scoreMissing = activityScore === null || activityScore === undefined || Number.isNaN(Number(activityScore))
  const phenotypeMissing = !predictedPhenotype

  if (scoreMissing || phenotypeMissing) {
    return emptyPhenoconversionResult(inhibition, {
      error:
        'Phenoconversion cannot be applied because the genotype-predicted CYP2D6 activity score or phenotype is missing. An incomplete genotype or CNV result is not treated as a usable inherited phenotype.',
    })
  }

  const numericScore = Number(activityScore)
  const adjustedActivityScore = Number((numericScore * inhibition.inhibitorFactor).toFixed(2))
  const functionalPhenotype = phenotypeFromActivityScore(adjustedActivityScore)

  return {
    inhibitorExposure: inhibition.inhibitorExposure,
    inhibitorFactor: inhibition.inhibitorFactor,
    inhibitorAgents: inhibition.inhibitorAgents,
    adjustedActivityScore,
    functionalPhenotype,
    phenoconversion: functionalPhenotype !== predictedPhenotype,
    inhibitionRisk: false,
    error: null,
  }
}
