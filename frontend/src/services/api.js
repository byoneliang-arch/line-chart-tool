const API_BASE = import.meta.env.VITE_API_BASE || '/api'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  })

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await response.json() : await response.text()

  if (!response.ok) {
    const error = new Error(data?.error || '请求失败')
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

export function getLines() {
  return request('/lines')
}

export function createLine(payload) {
  return request('/lines', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function updateLine(id, payload) {
  return request(`/lines/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  })
}

export function deleteLine(id) {
  return request(`/lines/${id}`, { method: 'DELETE' })
}

export function getDataPoints(params = {}) {
  const query = new URLSearchParams()
  if (params.lineIds?.length) query.set('line_ids', params.lineIds.join(','))
  if (params.startDate) query.set('start_date', params.startDate)
  if (params.endDate) query.set('end_date', params.endDate)
  return request(`/data-points?${query.toString()}`)
}

export function createDataPoint(payload) {
  return request('/data-points', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function updateDataPoint(id, payload) {
  return request(`/data-points/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  })
}

export function deleteDataPoint(id) {
  return request(`/data-points/${id}`, { method: 'DELETE' })
}

export function buildExportUrl(format, params = {}) {
  const query = new URLSearchParams()
  if (params.lineIds?.length) query.set('line_ids', params.lineIds.join(','))
  if (params.startDate) query.set('start_date', params.startDate)
  if (params.endDate) query.set('end_date', params.endDate)
  return `${API_BASE}/export/${format}?${query.toString()}`
}
