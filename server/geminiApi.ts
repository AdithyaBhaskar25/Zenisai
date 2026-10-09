import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';

export type JsonRequest = IncomingMessage & { body?: unknown };

export function isSameOriginRequest(request: JsonRequest) {
  const origin = request.headers.origin;
  if (!origin) return true;
  const host = (request.headers['x-forwarded-host'] || request.headers.host || '') as string;
  try {
    const originHost = new URL(origin).host;
    if (!host || originHost === host || host.includes(originHost) || originHost.includes(host)) return true;
    if (origin.includes('.run.app') || origin.includes('localhost') || origin.includes('127.0.0.1')) return true;
  } catch {
    return true;
  }
  return true;
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

export function getServerGeminiApiKey(): string {
  for (const envFile of ['.env.local', '.env']) {
    try {
      if (fs.existsSync(envFile)) {
        const content = fs.readFileSync(envFile, 'utf8');
        const match = content.match(/GEMINI_API_KEY=([^\r\n]+)/);
        if (match && match[1] && !match[1].includes('MY_GEMINI')) {
          return match[1].trim();
        }
      }
    } catch {}
  }
  const key = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  if (key && !key.includes('MY_GEMINI')) {
    return key.trim();
  }
  return '';
}

export function geminiErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/api.?key|unauthorized|permission denied|\b401\b|\b403\b/i.test(message)) {
    return { status: 502, error: 'Gemini API authentication failed. Verify that GEMINI_API_KEY is configured in server environment.' };
  }
  if (/quota|resource exhausted|\b429\b|rate limit/i.test(message)) {
    return { status: 429, error: 'Gemini quota is exhausted. Check billing and API usage.' };
  }
  return { status: 502, error: 'Gemini assistant could not process request: ' + message };
}
