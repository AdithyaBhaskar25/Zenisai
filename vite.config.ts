import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import assistantHandler from './api/assistant';
import liveTokenHandler from './api/live-token';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const geminiApiKey = env.GEMINI_API_KEY || env.API_KEY;

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      {
        name: 'zenisai-local-api',
        configureServer(server) {
          if (geminiApiKey) process.env.GEMINI_API_KEY = geminiApiKey;
          server.middlewares.use((request, response, next) => {
            const pathname = request.url?.split('?')[0];
            const handler = pathname === '/api/assistant' ? assistantHandler : pathname === '/api/live-token' ? liveTokenHandler : null;
            if (!handler) return next();
            void handler(request, response).catch(error => {
              console.error('Local Gemini API route failed', error);
              if (!response.headersSent) {
                response.statusCode = 500;
                response.setHeader('Content-Type', 'application/json; charset=utf-8');
                response.end(JSON.stringify({ error: 'Assistant request failed.' }));
              }
            });
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
