/**
 * Assessment form defaults and validation.
 * Source of truth: SCDAid Website Inputs data dictionary.
 * System-derived fields are never stored as clinician inputs.
 */

import { CREATININE_UNITS } from './clinicalLists.js'

export function createRowId(prefix = 'row') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export const EMPTY_FORM = {
  age: '',
  sex: '',
  weight: '',
  bmi: '',
  baselinePainScore: 6,
  vitalSigns: [],
  scdGenotype: '',
  vocHistory: '',
  comorbidities: [],
  serumCreatinine: '',
  creatinineUnit: CREATININE_UNITS[0],
  egfr: '',
  liverTests: [],
  medications: [],
  noBaselineOpioid: false,
  baselineOpioids: [],
  opioidTolerance: '',
  previousResponses: [],
  noKnownAllergy: false,
  allergies: [],
  genotypeAvailable: '',
  allele1: '',
  allele2: '',
  hasCnv: false,
  copyNumber: '',
  duplicatedAllele: '',
}

export function validateForm(form) {
  const errors = {}
  const age = Number(form.age)

  if (form.age === '' || form.age === null) {
    errors.age = 'Age is required.'
  } else if (Number.isNaN(age) || age < 18) {
    errors.age = 'Age must be 18 years or older.'
  } else if (age > 120) {
    errors.age = 'Enter a valid age in years.'
  }

  if (!form.sex) {
    errors.sex = 'Sex is required.'
  }

  if (form.weight === '' || form.weight === null) {
    errors.weight = 'Weight is required.'
  } else if (Number(form.weight) <= 0) {
    errors.weight = 'Weight must be greater than zero.'
  }

  if (form.bmi !== '' && form.bmi !== null && Number(form.bmi) <= 0) {
    errors.bmi = 'BMI must be greater than zero when provided.'
  }

  if (form.baselinePainScore === '' || form.baselinePainScore === null) {
    errors.baselinePainScore = 'Baseline pain score is required.'
  } else if (Number(form.baselinePainScore) < 0 || Number(form.baselinePainScore) > 10) {
    errors.baselinePainScore = 'Pain score must be between 0 and 10.'
  }

  if (form.egfr === '' || form.egfr === null) {
    errors.egfr = 'eGFR is required for renal safety assessment.'
  } else if (Number(form.egfr) < 0) {
    errors.egfr = 'Enter a valid eGFR.'
  }

  if (!form.medications.length) {
    errors.medications = 'Enter at least one current medication.'
  }

  if (!form.noBaselineOpioid) {
    const complete = form.baselineOpioids.some((row) => row.drug?.trim())
    if (!complete) {
      errors.baselineOpioids = 'Add baseline opioid therapy or select “No baseline opioid therapy”.'
    }
  }

  if (!form.opioidTolerance) {
    errors.opioidTolerance = 'Opioid tolerance is required.'
  }

  const incompletePrior = form.previousResponses.some(
    (row) => row.opioid?.trim() && !row.response,
  )
  if (incompletePrior) {
    errors.previousResponses = 'Select a previous response for each listed opioid.'
  }

  if (!form.noKnownAllergy) {
    const complete = form.allergies.some((row) => row.drug?.trim())
    if (!complete) {
      errors.allergies = 'Record allergy / intolerance or select “No known opioid allergy/intolerance”.'
    }
  }

  if (!form.genotypeAvailable) {
    errors.genotypeAvailable = 'Indicate whether CYP2D6 genotype is available.'
  }

  if (form.genotypeAvailable === 'Yes') {
    if (!form.allele1) errors.allele1 = 'CYP2D6 star allele 1 is required.'
    if (!form.allele2) errors.allele2 = 'CYP2D6 star allele 2 is required.'
  }

  return errors
}

export function countCompletedSections(form) {
  const sections = [
    Boolean(form.age && form.sex && form.weight && form.baselinePainScore !== ''),
    Boolean(form.egfr !== ''),
    Boolean(
      form.medications.length > 0 &&
        form.opioidTolerance &&
        (form.noBaselineOpioid || form.baselineOpioids.some((row) => row.drug)) &&
        (form.noKnownAllergy || form.allergies.some((row) => row.drug)),
    ),
    Boolean(
      form.genotypeAvailable === 'No' ||
        (form.genotypeAvailable === 'Yes' && form.allele1 && form.allele2),
    ),
  ]
  return sections.filter(Boolean).length
}
