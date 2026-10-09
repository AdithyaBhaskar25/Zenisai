import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const candidateKeys = [
    env.GEMINI_API_KEY,
    env.API_KEY,
    env.VITE_GEMINI_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.API_KEY,
  ];
  const geminiApiKey = candidateKeys.find(k => typeof k === 'string' && k.trim() && !k.includes('MY_GEMINI')) || '';

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
    },
    plugins: [
      react(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
