
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

export const CONTROL_PLAYBACK_FUNCTIONS: FunctionDeclaration[] = [
  {
    name: 'togglePlayback',
    description: 'Play or pause the current music.',
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: 'playNext',
    description: 'Skip to the next song in the queue.',
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: 'playPrevious',
    description: 'Go back to the previous song.',
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: 'searchAndPlay',
    description: 'Search for a specific song or artist and play it immediately.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'The song name or artist to search for.' }
      },
      required: ['query']
    }
  },
  {
    name: 'addToFavorites',
    description: 'Add the currently playing song to the favorites collection.',
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: 'removeFromFavorites',
    description: 'Remove the currently playing song from the favorites collection.',
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: 'createPlaylist',
    description: 'Create a new empty playlist with a given name.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'The name of the new playlist.' }
      },
      required: ['name']
    }
  },
  {
    name: 'clearQueue',
    description: 'Remove all songs from the current play queue except the playing one.',
    parameters: { type: Type.OBJECT, properties: {} }
  }
];

export const getGeminiChatResponse = async (message: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: message,
    config: {
      systemInstruction: "You are Zenisai, a powerful AI music assistant. You can control playback, search for songs, manage favorites, and create playlists. When a user asks for a song, use searchAndPlay. When they want to save a song, use addToFavorites. Keep your text responses very brief.",
      tools: [{ functionDeclarations: CONTROL_PLAYBACK_FUNCTIONS }]
    }
  });
  
  return {
    text: response.text,
    functionCalls: response.functionCalls
  };
};
