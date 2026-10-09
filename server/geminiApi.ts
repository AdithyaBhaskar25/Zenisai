import type { IncomingMessage, ServerResponse } from 'node:http';

export type JsonRequest = IncomingMessage & { body?: unknown };

export function isSameOriginRequest(request: JsonRequest) {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (typeof origin !== 'string' || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(payload));
}

export async function readJsonBody(request: JsonRequest): Promise<unknown> {
  if (request.body !== undefined) {
    return typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  }

  let body = '';
  for await (const chunk of request) {
    body += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    if (body.length > 8192) throw new Error('Request body is too large.');
  }
  return body ? JSON.parse(body) : {};
}

export function getServerGeminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.API_KEY || '';
}

export function geminiErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/api.?key|unauthorized|permission denied|\b401\b|\b403\b/i.test(message)) {
    return { status: 502, error: 'Gemini rejected the server API key. Check the GEMINI_API_KEY Vercel environment variable and API access.' };
  }
  if (/quota|resource exhausted|\b429\b|rate limit/i.test(message)) {
    return { status: 429, error: 'Gemini quota is exhausted. Check billing and API usage.' };
  }
  return { status: 502, error: 'Gemini could not complete the request. Check server logs and model access.' };
}
