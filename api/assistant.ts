import { GoogleGenAI } from '@google/genai';
import type { ServerResponse } from 'node:http';
import { CONTROL_PLAYBACK_FUNCTIONS, GEMINI_SYSTEM_INSTRUCTION } from '../services/geminiService';
import { getServerGeminiApiKey, geminiErrorResponse, isSameOriginRequest, readJsonBody, sendJson, type JsonRequest } from '../server/geminiApi';

export default async function handler(request: JsonRequest, response: ServerResponse) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }
  if (!isSameOriginRequest(request)) {
    sendJson(response, 403, { error: 'Cross-origin Assistant requests are not allowed.' });
    return;
  }

  const apiKey = getServerGeminiApiKey();
  if (!apiKey) {
    sendJson(response, 503, { error: 'Gemini assistant is not configured. GEMINI_API_KEY environment variable is missing.' });
    return;
  }

  try {
    const body = await readJsonBody(request) as { message?: unknown };
    if (typeof body?.message !== 'string' || !body.message.trim()) {
      sendJson(response, 400, { error: 'A message is required.' });
      return;
    }
    if (body.message.length > 4000) {
      sendJson(response, 413, { error: 'Message is too long. Keep it under 4000 characters.' });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    let result;
    try {
      result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: body.message,
        config: {
          systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: CONTROL_PLAYBACK_FUNCTIONS }],
        },
      });
    } catch (modelErr) {
      console.warn('Falling back to gemini-3.8-flash for assistant:', modelErr);
      result = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: body.message,
        config: {
          systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: CONTROL_PLAYBACK_FUNCTIONS }],
        },
      });
    }

    sendJson(response, 200, { text: result.text ?? '', functionCalls: result.functionCalls ?? [] });
  } catch (error) {
    console.error('Gemini assistant request failed', error);
    const failure = geminiErrorResponse(error);
    sendJson(response, failure.status, { error: failure.error });
  }
}
