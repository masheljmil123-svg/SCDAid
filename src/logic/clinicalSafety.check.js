/**
 * Lightweight local checks for src/logic/clinicalSafety.js
 * Run: node src/logic/clinicalSafety.check.js
 */

import { CANDIDATE_OPIOIDS, evaluateOpioidSafety } from './clinicalSafety.js'

function pick(evaluated, name) {
  return evaluated.find((item) => item.name === name)
}

function hasRenalFlag(candidate) {
  return (candidate.safetyFlags || []).some((flag) => flag.type === 'renal')
}

function hasFlag(candidate, type) {
  return (candidate.safetyFlags || []).some((flag) => flag.type === type)
}

function nmPgx() {
  return {
    genotypeAvailable: true,
    predictedPhenotype: 'Normal metabolizer',
    functionalPhenotype: 'Normal metabolizer',
    inhibitionRisk: null,
    inhibitorExposure: 'None',
  }
}

function baseForm(overrides = {}) {
  return {
    noKnownAllergy: true,
    allergies: [],
    medications: [],
    liverTests: [],
    previousResponses: [],
    opioidTolerance: '',
    egfr: '90',
    ...overrides,
  }
}

function assert(problems, condition, message) {
  if (!condition) problems.push(message)
}

const cases = [
  {
    name: 'Normal renal function, no allergy, NM → all opioids have no renal restriction',
    run() {
      const result = evaluateOpioidSafety({ form: baseForm({ egfr: '90' }), pgx: nmPgx() })
      const problems = []
      assert(problems, result.error === null, `error should be null, got ${result.error}`)
      assert(
        problems,
        result.evaluated.length === 6,
        `expected 6 opioids, got ${result.evaluated.length}`,
      )
      for (const name of CANDIDATE_OPIOIDS) {
        const item = pick(result.evaluated, name)
        assert(problems, item, `missing ${name}`)
        assert(problems, !hasRenalFlag(item), `${name} should have no renal restriction`)
        assert(
          problems,
          item.eligibility === 'Eligible',
          `${name} eligibility: got ${item.eligibility}, expected Eligible`,
        )
      }
      return { problems, result }
    },
  },
  {
    name: 'Codeine + CYP2D6 PM → Avoid',
    run() {
      const result = evaluateOpioidSafety({
        form: baseForm(),
        pgx: {
          genotypeAvailable: true,
          predictedPhenotype: 'Poor metabolizer',
          functionalPhenotype: 'Poor metabolizer',
        },
      })
      const codeine = pick(result.evaluated, 'Codeine')
      const morphine = pick(result.evaluated, 'Morphine')
      const problems = []
      assert(
        problems,
        codeine.eligibility === 'Avoid / Not recommended',
        `Codeine eligibility: got ${codeine.eligibility}`,
      )
      assert(problems, hasFlag(codeine, 'pgx'), 'Codeine should carry a PGx flag')
      assert(
        problems,
        morphine.eligibility === 'Eligible',
        `Morphine should not receive a CYP2D6 restriction, got ${morphine.eligibility}`,
      )
      return { problems, result }
    },
  },
  {
    name: 'Tramadol + CYP2D6 UM → Avoid',
    run() {
      const result = evaluateOpioidSafety({
        form: baseForm(),
        pgx: {
          genotypeAvailable: true,
          predictedPhenotype: 'Ultrarapid metabolizer',
          functionalPhenotype: 'Ultrarapid metabolizer',
        },
      })
      const tramadol = pick(result.evaluated, 'Tramadol')
      const fentanyl = pick(result.evaluated, 'Fentanyl')
      const oxycodone = pick(result.evaluated, 'Oxycodone')
      const problems = []
      assert(
        problems,
        tramadol.eligibility === 'Avoid / Not recommended',
        `Tramadol eligibility: got ${tramadol.eligibility}`,
      )
      assert(
        problems,
        fentanyl.eligibility === 'Eligible',
        `Fentanyl should not receive a CYP2D6 restriction, got ${fentanyl.eligibility}`,
      )
      assert(
        problems,
        oxycodone.eligibility === 'Eligible',
        `Oxycodone should not receive a CYP2D6 dose/eligibility change, got ${oxycodone.eligibility}`,
      )
      return { problems, result }
    },
  },
  {
    name: 'Codeine + CYP2D6 IM → Caution',
    run() {
      const result = evaluateOpioidSafety({
        form: baseForm(),
        pgx: {
          genotypeAvailable: true,
          predictedPhenotype: 'Intermediate metabolizer',
          functionalPhenotype: 'Intermediate metabolizer',
        },
      })
      const codeine = pick(result.evaluated, 'Codeine')
      const problems = []
      assert(
        problems,
        codeine.eligibility === 'Caution',
        `Codeine eligibility: got ${codeine.eligibility}`,
      )
      assert(
        problems,
        codeine.reasons.some((reason) => /reduced/i.test(reason) && /monitor/i.test(reason)),
        `Codeine IM reason missing reduced-response/monitoring language: ${codeine.reasons.join(' | ')}`,
      )
      return { problems, result }
    },
  },
  {
    name: 'Genotype unavailable + strong CYP2D6 inhibitor → Codeine and Tramadol Caution, no phenotype invented',
    run() {
      const result = evaluateOpioidSafety({
        form: baseForm(),
        pgx: {
          genotypeAvailable: false,
          predictedPhenotype: null,
          functionalPhenotype: null,
          inhibitionRisk: {
            title: 'CYP2D6 inhibition risk',
            message: 'Strong inhibitor present.',
          },
          inhibitorExposure: 'Strong',
          inhibitorAgents: ['fluoxetine'],
        },
      })
      const codeine = pick(result.evaluated, 'Codeine')
      const tramadol = pick(result.evaluated, 'Tramadol')
      const morphine = pick(result.evaluated, 'Morphine')
      const problems = []
      assert(
        problems,
        codeine.eligibility === 'Caution',
        `Codeine eligibility: got ${codeine.eligibility}`,
      )
      assert(
        problems,
        tramadol.eligibility === 'Caution',
        `Tramadol eligibility: got ${tramadol.eligibility}`,
      )
      assert(
        problems,
        morphine.eligibility === 'Eligible',
        `Morphine should remain Eligible, got ${morphine.eligibility}`,
      )
      assert(
        problems,
        codeine.reasons.every((reason) => !/poor metabolizer|ultrarapid|intermediate metabolizer|normal metabolizer/i.test(reason)),
        `Codeine should not invent a phenotype: ${codeine.reasons.join(' | ')}`,
      )
      assert(
        problems,
        codeine.reasons.some((reason) => /not a genetically predicted phenotype/i.test(reason)),
        'Codeine should state that no genetically predicted phenotype was assigned',
      )
      return { problems, result }
    },
  },
  {
    name: 'Morphine allergy → Morphine Avoid only; do not automatically exclude all opioids',
    run() {
      const result = evaluateOpioidSafety({
        form: baseForm({
          noKnownAllergy: false,
          allergies: [{ id: 'a1', drug: 'Morphine', reaction: 'Rash' }],
        }),
        pgx: nmPgx(),
      })
      const problems = []
      for (const name of CANDIDATE_OPIOIDS) {
        const item = pick(result.evaluated, name)
        if (name === 'Morphine') {
          assert(
            problems,
            item.eligibility === 'Avoid / Not recommended',
            `Morphine eligibility: got ${item.eligibility}`,
          )
          assert(
            problems,
            item.reasons.includes('Documented allergy or intolerance to this opioid.'),
            'Morphine allergy reason missing',
          )
        } else {
          assert(
            problems,
            item.eligibility !== 'Avoid / Not recommended',
            `${name} should not be auto-excluded by Morphine allergy, got ${item.eligibility}`,
          )
        }
      }
      return { problems, result }
    },
  },
  {
    name: 'eGFR 45 → Morphine/Hydromorphone/Oxycodone/Codeine/Tramadol renal Caution; Fentanyl no renal restriction',
    run() {
      const result = evaluateOpioidSafety({
        form: baseForm({ egfr: '45' }),
        pgx: nmPgx(),
      })
      const renalCaution = ['Morphine', 'Hydromorphone', 'Oxycodone', 'Codeine', 'Tramadol']
      const problems = []
      assert(problems, result.error === null, `error should be null, got ${result.error}`)
      for (const name of renalCaution) {
        const item = pick(result.evaluated, name)
        assert(problems, item.eligibility === 'Caution', `${name} eligibility: got ${item.eligibility}`)
        assert(problems, hasRenalFlag(item), `${name} should have a renal safety flag`)
      }
      const fentanyl = pick(result.evaluated, 'Fentanyl')
      assert(problems, !hasRenalFlag(fentanyl), 'Fentanyl should have no renal restriction')
      assert(
        problems,
        fentanyl.eligibility === 'Eligible',
        `Fentanyl eligibility: got ${fentanyl.eligibility}`,
      )
      return { problems, result }
    },
  },
  {
    name: 'eGFR 20 → severe renal-review caution; Fentanyl still no renal restriction from the renal module',
    run() {
      const result = evaluateOpioidSafety({
        form: baseForm({ egfr: '20' }),
        pgx: nmPgx(),
      })
      const problems = []
      for (const name of ['Morphine', 'Hydromorphone', 'Oxycodone', 'Codeine', 'Tramadol']) {
        const item = pick(result.evaluated, name)
        assert(
          problems,
          item.eligibility === 'Caution',
          `${name} must be Caution not Avoid at eGFR 20, got ${item.eligibility}`,
        )
        assert(
          problems,
          item.reasons.some((reason) =>
            /Severe renal impairment requires drug-specific dosing\/safety review/.test(reason),
          ),
          `${name} missing severe renal-review reason`,
        )
      }
      const tramadol = pick(result.evaluated, 'Tramadol')
      assert(
        problems,
        tramadol.reasons.some((reason) =>
          /Renal dosing is formulation-specific; automatic dose guidance is not issued by this prototype/.test(
            reason,
          ),
        ),
        'Tramadol missing formulation-specific renal wording',
      )
      const fentanyl = pick(result.evaluated, 'Fentanyl')
      assert(problems, !hasRenalFlag(fentanyl), 'Fentanyl should have no renal restriction')
      assert(
        problems,
        fentanyl.eligibility !== 'Avoid / Not recommended',
        `Fentanyl should not be Avoid from renal rules, got ${fentanyl.eligibility}`,
      )
      return { problems, result }
    },
  },
  {
    name: 'CNS depressant medication present → all opioid candidates at least Caution',
    run() {
      const result = evaluateOpioidSafety({
        form: baseForm({ medications: ['Gabapentin'] }),
        pgx: nmPgx(),
      })
      const problems = []
      for (const name of CANDIDATE_OPIOIDS) {
        const item = pick(result.evaluated, name)
        assert(
          problems,
          item.eligibility === 'Caution' || item.eligibility === 'Avoid / Not recommended',
          `${name} should be at least Caution, got ${item.eligibility}`,
        )
        assert(problems, hasFlag(item, 'cns'), `${name} missing CNS safety flag`)
        assert(
          problems,
          item.reasons.includes(
            'Concomitant CNS depressant exposure may increase sedation and respiratory-depression risk.',
          ),
          `${name} missing CNS reason`,
        )
        const cnsFlag = item.safetyFlags.find((flag) => flag.type === 'cns')
        assert(
          problems,
          cnsFlag?.agents?.includes('Gabapentin'),
          `${name} CNS flag should include matched medication name Gabapentin`,
        )
      }
      return { problems, result }
    },
  },
  {
    name: 'Previous inadequate Morphine response alone → must NOT make Morphine Avoid',
    run() {
      const result = evaluateOpioidSafety({
        form: baseForm({
          previousResponses: [{ id: 'r1', opioid: 'Morphine', response: 'Inadequate' }],
        }),
        pgx: nmPgx(),
      })
      const morphine = pick(result.evaluated, 'Morphine')
      const problems = []
      assert(
        problems,
        morphine.eligibility !== 'Avoid / Not recommended',
        `Morphine should not be Avoid from inadequate response, got ${morphine.eligibility}`,
      )
      assert(
        problems,
        morphine.eligibility === 'Eligible',
        `Morphine eligibility should remain Eligible, got ${morphine.eligibility}`,
      )
      return { problems, result }
    },
  },
  {
    name: 'Opioid tolerance alone → must NOT change eligibility to Avoid',
    run() {
      const result = evaluateOpioidSafety({
        form: baseForm({ opioidTolerance: 'Yes' }),
        pgx: nmPgx(),
      })
      const problems = []
      for (const name of CANDIDATE_OPIOIDS) {
        const item = pick(result.evaluated, name)
        assert(
          problems,
          item.eligibility === 'Eligible',
          `${name} should remain Eligible with tolerance alone, got ${item.eligibility}`,
        )
      }
      return { problems, result }
    },
  },
  {
    name: 'Liver test present with an elevated numeric value → hepatic Review required, but no automatic opioid Avoid solely from that lab',
    run() {
      const result = evaluateOpioidSafety({
        form: baseForm({
          liverTests: [{ id: 'lt1', name: 'AST', value: '400', unit: 'U/L' }],
        }),
        pgx: nmPgx(),
      })
      const problems = []
      assert(
        problems,
        result.hepaticAssessment.status === 'Review required',
        `hepatic status: got ${result.hepaticAssessment.status}`,
      )
      for (const name of CANDIDATE_OPIOIDS) {
        const item = pick(result.evaluated, name)
        assert(
          problems,
          item.eligibility !== 'Avoid / Not recommended',
          `${name} must not be Avoid from LFT alone, got ${item.eligibility}`,
        )
        assert(
          problems,
          item.eligibility === 'Eligible',
          `${name} should remain Eligible from LFT alone, got ${item.eligibility}`,
        )
      }
      return { problems, result }
    },
  },
  {
    name: 'No liver test data → hepatic status = No data, not “normal”',
    run() {
      const result = evaluateOpioidSafety({
        form: baseForm({ liverTests: [] }),
        pgx: nmPgx(),
      })
      const problems = []
      assert(
        problems,
        result.hepaticAssessment.status === 'No data',
        `hepatic status: got ${result.hepaticAssessment.status}`,
      )
      assert(
        problems,
        result.hepaticAssessment.status !== 'Normal',
        'hepatic status must not be treated as normal when no liver tests are present',
      )
      assert(
        problems,
        /not assumed to be normal/i.test(result.hepaticAssessment.message || ''),
        `hepatic message should state that normal function is not assumed: ${result.hepaticAssessment.message}`,
      )
      return { problems, result }
    },
  },
  {
    name: 'Multiple rules: Codeine PM + renal impairment → remains Avoid because Avoid overrides Caution',
    run() {
      const result = evaluateOpioidSafety({
        form: baseForm({ egfr: '40' }),
        pgx: {
          genotypeAvailable: true,
          predictedPhenotype: 'Poor metabolizer',
          functionalPhenotype: 'Poor metabolizer',
        },
      })
      const codeine = pick(result.evaluated, 'Codeine')
      const problems = []
      assert(
        problems,
        codeine.eligibility === 'Avoid / Not recommended',
        `Codeine eligibility: got ${codeine.eligibility}`,
      )
      assert(problems, hasRenalFlag(codeine), 'Codeine should still record the renal caution flag')
      assert(problems, hasFlag(codeine, 'pgx'), 'Codeine should still record the PGx Avoid flag')
      return { problems, result }
    },
  },
  {
    name: 'Missing/invalid eGFR → engine returns a clear error rather than assuming normal renal function',
    run() {
      const missing = evaluateOpioidSafety({ form: baseForm({ egfr: '' }), pgx: nmPgx() })
      const invalid = evaluateOpioidSafety({ form: baseForm({ egfr: 'not-a-number' }), pgx: nmPgx() })
      const problems = []
      assert(problems, typeof missing.error === 'string' && missing.error.trim() !== '', 'missing eGFR should return an error')
      assert(problems, typeof invalid.error === 'string' && invalid.error.trim() !== '', 'invalid eGFR should return an error')
      assert(problems, /eGFR/i.test(missing.error), `missing eGFR error should mention eGFR: ${missing.error}`)
      assert(
        problems,
        missing.evaluated.every((item) => !hasRenalFlag(item)),
        'missing eGFR must not assume a renal restriction or normal renal clearance flag',
      )
      assert(
        problems,
        invalid.evaluated.length === 6,
        'all six opioids must still be returned when eGFR is invalid',
      )
      return { problems, result: { missing, invalid } }
    },
  },
]

let failed = 0

for (const test of cases) {
  const { problems } = test.run()
  if (problems.length > 0) {
    failed += 1
    console.log(`FAIL  ${test.name}`)
    problems.forEach((item) => console.log(`      ${item}`))
  } else {
    console.log(`PASS  ${test.name}`)
  }
}

console.log('')
console.log(`${cases.length - failed} passed, ${failed} failed, ${cases.length} total`)

if (failed > 0) {
  process.exit(1)
}
