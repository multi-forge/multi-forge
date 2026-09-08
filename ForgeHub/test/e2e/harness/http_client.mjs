/**
 * SLA-Timed HTTP Client
 * Wraps native fetch with precise latency measurement and JSON handling.
 */

import { config, getBaseURL } from './config.mjs';

/**
 * Execute an HTTP request with latency timing.
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} path - URL path (e.g. '/api/status')
 * @param {object} [options] - Options: headers, body, timeout, baseURL
 * @returns {Promise<{ status: number, statusText: string, headers: Headers, data: any, latencyMs: number, rawBody: string }>}
 */
export async function apiRequest(method, path, options = {}) {
  const baseURL = options.baseURL || getBaseURL();
  const url = `${baseURL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  const timeoutMs = options.timeout || config.requestTimeoutMs;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(options.headers || {});
  let body = options.body;

  if (body && typeof body === 'object' && !(body instanceof Uint8Array) && !(body instanceof FormData)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json; charset=utf-8');
    }
    body = JSON.stringify(body);
  }

  const start = performance.now();
  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;

    const rawBody = await res.text();
    let data = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json') || contentType.includes('+json')) {
      try {
        data = JSON.parse(rawBody);
      } catch (e) {
        data = rawBody;
      }
    } else {
      data = rawBody;
    }

    return {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
      data,
      latencyMs,
      rawBody,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export const http = {
  get: (path, options = {}) => apiRequest('GET', path, options),
  post: (path, body, options = {}) => apiRequest('POST', path, { ...options, body }),
  put: (path, body, options = {}) => apiRequest('PUT', path, { ...options, body }),
  delete: (path, options = {}) => apiRequest('DELETE', path, options),
};
