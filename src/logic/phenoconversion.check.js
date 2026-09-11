/**
 * Lightweight local checks for src/logic/phenoconversion.js
 * Run: node src/logic/phenoconversion.check.js
 */

import { applyPhenoconversion, getCYP2D6Inhibition } from './phenoconversion.js'

const NM = 'Normal metabolizer'
const IM = 'Intermediate metabolizer'
const PM = 'Poor metabolizer'

const cases = [
  {
    name: 'AS 2 NM, no inhibitor',
    input: {
      genotypeAvailable: true,
      activityScore: 2,
      predictedPhenotype: NM,
      medications: ['Hydroxyurea'],
    },
    expect: {
      inhibitorExposure: 'None',
      inhibitorFactor: 1,
      adjustedActivityScore: 2,
      functionalPhenotype: NM,
      phenoconversion: false,
      inhibitionRisk: false,
      error: null,
    },
  },
  {
    name: 'AS 2 NM + fluoxetine is Strong',
    input: {
      genotypeAvailable: true,
      activityScore: 2,
      predictedPhenotype: NM,
      medications: ['fluoxetine'],
    },
    expect: {
      inhibitorExposure: 'Strong',
      inhibitorFactor: 0,
      adjustedActivityScore: 0,
      functionalPhenotype: PM,
      phenoconversion: true,
      inhibitionRisk: false,
      error: null,
    },
  },
  {
    name: 'AS 2 NM + paroxetine is Strong',
    input: {
      genotypeAvailable: true,
      activityScore: 2,
      predictedPhenotype: NM,
      medications: ['Paroxetine'],
    },
    expect: {
      inhibitorExposure: 'Strong',
      inhibitorFactor: 0,
      adjustedActivityScore: 0,
      functionalPhenotype: PM,
      phenoconversion: true,
      inhibitionRisk: false,
      error: null,
    },
  },
  {
    name: 'AS 2 NM + bupropion is Strong',
    input: {
      genotypeAvailable: true,
      activityScore: 2,
      predictedPhenotype: NM,
      medications: ['  BUPROPION  '],
    },
    expect: {
      inhibitorExposure: 'Strong',
      inhibitorFactor: 0,
      adjustedActivityScore: 0,
      functionalPhenotype: PM,
      phenoconversion: true,
      inhibitionRisk: false,
      error: null,
    },
  },
  {
    name: 'AS 2 NM + duloxetine is Moderate',
    input: {
      genotypeAvailable: true,
      activityScore: 2,
      predictedPhenotype: NM,
      medications: ['duloxetine'],
    },
    expect: {
      inhibitorExposure: 'Moderate',
      inhibitorFactor: 0.5,
      adjustedActivityScore: 1,
      functionalPhenotype: IM,
      phenoconversion: true,
      inhibitionRisk: false,
      error: null,
    },
  },
  {
    name: 'AS 2 NM + mirabegron is Moderate',
    input: {
      genotypeAvailable: true,
      activityScore: 2,
      predictedPhenotype: NM,
      medications: ['Mirabegron'],
    },
    expect: {
      inhibitorExposure: 'Moderate',
      inhibitorFactor: 0.5,
      adjustedActivityScore: 1,
      functionalPhenotype: IM,
      phenoconversion: true,
      inhibitionRisk: false,
      error: null,
    },
  },
  {
    name: 'AS 0.5 IM + duloxetine remains IM',
    input: {
      genotypeAvailable: true,
      activityScore: 0.5,
      predictedPhenotype: IM,
      medications: ['duloxetine'],
    },
    expect: {
      inhibitorExposure: 'Moderate',
      inhibitorFactor: 0.5,
      adjustedActivityScore: 0.25,
      functionalPhenotype: IM,
      phenoconversion: false,
      inhibitionRisk: false,
      error: null,
    },
  },
  {
    name: 'Genotype unavailable + fluoxetine is inhibition risk, not phenoconversion',
    input: {
      genotypeAvailable: false,
      activityScore: null,
      predictedPhenotype: null,
      medications: ['fluoxetine'],
    },
    expect: {
      inhibitorExposure: 'Strong',
      inhibitorFactor: 0,
      adjustedActivityScore: null,
      functionalPhenotype: null,
      phenoconversion: false,
      inhibitionRisk: true,
      error: null,
    },
  },
  {
    name: 'Genotype unavailable + no inhibitor',
    input: {
      genotypeAvailable: false,
      activityScore: null,
      predictedPhenotype: null,
      medications: ['Hydroxyurea'],
    },
    expect: {
      inhibitorExposure: 'None',
      inhibitorFactor: 1,
      adjustedActivityScore: null,
      functionalPhenotype: null,
      phenoconversion: false,
      inhibitionRisk: false,
      error: null,
    },
  },
  {
    name: 'Duloxetine and fluoxetine: Strong takes precedence',
    input: {
      genotypeAvailable: true,
      activityScore: 2,
      predictedPhenotype: NM,
      medications: ['duloxetine', 'fluoxetine'],
    },
    expect: {
      inhibitorExposure: 'Strong',
      inhibitorFactor: 0,
      adjustedActivityScore: 0,
      functionalPhenotype: PM,
      phenoconversion: true,
      inhibitionRisk: false,
      error: null,
    },
  },
  {
    name: 'Unknown/non-inhibitor medication does not alter activity score',
    input: {
      genotypeAvailable: true,
      activityScore: 2,
      predictedPhenotype: NM,
      medications: ['acetaminophen', 'amiodarone', 'quinidine'],
    },
    expect: {
      inhibitorExposure: 'None',
      inhibitorFactor: 1,
      adjustedActivityScore: 2,
      functionalPhenotype: NM,
      phenoconversion: false,
      inhibitionRisk: false,
      error: null,
    },
  },
  {
    name: 'Genotype available but activityScore null returns error',
    input: {
      genotypeAvailable: true,
      activityScore: null,
      predictedPhenotype: NM,
      medications: ['fluoxetine'],
    },
    expect: {
      adjustedActivityScore: null,
      functionalPhenotype: null,
      phenoconversion: false,
      errorNonEmpty: true,
    },
  },
]

let failed = 0

for (const test of cases) {
  const result = applyPhenoconversion(test.input)
  const problems = []
  const expected = test.expect

  for (const key of [
    'inhibitorExposure',
    'inhibitorFactor',
    'adjustedActivityScore',
    'functionalPhenotype',
    'phenoconversion',
    'inhibitionRisk',
    'error',
  ]) {
    if (Object.prototype.hasOwnProperty.call(expected, key) && result[key] !== expected[key]) {
      problems.push(`${key}: got ${JSON.stringify(result[key])}, expected ${JSON.stringify(expected[key])}`)
    }
  }

  if (expected.errorNonEmpty) {
    if (typeof result.error !== 'string' || result.error.trim() === '') {
      problems.push(`error: expected a non-empty string, got ${JSON.stringify(result.error)}`)
    }
  }

  if (test.input.genotypeAvailable !== true) {
    if (result.functionalPhenotype !== null || result.adjustedActivityScore !== null) {
      problems.push('genotype-unavailable case must not assign a phenotype or adjusted score')
    }
  }

  if (problems.length > 0) {
    failed += 1
    console.log(`FAIL  ${test.name}`)
    problems.forEach((item) => console.log(`      ${item}`))
    console.log(`      result: ${JSON.stringify(result)}`)
  } else {
    console.log(`PASS  ${test.name}`)
  }
}

const mixed = getCYP2D6Inhibition(['duloxetine', 'fluoxetine'])
if (mixed.inhibitorExposure !== 'Strong' || mixed.inhibitorFactor !== 0) {
  failed += 1
  console.log('FAIL  getCYP2D6Inhibition mixed inhibitors')
  console.log(`      result: ${JSON.stringify(mixed)}`)
} else {
  console.log('PASS  getCYP2D6Inhibition mixed inhibitors')
}

const total = cases.length + 1
console.log('')
console.log(`${total - failed} passed, ${failed} failed, ${total} total`)

if (failed > 0) {
  process.exit(1)
}
