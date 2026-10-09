
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

export const GEMINI_SYSTEM_INSTRUCTION = "You are Zenisai, a concise AI music assistant. You can control playback, search and play songs, recommend music, manage favorites, and create playlists. When asked to play a song use searchAndPlay. Use recommendSongs when the user asks for suggestions without asking to play. Use favoriteSong for a named song and addSongToPlaylist for a named song and playlist. Keep responses brief and accurate.";

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
    name: 'recommendSongs',
    description: 'Find and recommend songs matching a genre, artist, mood, or description without starting playback.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'A genre, artist, mood, or music description to search for.' }
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
    name: 'favoriteSong',
    description: 'Find a song by title or artist and add it to favorites.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'The song title or artist to favorite.' }
      },
      required: ['query']
    }
  },
  {
    name: 'addSongToPlaylist',
    description: 'Find a song and add it to a named playlist, creating that playlist if necessary.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'The song title or artist to add.' },
        playlistName: { type: Type.STRING, description: 'The destination playlist name.' }
      },
      required: ['query', 'playlistName']
    }
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
  const response = await fetch('/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Assistant request failed (${response.status}).`);
  return { text: payload.text as string | undefined, functionCalls: payload.functionCalls as Array<{ name: string; args: Record<string, unknown> }> | undefined };
};
