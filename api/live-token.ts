import type { ServerResponse } from 'node:http';
import { CONTROL_PLAYBACK_FUNCTIONS, GEMINI_SYSTEM_INSTRUCTION } from '../services/geminiService';
import { getServerGeminiApiKey, geminiErrorResponse, isSameOriginRequest, sendJson, type JsonRequest } from '../server/geminiApi';

const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

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
    sendJson(response, 503, { error: 'Gemini is not configured. Add GEMINI_API_KEY to the Vercel environment variables.' });
    return;
  }

  try {
    const tokenResponse = await fetch('https://generativelanguage.googleapis.com/v1alpha/authTokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: ['AUDIO'],
            systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
            tools: [{ functionDeclarations: CONTROL_PLAYBACK_FUNCTIONS }],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          },
        },
      }),
    });
    const payload = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || typeof payload.name !== 'string') {
      console.error('Gemini ephemeral token request failed', tokenResponse.status, payload.error?.status || payload.error?.message);
      const failure = geminiErrorResponse(new Error(`${tokenResponse.status} ${payload.error?.status || ''}`));
      sendJson(response, failure.status, { error: failure.error });
      return;
    }
    sendJson(response, 200, { token: payload.name });
  } catch (error) {
    console.error('Gemini ephemeral token request failed', error);
    const failure = geminiErrorResponse(error);
    sendJson(response, failure.status, { error: failure.error });
  }
}
