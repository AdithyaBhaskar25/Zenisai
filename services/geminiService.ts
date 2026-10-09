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

// Client-side natural language music intent parser
function parseLocalMusicIntent(raw: string): { text?: string; functionCalls?: Array<{ name: string; args: Record<string, unknown> }> } {
  const text = raw.trim();
  const lower = text.toLowerCase();

  // Basic playback commands
  if (/^(pause|stop music|pause song|halt|freeze)$/i.test(lower)) {
    return { text: "Paused playback.", functionCalls: [{ name: 'togglePlayback', args: {} }] };
  }
  if (/^(play|resume|resume music|unpause|start music)$/i.test(lower)) {
    return { text: "Resumed playback.", functionCalls: [{ name: 'togglePlayback', args: {} }] };
  }
  if (/^(next|skip|skip track|next song|play next|forward)$/i.test(lower)) {
    return { text: "Skipping to next track.", functionCalls: [{ name: 'playNext', args: {} }] };
  }
  if (/^(prev|previous|previous song|go back|last song|replay)$/i.test(lower)) {
    return { text: "Playing previous track.", functionCalls: [{ name: 'playPrevious', args: {} }] };
  }
  if (/clear (the )?queue/i.test(lower)) {
    return { text: "Cleared queue.", functionCalls: [{ name: 'clearQueue', args: {} }] };
  }

  // Favorite commands
  if (/(add to fav|favorite this|save this song|love this|add current to fav)/i.test(lower)) {
    return { text: "Saved to your favorites ❤️", functionCalls: [{ name: 'addToFavorites', args: {} }] };
  }
  if (/(remove from fav|unfavorite this|unlike this)/i.test(lower)) {
    return { text: "Removed from favorites.", functionCalls: [{ name: 'removeFromFavorites', args: {} }] };
  }
  const favMatch = lower.match(/(?:favorite|add|save)\s+(.+?)\s+(?:to favorites?|to favs?)/i);
  if (favMatch) {
    return { text: `Added "${favMatch[1].trim()}" to favorites ❤️`, functionCalls: [{ name: 'favoriteSong', args: { query: favMatch[1].trim() } }] };
  }

  // Playlist creation & addition
  const createPlMatch = lower.match(/(?:create|make|new)\s+(?:a\s+)?playlist\s+(?:called|named\s+)?["']?(.+?)["']?$/i);
  if (createPlMatch) {
    const plName = createPlMatch[1].trim();
    return { text: `Created playlist "${plName}".`, functionCalls: [{ name: 'createPlaylist', args: { name: plName } }] };
  }

  const addToPlMatch = lower.match(/add\s+(.+?)\s+to\s+(?:playlist\s+)?["']?(.+?)["']?$/i);
  if (addToPlMatch) {
    return {
      text: `Adding "${addToPlMatch[1].trim()}" to playlist "${addToPlMatch[2].trim()}".`,
      functionCalls: [{ name: 'addSongToPlaylist', args: { query: addToPlMatch[1].trim(), playlistName: addToPlMatch[2].trim() } }]
    };
  }

  // Song recommendation
  const recMatch = lower.match(/(?:recommend|suggest|show me|find me some|give me)\s+(?:some\s+)?(.+?)(?:\s+songs|\s+tracks|\s+music)?$/i);
  if (recMatch && !lower.startsWith('play')) {
    const query = recMatch[1].replace(/(songs|tracks|music)$/i, '').trim() || 'trending';
    return {
      text: `Here are recommendations for ${query}:`,
      functionCalls: [{ name: 'recommendSongs', args: { query } }]
    };
  }

  // Play a specific song or artist
  const playMatch = lower.match(/^(?:play|listen to|put on|start|tune to)\s+(?:some\s+)?(.+)/i);
  if (playMatch) {
    const query = playMatch[1].replace(/(songs?|tracks?|music)$/i, '').trim() || playMatch[1].trim();
    return {
      text: `Playing "${query}" for you 🎵`,
      functionCalls: [{ name: 'searchAndPlay', args: { query } }]
    };
  }

  // Common Conversational responses
  if (/who are you|what are you/i.test(lower)) {
    return { text: "I am Zenisai AI, your personal music assistant. I can play any song, control playback, manage playlists, and recommend tracks." };
  }
  if (/what can you do|help|capabilities/i.test(lower)) {
    return { text: "I can search & play songs (e.g., 'Play Starboy' or 'Play Anirudh'), skip tracks, create playlists ('Create playlist Workout'), and recommend songs based on mood." };
  }
  if (/^(hi|hello|hey|yo|namaste|greetings)/i.test(lower)) {
    return { text: "Hello! What song would you like to listen to today?" };
  }

  // Default fallback: search and play or recommend
  return {
    text: `Searching for "${text}" 🎵`,
    functionCalls: [{ name: 'searchAndPlay', args: { query: text } }]
  };
}

export const getGeminiChatResponse = async (message: string) => {
  const apiKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || '';
  
  if (apiKey && !apiKey.includes('MY_GEMINI')) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      let result;
      try {
        result = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: message,
          config: {
            systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
            tools: [{ functionDeclarations: CONTROL_PLAYBACK_FUNCTIONS }],
          },
        });
      } catch {
        result = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: message,
          config: {
            systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
            tools: [{ functionDeclarations: CONTROL_PLAYBACK_FUNCTIONS }],
          },
        });
      }

      const functionCalls = (result.functionCalls as Array<{ name: string; args: Record<string, unknown> }>) || [];
      const text = result.text || (functionCalls.length > 0 ? '' : 'Processed your request.');
      return { text, functionCalls };
    } catch (apiError) {
      console.warn('Gemini cloud API error, applying client-side music intent logic:', apiError);
    }
  }

  // Client-side fallback that never fails with 500 error
  return parseLocalMusicIntent(message);
};
