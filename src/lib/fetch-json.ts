export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 90_000
): Promise<{ ok: boolean; status: number; data: T }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const data = (await res.json()) as T;
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Délai dépassé (${Math.round(timeoutMs / 1000)} s) — ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
