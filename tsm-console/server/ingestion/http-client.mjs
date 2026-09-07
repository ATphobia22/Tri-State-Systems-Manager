const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_BYTES = 2_000_000;
const DEFAULT_RETRIES = 2;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createRequestJson({ fetchImpl = globalThis.fetch, sleepImpl = sleep } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation required');
  return async function requestJson(url, options = {}) {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const retries = options.retries ?? DEFAULT_RETRIES;
    const headers = { accept: 'application/json', ...(options.headers || {}) };
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, { ...options, headers, signal: options.signal ?? controller.signal });
        if (!response.ok) {
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new Error(`HTTP ${response.status}`);
          }
          throw new Error(`HTTP ${response.status}`);
        }
        const length = Number(response.headers.get('content-length') || 0);
        if (length > maxBytes) throw new Error(`response exceeds size limit (${maxBytes} bytes)`);
        const text = await response.text();
        if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new Error(`response exceeds size limit (${maxBytes} bytes)`);
        return JSON.parse(text);
      } catch (error) {
        lastError = error;
        if (attempt >= retries || options.signal?.aborted) break;
        await sleepImpl(250 * (2 ** attempt));
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError;
  };
}

export const requestJson = createRequestJson();
