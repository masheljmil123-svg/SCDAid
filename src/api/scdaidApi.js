const DEFAULT_API_PORT = '8000'

export function apiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL
  if (typeof configured === 'string' && configured.trim()) {
    return configured.replace(/\/$/, '')
  }
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') {
      return `http://${host}:${DEFAULT_API_PORT}`
    }
  }
  return ''
}

export function googleLoginUrl() {
  const base = apiBaseUrl()
  return base ? `${base}/auth/google/login` : ''
}

async function readError(response) {
  let detail = `HTTP ${response.status}`
  try {
    const body = await response.json()
    detail = body.detail ? JSON.stringify(body.detail) : detail
  } catch {
    detail = (await response.text()) || detail
  }
  return detail
}

export async function fetchCurrentUser() {
  const base = apiBaseUrl()
  if (!base) {
    return { authenticated: false, user: null }
  }
  const response = await fetch(`${base}/auth/me`, {
    method: 'GET',
    credentials: 'include',
  })
  if (!response.ok) {
    return { authenticated: false, user: null }
  }
  return response.json()
}

export async function logoutCurrentUser() {
  const base = apiBaseUrl()
  if (!base) {
    return { ok: true, authenticated: false }
  }
  const response = await fetch(`${base}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error(await readError(response))
  }
  return response.json()
}

export async function predictTreatmentResponse(payload) {
  const base = apiBaseUrl()
  if (!base) {
    throw new Error('SCDAid API URL is not configured. Set VITE_API_BASE_URL for this deployment.')
  }
  const response = await fetch(`${base}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`ML prediction service error: ${await readError(response)}`)
  }

  return response.json()
}
