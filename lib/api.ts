export async function apiJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  const text = await res.text()
  // mēģinām parsēt vienmēr (mūsu API vienmēr sūta JSON)
  let json: any
  try { json = text ? JSON.parse(text) : {} } catch {
    throw new Error(`Bad JSON from ${String(input)}: ${text.slice(0, 200)}`)
  }
  if (!res.ok) {
    throw new Error(json?.error || `HTTP ${res.status}`)
  }
  return json as T
}
