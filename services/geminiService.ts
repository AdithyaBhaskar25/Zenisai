import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Song } from "../types";

export interface AssistantAppContext {
  currentSong: Song | null;
  isPlaying: boolean;
  queue: Song[];
  favoritesCount: number;
  favorites: Song[];
  playlists: Array<{ id: string; name: string; songsCount: number }>;
  activeView: string;
  themeMode: string;
  accent: string;
  visualizerStyle?: string;
  eqPreset: string;
  eqEnabled: boolean;
  bassBoost: number;
  virtualizer: boolean;
  repeatMode: string;
  isShuffle: boolean;
}

export const CONTROL_PLAYBACK_FUNCTIONS: FunctionDeclaration[] = [
  {
    name: 'togglePlayback',
    description: 'Play or pause the current music playback.',
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
        query: { type: Type.STRING, description: 'The song name or artist to search for and play.' }
      },
      required: ['query']
    }
  },
  {
    name: 'recommendSongs',
    description: 'Find and recommend songs matching a genre, artist, mood, or description without interrupting playback.',
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
    description: 'Add the currently playing song to favorites.',
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: 'removeFromFavorites',
    description: 'Remove the currently playing song from favorites.',
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: 'playFavorites',
    description: 'Start playback of the user favorites collection.',
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
  },
  {
    name: 'toggleShuffle',
    description: 'Turn shuffle on or off.',
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: 'setRepeatMode',
    description: 'Set repeat mode to "off", "all" (loop queue), or "one" (loop current song).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        mode: { type: Type.STRING, enum: ['off', 'one', 'all'], description: 'The repeat mode.' }
      },
      required: ['mode']
    }
  },
  {
    name: 'setEqualizerPreset',
    description: 'Set equalizer preset like "bass_boost", "vocal", "rock", "pop", "electronic", "flat", "jazz", "classical", "dynamic_club", or "acoustic".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        preset: { type: Type.STRING, description: 'The equalizer preset name.' }
      },
      required: ['preset']
    }
  },
  {
    name: 'setBassBoost',
    description: 'Set bass boost percentage (0 to 100%).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        percent: { type: Type.NUMBER, description: 'Bass boost percentage between 0 and 100.' }
      },
      required: ['percent']
    }
  },
  {
    name: 'toggleEqualizer',
    description: 'Enable or bypass the equalizer audio stage.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        enabled: { type: Type.BOOLEAN, description: 'True to enable, false to bypass.' }
      }
    }
  },
  {
    name: 'toggleVirtualizer',
    description: 'Enable or disable 3D spatial acoustic virtualizer.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        enabled: { type: Type.BOOLEAN, description: 'True to enable 3D spatializer, false to disable.' }
      }
    }
  },
  {
    name: 'setThemeMode',
    description: 'Change the visual theme of the app: "dark", "oled", "light", "neon", "ambient", or "elegant".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        mode: { type: Type.STRING, enum: ['dark', 'oled', 'light', 'neon', 'ambient', 'elegant'], description: 'Theme mode name.' }
      },
      required: ['mode']
    }
  },
  {
    name: 'setAccentPreset',
    description: 'Change accent color: "dynamic", "blue", "cyan", "emerald", "amber", "violet", "crimson", or "rose".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        accent: { type: Type.STRING, enum: ['dynamic', 'blue', 'cyan', 'emerald', 'amber', 'violet', 'crimson', 'rose'], description: 'Accent color preset.' }
      },
      required: ['accent']
    }
  },
  {
    name: 'setVisualizerStyle',
    description: 'Change the audio visualizer engine style: "bars" (Spectrum Bars), "wave" (Smooth Waveform), or "pulse" (Radial Pulse).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        style: { type: Type.STRING, enum: ['bars', 'wave', 'pulse'], description: 'Visualizer style name.' }
      },
      required: ['style']
    }
  },
  {
    name: 'navigateView',
    description: 'Navigate to an app view: "home", "search", "library", "device", "player", "equalizer", or "themes".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        view: { type: Type.STRING, enum: ['home', 'search', 'library', 'device', 'player', 'equalizer', 'themes'], description: 'Target view or modal.' }
      },
      required: ['view']
    }
  }
];

// Rich client-side natural language music intent parser with full app context
function parseLocalMusicIntent(
  raw: string, 
  ctx?: AssistantAppContext
): { text?: string; functionCalls?: Array<{ name: string; args: Record<string, unknown> }> } {
  const text = raw.trim();
  const lower = text.toLowerCase();

  // 1. Equalizer & Audio Stage commands
  if (/(bass boost|heavy bass|boost (the )?bass|more bass|deep bass)/i.test(lower)) {
    return {
      text: "Bass Boost engaged! Punchy low frequencies dialed in 🔊",
      functionCalls: [
        { name: 'setEqualizerPreset', args: { preset: 'bass_boost' } },
        { name: 'setBassBoost', args: { percent: 65 } }
      ]
    };
  }
  if (/(vocal (eq|boost|clarity)|boost vocals|clear voice|clear lyrics)/i.test(lower)) {
    return {
      text: "Vocal Clarity preset activated for crisp lyrics and singing 🎙️",
      functionCalls: [{ name: 'setEqualizerPreset', args: { preset: 'vocal' } }]
    };
  }
  if (/(rock (eq|preset)|metal eq)/i.test(lower)) {
    return {
      text: "Rock & Metal EQ engaged with elevated drive 🎸",
      functionCalls: [{ name: 'setEqualizerPreset', args: { preset: 'rock' } }]
    };
  }
  if (/(electronic|edm|dance (eq|preset))/i.test(lower)) {
    return {
      text: "Electronic EDM EQ tuned for heavy drops and synthesizer clarity ⚡",
      functionCalls: [{ name: 'setEqualizerPreset', args: { preset: 'electronic' } }]
    };
  }
  if (/(flat (eq|preset)|reset eq|studio flat|flat sound)/i.test(lower)) {
    return {
      text: "Equalizer reset to Flat studio reference 🎚️",
      functionCalls: [{ name: 'setEqualizerPreset', args: { preset: 'flat' } }, { name: 'setBassBoost', args: { percent: 0 } }]
    };
  }
  if (/(3d sound|3d audio|spatializer|virtualizer|surround sound)/i.test(lower)) {
    const nextVirtual = !(ctx?.virtualizer);
    return {
      text: nextVirtual ? "3D Spatializer enabled for wide acoustic depth 🎧" : "3D Spatializer bypassed.",
      functionCalls: [{ name: 'toggleVirtualizer', args: { enabled: nextVirtual } }]
    };
  }
  if (/(open|show|launch) (the )?equalizer/i.test(lower) || /^(equalizer|eq)$/i.test(lower)) {
    return {
      text: "Opening Equalizer & Sound Stage 🎚️",
      functionCalls: [{ name: 'navigateView', args: { view: 'equalizer' } }]
    };
  }

  // 2. Audio Visualizer Engine commands
  if (/(switch|change|set|use)?\s*(to\s+)?(smooth\s+)?wave(form)?\s*(visuali[sz]er)?/i.test(lower) && /wave/i.test(lower)) {
    return {
      text: "Audio visualizer switched to Smooth Waveform 🌊",
      functionCalls: [{ name: 'setVisualizerStyle', args: { style: 'wave' } }]
    };
  }
  if (/(switch|change|set|use)?\s*(to\s+)?(radial\s+|concentric\s+)?pulse\s*(visuali[sz]er)?/i.test(lower) && /pulse/i.test(lower)) {
    return {
      text: "Audio visualizer switched to Radial Pulse 💫",
      functionCalls: [{ name: 'setVisualizerStyle', args: { style: 'pulse' } }]
    };
  }
  if (/(switch|change|set|use)?\s*(to\s+)?(spectrum\s+|frequency\s+|eq\s+)?bars\s*(visuali[sz]er)?/i.test(lower) && /bar/i.test(lower)) {
    return {
      text: "Audio visualizer switched to Spectrum Bars 📊",
      functionCalls: [{ name: 'setVisualizerStyle', args: { style: 'bars' } }]
    };
  }

  // 3. Theme & Visual styling commands
  if (/(light theme|white theme|light mode|day mode|bright theme|crisp light)/i.test(lower)) {
    return {
      text: "Switched to Modern Crisp Light theme with high-contrast black typography and dynamic accents ☀️",
      functionCalls: [{ name: 'setThemeMode', args: { mode: 'light' } }]
    };
  }
  if (/(oled (theme|mode)|amoled|pitch black|black theme)/i.test(lower)) {
    return {
      text: "Switched to Pitch Black OLED mode for deep blacks and battery savings 🖤",
      functionCalls: [{ name: 'setThemeMode', args: { mode: 'oled' } }]
    };
  }
  if (/(neon (theme|mode)|cyberpunk)/i.test(lower)) {
    return {
      text: "Cyberpunk Neon theme engaged with ultraviolet glow 💜",
      functionCalls: [{ name: 'setThemeMode', args: { mode: 'neon' } }]
    };
  }
  if (/(ambient (theme|mode)|immersive mode)/i.test(lower)) {
    return {
      text: "Ambient Immersive theme activated to sync with your music vibes ✨",
      functionCalls: [{ name: 'setThemeMode', args: { mode: 'ambient' } }]
    };
  }
  if (/(dark (theme|mode)|midnight theme)/i.test(lower)) {
    return {
      text: "Switched to Midnight Dark theme 🌙",
      functionCalls: [{ name: 'setThemeMode', args: { mode: 'dark' } }]
    };
  }
  if (/(elegant theme|champagne theme)/i.test(lower)) {
    return {
      text: "Switched to Warm Champagne Elegant theme 🥂",
      functionCalls: [{ name: 'setThemeMode', args: { mode: 'elegant' } }]
    };
  }
  if (/(open|show) (theme|color) (settings|picker|modal)/i.test(lower) || /^(themes?|colors?)$/i.test(lower)) {
    return {
      text: "Opening Theme & Visual Experience settings 🎨",
      functionCalls: [{ name: 'navigateView', args: { view: 'themes' } }]
    };
  }

  // 4. Context-aware current song inquiries (matches "what song is playing", "details of current playing song", etc.)
  const isSongQuery = /(what('s| is| are)? (this song|playing|the current song|the track|the song|on right now)|what song (is this|is playing|is on)|which song (is this|is playing)|song (details|info|information)|(details|info) of (the )?(current|playing) song|current song|now playing|who (is singing|sings this|is the artist|sang this)|artist (details|info|name)|tell me (about this song|what is playing|what song is playing))/i.test(lower);
  if (isSongQuery) {
    if (ctx?.currentSong) {
      const song = ctx.currentSong;
      const status = ctx.isPlaying ? '▶️ Active Playback' : '⏸️ Currently Paused';
      const durationStr = song.duration ? ` • Duration: ${Math.floor(song.duration / 60)}:${Math.floor(song.duration % 60).toString().padStart(2, '0')}` : '';
      const albumStr = song.album && song.album !== song.title ? `\n• Album: ${song.album}` : '';
      const langStr = song.language ? `\n• Language: ${song.language}` : '';
      const queuePos = ctx.queue && ctx.queue.length > 0 
        ? `\n• Queue: Track ${(ctx.queue.findIndex(s => s.id === song.id) + 1) || 1} of ${ctx.queue.length}` 
        : '';
      const eqInfo = `\n• Sound: ${ctx.eqPreset || 'Flat'} EQ (${ctx.eqEnabled ? 'Active' : 'Bypassed'}, Bass: +${ctx.bassBoost}%, 3D Spatializer: ${ctx.virtualizer ? 'On' : 'Off'})`;
      const themeInfo = `\n• Theme: ${ctx.themeMode} mode (${ctx.accent} accent, ${ctx.visualizerStyle || 'bars'} visualizer)`;

      return {
        text: `🎵 Current Track Details:\n• Title: "${song.title}"\n• Artist: ${song.artist}${albumStr}${langStr}\n• Status: ${status}${durationStr}${queuePos}${eqInfo}${themeInfo}\n\nTip: You can tap "Save to favorites", "Deep Bass Boost", or "Explain this song"!`
      };
    }
    return { 
      text: "No song is currently playing or loaded. You can ask me to 'Play some Anirudh', 'Play Top Hits', or explore trending songs from the feed!" 
    };
  }

  // 5. Inquiries about the queue
  if (/(what('s| is) next|upcoming song|next in queue|queue info|what is in my queue|show queue|list queue)/i.test(lower)) {
    if (ctx && ctx.queue.length > 1) {
      const nextTracks = ctx.queue.slice(1, 6).map((s, i) => `${i + 1}. "${s.title}" — ${s.artist}`).join('\n');
      return {
        text: `Upcoming tracks (${ctx.queue.length} in queue):\n${nextTracks}\n\nSay "Shuffle queue" or "Clear queue" to manage!`
      };
    }
    if (ctx && ctx.queue.length === 1) {
      return { text: `Only the currently playing song ("${ctx.queue[0].title}") is in the queue. Search or ask me to queue more songs!` };
    }
    return { text: "There are no upcoming tracks in the queue. Search for any song or tap a playlist to fill the queue!" };
  }

  // 6. Inquiries about user library & favorites
  if (/(my favorites|favorite songs|how many favorites|favorites count|saved songs)/i.test(lower)) {
    const count = ctx?.favoritesCount || 0;
    if (count > 0 && ctx?.favorites) {
      const topFavs = ctx.favorites.slice(0, 4).map((s, i) => `${i + 1}. "${s.title}" — ${s.artist}`).join('\n');
      return {
        text: `You have ${count} saved favorite tracks ❤️\n\nTop favorites:\n${topFavs}\n\nSay "Play my favorites" to start listening!`
      };
    }
    return { text: "Your favorites collection is currently empty. Tap the heart icon or say 'Add to favorites' while playing any song!" };
  }

  // 7. Inquiries about playlists
  if (/(my playlists|what playlists|show playlists|list playlists)/i.test(lower)) {
    if (ctx?.playlists && ctx.playlists.length > 0) {
      const plList = ctx.playlists.map(p => `• ${p.name} (${p.songsCount} songs)`).join('\n');
      return {
        text: `Your Playlists:\n${plList}\n\nSay "Create playlist <name>" to make a new one!`
      };
    }
    return { text: "You haven't created custom playlists yet. Say 'Create playlist Party' to create one!" };
  }

  // 8. Inquiries about app settings (Theme, EQ, Audio)
  if (/(what theme|current theme|my theme|theme status)/i.test(lower)) {
    return {
      text: `Current Theme: ${ctx?.themeMode || 'dark'} mode with ${ctx?.accent || 'dynamic'} accent and ${ctx?.visualizerStyle || 'bars'} visualizer engine.`
    };
  }
  if (/(what eq|current eq|sound settings|audio settings|eq settings)/i.test(lower)) {
    return {
      text: `Sound Stage: ${ctx?.eqPreset || 'Flat'} EQ (${ctx?.eqEnabled ? 'Active' : 'Bypassed'}), Bass Boost: ${ctx?.bassBoost || 0}%, 3D Spatializer: ${ctx?.virtualizer ? 'Active' : 'Off'}.`
    };
  }
  if (/(where am i|what view|active page|current page)/i.test(lower)) {
    return {
      text: `You are currently on the "${ctx?.activeView || 'home'}" view. You can navigate by saying "Go to Explore", "Go to Search", or "Go to Library".`
    };
  }

  // 9. Song explanation / trivia / meaning
  if (/(about this song|song trivia|lyrics info|tell me about this|explain this song|meaning of this song)/i.test(lower)) {
    if (ctx?.currentSong) {
      return {
        text: `"${ctx.currentSong.title}" by ${ctx.currentSong.artist} is a standout piece featuring captivating melodic rhythm and resonant instrumentation. You can follow along with live synced lyrics in the full player!`
      };
    }
    return { text: "Start playing a song first and I'll break down the track, artist, and musical backdrop for you!" };
  }

  // 10. Navigation commands
  if (/(go to|open|show) search/i.test(lower)) {
    return { text: "Navigating to Explore & Search 🔍", functionCalls: [{ name: 'navigateView', args: { view: 'search' } }] };
  }
  if (/(go to|open|show) (library|collection|my music)/i.test(lower)) {
    return { text: "Navigating to your Library 📚", functionCalls: [{ name: 'navigateView', args: { view: 'library' } }] };
  }
  if (/(go to|open|show) (device|local|offline|downloaded) (music|songs)?/i.test(lower)) {
    return { text: "Opening Device Music 📂", functionCalls: [{ name: 'navigateView', args: { view: 'device' } }] };
  }
  if (/(open|show) (full )?player/i.test(lower)) {
    return { text: "Expanding Now Playing player 🎵", functionCalls: [{ name: 'navigateView', args: { view: 'player' } }] };
  }
  if (/(go to|open|show) (home|explore|feed)/i.test(lower)) {
    return { text: "Back to Home Feed 🏠", functionCalls: [{ name: 'navigateView', args: { view: 'home' } }] };
  }

  // 5. Playback commands
  if (/^(pause|stop music|pause song|halt|freeze)$/i.test(lower)) {
    return { text: "Paused playback.", functionCalls: [{ name: 'togglePlayback', args: {} }] };
  }
  if (/^(play|resume|resume music|unpause|start music)$/i.test(lower)) {
    return { text: "Resumed playback 🎵", functionCalls: [{ name: 'togglePlayback', args: {} }] };
  }
  if (/^(next|skip|skip track|next song|play next|forward)$/i.test(lower)) {
    return { text: "Skipping to next track ⏭️", functionCalls: [{ name: 'playNext', args: {} }] };
  }
  if (/^(prev|previous|previous song|go back|last song|replay)$/i.test(lower)) {
    return { text: "Playing previous track ⏮️", functionCalls: [{ name: 'playPrevious', args: {} }] };
  }
  if (/clear (the )?queue/i.test(lower)) {
    return { text: "Cleared queue.", functionCalls: [{ name: 'clearQueue', args: {} }] };
  }
  if (/(shuffle|mix) (the )?queue/i.test(lower) || /^shuffle$/i.test(lower)) {
    return { text: "Queue shuffled 🔀", functionCalls: [{ name: 'toggleShuffle', args: {} }] };
  }
  if (/(repeat one|loop this|loop song|repeat single)/i.test(lower)) {
    return { text: "Single song loop enabled 🔂", functionCalls: [{ name: 'setRepeatMode', args: { mode: 'one' } }] };
  }
  if (/(repeat all|loop queue|repeat on)/i.test(lower)) {
    return { text: "Queue repeat enabled 🔁", functionCalls: [{ name: 'setRepeatMode', args: { mode: 'all' } }] };
  }
  if (/(repeat off|stop repeat|no repeat)/i.test(lower)) {
    return { text: "Repeat disabled.", functionCalls: [{ name: 'setRepeatMode', args: { mode: 'off' } }] };
  }

  // 6. Favorites commands
  if (/(play (my )?favorites|listen to favorites)/i.test(lower)) {
    return { text: "Playing your saved favorites collection ❤️", functionCalls: [{ name: 'playFavorites', args: {} }] };
  }
  if (/(add to fav|favorite this|save this song|love this|add current to fav)/i.test(lower)) {
    const title = ctx?.currentSong ? `"${ctx.currentSong.title}"` : 'track';
    return { text: `Saved ${title} to your favorites ❤️`, functionCalls: [{ name: 'addToFavorites', args: {} }] };
  }
  if (/(remove from fav|unfavorite this|unlike this)/i.test(lower)) {
    return { text: "Removed from favorites.", functionCalls: [{ name: 'removeFromFavorites', args: {} }] };
  }
  const favMatch = lower.match(/(?:favorite|add|save)\s+(.+?)\s+(?:to favorites?|to favs?)/i);
  if (favMatch) {
    return { text: `Added "${favMatch[1].trim()}" to favorites ❤️`, functionCalls: [{ name: 'favoriteSong', args: { query: favMatch[1].trim() } }] };
  }

  // 7. Playlist commands
  const createPlMatch = lower.match(/(?:create|make|new)\s+(?:a\s+)?playlist\s+(?:called|named\s+)?["']?(.+?)["']?$/i);
  if (createPlMatch) {
    const plName = createPlMatch[1].trim();
    return { text: `Created playlist "${plName}" 🎶`, functionCalls: [{ name: 'createPlaylist', args: { name: plName } }] };
  }

  const addToPlMatch = lower.match(/add\s+(.+?)\s+to\s+(?:playlist\s+)?["']?(.+?)["']?$/i);
  if (addToPlMatch) {
    return {
      text: `Adding "${addToPlMatch[1].trim()}" to playlist "${addToPlMatch[2].trim()}".`,
      functionCalls: [{ name: 'addSongToPlaylist', args: { query: addToPlMatch[1].trim(), playlistName: addToPlMatch[2].trim() } }]
    };
  }

  // 8. Recommendations & Similarity
  if (/(more by|play more by|tracks by|songs by)\s+(.+)/i.test(lower)) {
    const artist = lower.match(/(?:more by|play more by|tracks by|songs by)\s+(.+)/i)?.[1]?.trim();
    if (artist) {
      return {
        text: `Playing top hits by ${artist} 🎵`,
        functionCalls: [{ name: 'searchAndPlay', args: { query: artist } }]
      };
    }
  }

  const recMatch = lower.match(/(?:recommend|suggest|show me|find me some|give me)\s+(?:some\s+)?(.+?)(?:\s+songs|\s+tracks|\s+music)?$/i);
  if (recMatch && !lower.startsWith('play')) {
    const query = recMatch[1].replace(/(songs|tracks|music)$/i, '').trim() || 'trending';
    return {
      text: `Here are recommendations for "${query}":`,
      functionCalls: [{ name: 'recommendSongs', args: { query } }]
    };
  }

  // 9. Play specific song or artist
  const playMatch = lower.match(/^(?:play|listen to|put on|start|tune to)\s+(?:some\s+)?(.+)/i);
  if (playMatch) {
    const query = playMatch[1].replace(/(songs?|tracks?|music)$/i, '').trim() || playMatch[1].trim();
    return {
      text: `Playing "${query}" for you 🎵`,
      functionCalls: [{ name: 'searchAndPlay', args: { query } }]
    };
  }

  // 10. Common Conversational responses
  if (/who are you|what are you/i.test(lower)) {
    return { 
      text: "I am Zenisai AI, your context-aware music and sound copilot. I can control playback, adjust the 5-band equalizer, switch themes, navigate pages, and recommend music." 
    };
  }
  if (/what can you do|help|capabilities|features/i.test(lower)) {
    return { 
      text: "Here's what I can do for you:\n• Play any song or artist ('Play Starboy' or 'Play Anirudh')\n• Adjust Equalizer & Bass Boost ('Bass Boost', 'Vocal EQ', 'Flat EQ')\n• Change Themes ('Switch to Light theme', 'OLED mode', 'Neon theme')\n• Manage Music ('Save to favorites', 'Create playlist Workout', 'Play favorites')\n• Control queue & audio ('Shuffle', 'Next song', 'Repeat track')" 
    };
  }
  if (/^(hi|hello|hey|yo|namaste|greetings)/i.test(lower)) {
    const greetingSong = ctx?.currentSong ? ` We're currently enjoying "${ctx.currentSong.title}".` : '';
    return { text: `Hello!${greetingSong} What would you like to listen to or tune today?` };
  }

  // Default fallback: search and play or recommend
  return {
    text: `Searching for "${text}" 🎵`,
    functionCalls: [{ name: 'searchAndPlay', args: { query: text } }]
  };
}

export const getGeminiChatResponse = async (
  message: string, 
  context?: AssistantAppContext
) => {
  const apiKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || '';

  const systemInstruction = `You are Zenisai, an intelligent, context-aware AI music copilot for the Zenisai music app.
Current App Context:
- Track: ${context?.currentSong ? `"${context.currentSong.title}" by ${context.currentSong.artist}` : 'No song currently loaded'} (${context?.isPlaying ? 'Playing' : 'Paused'})
- Queue: ${context?.queue?.length || 0} tracks. Upcoming: ${context?.queue?.slice(1, 4).map(s => `"${s.title}"`).join(', ') || 'None'}
- Library: ${context?.favoritesCount || 0} favorite tracks, ${context?.playlists?.length || 0} custom playlists.
- Sound: EQ is ${context?.eqEnabled ? 'Active' : 'Bypassed'} (Preset: ${context?.eqPreset || 'Flat'}, Bass Boost: ${context?.bassBoost || 0}%, 3D Spatializer: ${context?.virtualizer ? 'On' : 'Off'}).
- Appearance: Theme is ${context?.themeMode || 'dark'} (Accent: ${context?.accent || 'dynamic'}, Visualizer: ${context?.visualizerStyle || 'bars'}).
- Playback Mode: Repeat=${context?.repeatMode || 'off'}, Shuffle=${context?.isShuffle ? 'On' : 'Off'}.
- Active Page: ${context?.activeView || 'home'}.

Answer concisely with musical warmth, and execute corresponding function calls to control playback, equalizer, themes, navigation, or playlist management. Keep responses focused and accurate.`;

  if (apiKey && !apiKey.includes('MY_GEMINI')) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      let result;
      try {
        result = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: message,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: CONTROL_PLAYBACK_FUNCTIONS }],
          },
        });
      } catch {
        result = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: message,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: CONTROL_PLAYBACK_FUNCTIONS }],
          },
        });
      }

      const functionCalls = (result.functionCalls as Array<{ name: string; args: Record<string, unknown> }>) || [];
      const text = result.text || (functionCalls.length > 0 ? '' : 'Processed your request.');
      return { text, functionCalls };
    } catch (apiError) {
      console.warn('Gemini cloud API notice, using context-aware local intelligence:', apiError);
    }
  }

  // Client-side context-aware fallback that never fails with 500
  return parseLocalMusicIntent(message, context);
};
