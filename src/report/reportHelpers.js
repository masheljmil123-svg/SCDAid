import logoDataUrl from '../assets/scdaid-logo.png?inline'
import cellsDataUrl from '../assets/scdaid-bg.png?inline'
import { version as appVersion } from '../../package.json'
import { CANDIDATE_OPIOIDS, CNS_DEPRESSANT_MEDICATIONS } from '../logic/clinicalSafety.js'

export { CANDIDATE_OPIOIDS }

export const APP_VERSION = appVersion

export function getReportImages() {
  return { logo: logoDataUrl, cells: cellsDataUrl }
}

export function isBlank(value) {
  if (value === null || value === undefined) return true
  if (typeof value === 'string' && value.trim() === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

export function displayValue(value, empty = 'Not provided') {
  if (isBlank(value)) return empty
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

export function tableCell(value) {
  return displayValue(value, '—')
}

export function yesNo(value) {
  if (value === 'Yes' || value === true) return 'Yes'
  if (value === 'No' || value === false) return 'No'
  return 'Not provided'
}

export function formatDateTime(iso) {
  const date = iso ? new Date(iso) : new Date()
  if (Number.isNaN(date.getTime())) return 'Not provided'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatDateStamp(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return { ymd: `${y}-${m}-${d}`, hm: `${hh}${mm}`, compact: `${y}${m}${d}${hh}${mm}` }
}

export function existingCaseId(form, result) {
  const candidates = [
    result?.caseId,
    result?.assessmentId,
    form?.caseId,
    form?.assessmentId,
  ]
  const found = candidates.find((value) => !isBlank(value))
  return found ? String(found) : null
}

export function buildReportMeta(form, result) {
  const generated = result?.generatedAt ? new Date(result.generatedAt) : new Date()
  const stamp = formatDateStamp(generated)
  const caseId = existingCaseId(form, result)
  return {
    reportId: `RPT-${stamp.compact}`,
    caseId,
    generated,
    generatedLabel: formatDateTime(generated.toISOString()),
    appVersion: `SCDAid ${APP_VERSION}`,
    ymd: stamp.ymd,
    hm: stamp.hm,
  }
}

export function buildFilename(meta) {
  if (meta.caseId) return `SCDAid_Report_${meta.caseId}_${meta.ymd}.pdf`
  return `SCDAid_Report_${meta.ymd}_${meta.hm}.pdf`
}

export function clinicianLabel(user) {
  const name = user?.full_name && String(user.full_name).trim()
  return name || null
}

export function medicationRows(form, pgx) {
  const medications = form?.medications || []
  if (medications.length === 0) return []

  const inhibitorNames = new Set(
    (pgx?.inhibitorAgents || []).map((item) => String(item).trim().toLowerCase()),
  )
  const cnsNames = new Set(CNS_DEPRESSANT_MEDICATIONS)

  return medications.map((name) => {
    const normalized = String(name || '').trim().toLowerCase()
    const flags = []
    if (inhibitorNames.has(normalized) && pgx?.inhibitorExposure && pgx.inhibitorExposure !== 'None') {
      flags.push(`CYP2D6 ${String(pgx.inhibitorExposure).toLowerCase()} inhibitor`)
    }
    if (cnsNames.has(normalized)) flags.push('CNS depressant')
    return [displayValue(name), flags.length ? flags.join('; ') : '—']
  })
}

export function rankedOpioids(result) {
  const items = result?.evaluated?.length
    ? result.evaluated
    : [result?.preferred, ...(result?.alternatives || [])].filter(Boolean)
  const byName = new Map(items.map((item) => [item.name, item]))
  const ordered = items.filter((item) => CANDIDATE_OPIOIDS.includes(item.name))
  const missing = CANDIDATE_OPIOIDS.filter((name) => !byName.has(name)).map((name) => ({
    name,
    eligibility: 'Not assessed',
    note: 'This candidate was not present in the current assessment output.',
    predictedDeltaPain60: null,
  }))
  return [...ordered, ...missing]
}

export function isAvoidStatus(status) {
  return status === 'Avoid / Not recommended' || status === 'Avoid'
}

export function eligibilityLabel(status) {
  if (isAvoidStatus(status)) return 'Avoid'
  return status || '—'
}

export function predictedDeltaLabel(item) {
  if (isAvoidStatus(item?.eligibility)) return '—'
  if (item?.predictedDeltaPain60 == null || item?.predictedDeltaPain60 === '') return '—'
  const value = Number(item.predictedDeltaPain60)
  if (!Number.isFinite(value)) return '—'
  return `${value.toFixed(2)} points`
}

export function filledRows(rows, mapper) {
  return (rows || [])
    .map(mapper)
    .filter((row) => row.some((cell) => cell && cell !== '—' && cell !== 'Not provided'))
}
