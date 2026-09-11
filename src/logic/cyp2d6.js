/**
 * Rule-based CYP2D6 pharmacogenomic logic.
 * This module is not machine learning and is independent of React UI code.
 *
 * Unknown alleles are NOT treated as normal-function alleles.
 * Copy-number variation is handled through copyNumber + duplicatedAllele,
 * not through synthetic allele names such as *1xN or *2xN.
 */

export const CYP2D6_ALLELE_ACTIVITY = {
  '*1': 1,
  '*2': 1,
  '*3': 0,
  '*4': 0,
  '*5': 0,
  '*6': 0,
  '*9': 0.5,
  '*10': 0.25,
  '*17': 0.5,
  '*29': 0.5,
  '*35': 1,
  '*41': 0.5,
}

function isEmptyAllele(allele) {
  return allele === null || allele === undefined || String(allele).trim() === ''
}

/**
 * Returns the CPIC activity value for a known CYP2D6 star allele.
 * Empty and unknown alleles return null — they must never default to 1.
 */
export function getAlleleActivity(allele) {
  if (isEmptyAllele(allele)) return null

  const key = String(allele).trim()
  if (!Object.prototype.hasOwnProperty.call(CYP2D6_ALLELE_ACTIVITY, key)) {
    return null
  }

  return CYP2D6_ALLELE_ACTIVITY[key]
}

/**
 * Maps a CYP2D6 activity score to a genotype-predicted phenotype.
 */
export function phenotypeFromActivityScore(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return null
  }

  const value = Number(score)
  if (value < 0) return null
  if (value === 0) return 'Poor metabolizer'
  if (value > 0 && value < 1.25) return 'Intermediate metabolizer'
  if (value >= 1.25 && value <= 2.25) return 'Normal metabolizer'
  if (value > 2.25) return 'Ultrarapid metabolizer'

  return null
}

/**
 * Parses exact copy-number values as stored by the existing assessment form:
 * '1' | '2' | '3' | '4', plus numeric equivalents.
 * '>4' is not an exact copy number and must not be converted to 5.
 */
function parseCopyNumber(copyNumber) {
  if (copyNumber === null || copyNumber === undefined || String(copyNumber).trim() === '') {
    return null
  }

  const raw = String(copyNumber).trim()

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function isIndeterminateCopyNumber(copyNumber) {
  return String(copyNumber ?? '').trim() === '>4'
}

/**
 * Calculates CYP2D6 activity score and genotype-predicted phenotype.
 *
 * CNV is applied separately: extra copies = copyNumber - 2, then
 * extraCopies × activity(duplicatedAllele). This avoids double-counting
 * copy-number variation that would occur if *NxN-style alleles were used.
 */
export function calculateCYP2D6ActivityScore({
  allele1,
  allele2,
  hasCnv,
  copyNumber,
  duplicatedAllele,
} = {}) {
  const activity1 = getAlleleActivity(allele1)
  const activity2 = getAlleleActivity(allele2)

  if (activity1 === null || activity2 === null) {
    return {
      activityScore: null,
      predictedPhenotype: null,
      error:
        'CYP2D6 activity score cannot be calculated because one or both star alleles are missing or unknown. Unknown alleles are not assumed to have normal function.',
    }
  }

  let activityScore = activity1 + activity2

  if (hasCnv === true) {
    // >4 means the exact copy number is unknown. Do not assume 5.
    if (isIndeterminateCopyNumber(copyNumber)) {
      return {
        activityScore: null,
        predictedPhenotype: null,
        error:
          'Exact CYP2D6 activity score cannot be calculated because copy number is reported as >4 rather than an exact value.',
      }
    }

    const copies = parseCopyNumber(copyNumber)

    // Do not silently continue if CNV is indicated but copy number is missing/invalid.
    if (copies === null) {
      return {
        activityScore: null,
        predictedPhenotype: null,
        error:
          'Copy-number variation was indicated, but copyNumber is missing or invalid. Activity score cannot be calculated without a usable copy number.',
      }
    }

    if (copies > 2) {
      if (isEmptyAllele(duplicatedAllele)) {
        return {
          activityScore: null,
          predictedPhenotype: null,
          error:
            'Copy-number variation was indicated (copyNumber > 2), but duplicatedAllele is missing. CNV is handled through copyNumber + duplicatedAllele, not synthetic *NxN allele names.',
        }
      }

      const duplicatedActivity = getAlleleActivity(duplicatedAllele)
      if (duplicatedActivity === null) {
        return {
          activityScore: null,
          predictedPhenotype: null,
          error:
            'Copy-number variation cannot be applied because duplicatedAllele is unknown. Unknown alleles are not assumed to have normal function.',
        }
      }

      const extraCopies = copies - 2
      activityScore += extraCopies * duplicatedActivity
    }
  }

  activityScore = Number(activityScore.toFixed(2))

  return {
    activityScore,
    predictedPhenotype: phenotypeFromActivityScore(activityScore),
    error: null,
  }
}
