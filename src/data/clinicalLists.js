/**
 * Configurable clinical option lists.
 * Exact final lists are not finalized in the Website Inputs dictionary.
 * Extend these arrays without redesigning the form UI.
 */

export const SEX_OPTIONS = ['Male', 'Female']

/** SCD genotype — distinct from CYP2D6 genotype. List is extendable. */
export const SCD_GENOTYPE_OPTIONS = ['HbSS', 'HbSC', 'Other']

export const PAIN_SCORE_MIN = 0
export const PAIN_SCORE_MAX = 10

export const CREATININE_UNITS = ['mg/dL', 'µmol/L']

/** Suggestion seeds only — not a fixed vital-sign specification. */
export const VITAL_SIGN_SUGGESTIONS = [
  'Heart rate',
  'Blood pressure',
  'Respiratory rate',
  'SpO₂',
  'Temperature',
]

export const VITAL_SIGN_UNITS = ['bpm', 'mmHg', 'breaths/min', '%', '°C', '°F']

/** Suggestion seeds only — not a claim that AST/ALT are the only LFTs. */
export const LIVER_TEST_SUGGESTIONS = [
  'AST',
  'ALT',
  'ALP',
  'Total bilirubin',
  'Direct bilirubin',
  'Albumin',
  'INR',
]

export const LIVER_TEST_UNITS = ['U/L', 'mg/dL', 'µmol/L', 'g/dL', 'g/L']

/** Configurable comorbidity list — not a final disease catalog. */
export const COMORBIDITY_SUGGESTIONS = [
  'Chronic kidney disease',
  'Heart failure',
  'Asthma',
  'COPD',
  'Obstructive sleep apnea',
  'Depression',
  'Anxiety',
  'Chronic pain',
  'Liver disease',
  'Stroke / CVA',
  'Pulmonary hypertension',
  'Avascular necrosis',
]

export const MEDICATION_SUGGESTIONS = [
  'Morphine',
  'Hydromorphone',
  'Fentanyl',
  'Oxycodone',
  'Hydrocodone',
  'Codeine',
  'Tramadol',
  'Methadone',
  'Hydroxyurea',
  'Voxelotor',
  'Crizanlizumab',
  'Deferasirox',
  'Folic acid',
  'Penicillin V',
  'Fluoxetine',
  'Paroxetine',
  'Bupropion',
  'Duloxetine',
  'Quinidine',
  'Amiodarone',
  'Terbinafine',
  'Diphenhydramine',
  'Lorazepam',
  'Diazepam',
  'Clonazepam',
  'Gabapentin',
  'Pregabalin',
  'Ondansetron',
  'Ketorolac',
  'Ibuprofen',
  'Acetaminophen',
]

export const OPIOID_OPTIONS = [
  'Morphine',
  'Hydromorphone',
  'Fentanyl',
  'Oxycodone',
  'Hydrocodone',
  'Codeine',
  'Tramadol',
  'Methadone',
  'Other',
]

export const ROUTE_OPTIONS = ['IV', 'Oral', 'Subcutaneous', 'Transdermal', 'Intranasal', 'Other']

export const PREVIOUS_RESPONSE_OPTIONS = ['Favorable', 'Inadequate', 'Adverse', 'Unknown']

/** CPIC-supported CYP2D6 star-allele notation. Extend as the allele panel is finalized. */
export const CYP2D6_ALLELE_OPTIONS = [
  '*1',
  '*2',
  '*3',
  '*4',
  '*5',
  '*6',
  '*9',
  '*10',
  '*17',
  '*29',
  '*35',
  '*41',
]

export const COPY_NUMBER_OPTIONS = ['1', '2', '3', '4', '>4']
