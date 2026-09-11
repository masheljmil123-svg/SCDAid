/**
 * Lightweight local checks for src/logic/cyp2d6.js
 * Run: node src/logic/cyp2d6.check.js
 */

import { calculateCYP2D6ActivityScore } from './cyp2d6.js'

const cases = [
  {
    name: '*1 / *1',
    input: { allele1: '*1', allele2: '*1' },
    expect: { activityScore: 2, predictedPhenotype: 'Normal metabolizer', error: null },
  },
  {
    name: '*4 / *4',
    input: { allele1: '*4', allele2: '*4' },
    expect: { activityScore: 0, predictedPhenotype: 'Poor metabolizer', error: null },
  },
  {
    name: '*1 / *41',
    input: { allele1: '*1', allele2: '*41' },
    expect: { activityScore: 1.5, predictedPhenotype: 'Normal metabolizer', error: null },
  },
  {
    name: '*1 / *10',
    input: { allele1: '*1', allele2: '*10' },
    expect: { activityScore: 1.25, predictedPhenotype: 'Normal metabolizer', error: null },
  },
  {
    name: '*4 / *41',
    input: { allele1: '*4', allele2: '*41' },
    expect: { activityScore: 0.5, predictedPhenotype: 'Intermediate metabolizer', error: null },
  },
  {
    name: '*1 / *1 with copy number 3 and duplicatedAllele *1',
    input: {
      allele1: '*1',
      allele2: '*1',
      hasCnv: true,
      copyNumber: '3',
      duplicatedAllele: '*1',
    },
    expect: { activityScore: 3, predictedPhenotype: 'Ultrarapid metabolizer', error: null },
  },
  {
    name: 'Unknown allele *999',
    input: { allele1: '*1', allele2: '*999' },
    expect: { activityScore: null, predictedPhenotype: null, errorNonEmpty: true },
  },
  {
    name: 'CNV indicated but duplicated allele missing when copy number > 2',
    input: {
      allele1: '*1',
      allele2: '*1',
      hasCnv: true,
      copyNumber: '3',
      duplicatedAllele: '',
    },
    expect: { activityScore: null, predictedPhenotype: null, errorNonEmpty: true },
  },
  {
    name: 'CNV indicated but copy number missing or invalid',
    input: {
      allele1: '*1',
      allele2: '*1',
      hasCnv: true,
      copyNumber: '',
      duplicatedAllele: '*1',
    },
    expect: { activityScore: null, predictedPhenotype: null, errorNonEmpty: true },
  },
  {
    name: '*1 / *1 with copyNumber >4 is indeterminate, not assumed to be 5',
    input: {
      allele1: '*1',
      allele2: '*1',
      hasCnv: true,
      copyNumber: '>4',
      duplicatedAllele: '*1',
    },
    expect: { activityScore: null, predictedPhenotype: null, errorNonEmpty: true },
  },
]

let failed = 0

for (const test of cases) {
  const result = calculateCYP2D6ActivityScore(test.input)
  const problems = []

  if (result.activityScore !== test.expect.activityScore) {
    problems.push(`activityScore: got ${result.activityScore}, expected ${test.expect.activityScore}`)
  }

  if (result.predictedPhenotype !== test.expect.predictedPhenotype) {
    problems.push(
      `predictedPhenotype: got ${result.predictedPhenotype}, expected ${test.expect.predictedPhenotype}`,
    )
  }

  if (test.expect.error === null) {
    if (result.error !== null) {
      problems.push(`error: got ${JSON.stringify(result.error)}, expected null`)
    }
  }

  if (test.expect.errorNonEmpty) {
    if (typeof result.error !== 'string' || result.error.trim() === '') {
      problems.push(`error: expected a non-empty string, got ${JSON.stringify(result.error)}`)
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

console.log('')
console.log(`${cases.length - failed} passed, ${failed} failed, ${cases.length} total`)

if (failed > 0) {
  process.exit(1)
}
