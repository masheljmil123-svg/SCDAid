/**
 * SYSTEM-DERIVED medication flags (frontend mock).
 * These must never be clinician-entered. Replace this module when the
 * interaction / CYP2D6 screening service is connected.
 */

const STRONG_CYP2D6_INHIBITORS = [
  'paroxetine',
  'fluoxetine',
  'bupropion',
  'quinidine',
  'terbinafine',
]

const MODERATE_CYP2D6_INHIBITORS = ['duloxetine', 'amiodarone']

const CNS_DEPRESSANTS = [
  'lorazepam',
  'diazepam',
  'clonazepam',
  'alprazolam',
  'midazolam',
  'zolpidem',
  'gabapentin',
  'pregabalin',
  'diphenhydramine',
  'promethazine',
]

function matchesList(name, list) {
  const normalized = name.trim().toLowerCase()
  return list.find((item) => normalized === item || normalized.includes(item))
}

export function deriveMedicationFlags(medications = []) {
  const names = medications.filter(Boolean)

  const strongHits = names.filter((name) => matchesList(name, STRONG_CYP2D6_INHIBITORS))
  const moderateHits = names.filter((name) => matchesList(name, MODERATE_CYP2D6_INHIBITORS))
  const cnsHits = names.filter((name) => matchesList(name, CNS_DEPRESSANTS))

  let inhibitorExposure = 'None'
  if (strongHits.length > 0) inhibitorExposure = 'Strong'
  else if (moderateHits.length > 0) inhibitorExposure = 'Moderate'

  const interactionAgents = [...new Set([...strongHits, ...moderateHits])]

  return {
    inhibitorExposure,
    inhibitorAgents: inhibitorExposure === 'Strong' ? strongHits : moderateHits,
    interactions: interactionAgents.length > 0 ? 'Detected' : 'None',
    interactionAgents,
    cnsDepressants: cnsHits.length > 0 ? 'Yes' : 'No',
    cnsAgents: cnsHits,
  }
}
