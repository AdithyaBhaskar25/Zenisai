// Centralized ultra-robust lyrics service with in-memory & persistent cache
// Ensures mini player, full player, and home view always share identical, instant lyrics.

export interface ParsedLyricLine {
  time: number;
  text: string;
}

export interface LyricResult {
  syncedLyrics: ParsedLyricLine[];
  plainLyrics: string[];
  rawSynced: string;
  source: 'lrclib-exact' | 'lrclib-search' | 'saavn' | 'none';
}

const parseTimestamp = (lrcTimestamp: string): number => {
  const match = lrcTimestamp.match(/\[(\d+):(\d+(?:\.\d+)?)\]/);
  if (!match) return 0;
  const minutes = parseInt(match[1], 10);
  const seconds = parseFloat(match[2]);
  return minutes * 60 + seconds;
};

export const parseLrcText = (lrcText: string): ParsedLyricLine[] => {
  if (!lrcText) return [];
  return lrcText
    .split('\n')
    .map(line => {
      const match = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
      if (match) {
        const time = parseInt(match[1], 10) * 60 + parseFloat(match[2]);
        const text = match[3].trim();
        return { time, text };
      }
      return null;
    })
    .filter((line): line is ParsedLyricLine => line !== null && line.text.length > 0);
};

// Memory cache for active session
const memoryLyricsCache = new Map<string, LyricResult>();

// Clean song title for better lookup (strips parenthetical movie/album/feat tags)
export const cleanTitle = (rawTitle: string): string => {
  if (!rawTitle) return '';
  return rawTitle
    .replace(/\s*[\(\[](?:from|feat\.?|featuring|official|video|audio|lyric|remix|version|deluxe|soundtrack).*?[\)\]]/gi, '')
    .replace(/\s*[\(\[].*?[\)\]]/g, '')
    .replace(/\s*-\s*(?:from|original|remix|single|album version).*$/gi, '')
    .replace(/[^\w\s\u0B80-\u0BFF]/gi, ' ') // support Tamil & Latin characters
    .trim();
};

export const lyricsService = {
  getCache(songId: string): LyricResult | null {
    if (memoryLyricsCache.has(songId)) {
      return memoryLyricsCache.get(songId)!;
    }
    try {
      const stored = sessionStorage.getItem(`zenisai_lyrics_${songId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as LyricResult;
        memoryLyricsCache.set(songId, parsed);
        return parsed;
      }
    } catch {
      // sessionStorage unavailable
    }
    return null;
  },

  setCache(songId: string, result: LyricResult) {
    memoryLyricsCache.set(songId, result);
    try {
      sessionStorage.setItem(`zenisai_lyrics_${songId}`, JSON.stringify(result));
    } catch {
      // ignore storage quota
    }
  },

  async fetchLyrics(song: { id: string; title: string; artist: string; duration?: number }): Promise<LyricResult> {
    if (!song || !song.id) {
      return { syncedLyrics: [], plainLyrics: [], rawSynced: '', source: 'none' };
    }

    const cached = this.getCache(song.id);
    if (cached) {
      return cached;
    }

    const duration = Math.round(song.duration || 0);
    const cleaned = cleanTitle(song.title);
    const primaryArtist = song.artist.split(',')[0].trim();

    // Strategy 1: Exact LRCLIB query
    try {
      const exactParams = new URLSearchParams({
        artist_name: primaryArtist,
        track_name: song.title,
      });
      if (duration > 0) exactParams.append('duration', String(duration));

      const res = await fetch(`https://lrclib.net/api/get?${exactParams}`, { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        if (data?.syncedLyrics) {
          const parsed = parseLrcText(data.syncedLyrics);
          const plain = data.plainLyrics ? data.plainLyrics.split('\n').filter(Boolean) : parsed.map(p => p.text);
          const result: LyricResult = {
            syncedLyrics: parsed,
            plainLyrics: plain,
            rawSynced: data.syncedLyrics,
            source: 'lrclib-exact',
          };
          this.setCache(song.id, result);
          return result;
        } else if (data?.plainLyrics) {
          const plain = data.plainLyrics.split('\n').filter(Boolean);
          const result: LyricResult = {
            syncedLyrics: [],
            plainLyrics: plain,
            rawSynced: '',
            source: 'lrclib-exact',
          };
          this.setCache(song.id, result);
          return result;
        }
      }
    } catch {
      // continue to strategy 2
    }

    // Strategy 2: LRCLIB Search with clean title & primary artist
    try {
      const searchParams = new URLSearchParams({
        track_name: cleaned || song.title,
        artist_name: primaryArtist,
      });
      const searchRes = await fetch(`https://lrclib.net/api/search?${searchParams}`);
      if (searchRes.ok) {
        const matches = await searchRes.json();
        if (Array.isArray(matches) && matches.length > 0) {
          // Prefer synced lyrics first, then closest duration
          const best = matches.sort((a: any, b: any) => {
            if (a.syncedLyrics && !b.syncedLyrics) return -1;
            if (!a.syncedLyrics && b.syncedLyrics) return 1;
            if (duration > 0) {
              return Math.abs((a.duration || 0) - duration) - Math.abs((b.duration || 0) - duration);
            }
            return 0;
          })[0];

          if (best?.syncedLyrics) {
            const parsed = parseLrcText(best.syncedLyrics);
            const plain = best.plainLyrics ? best.plainLyrics.split('\n').filter(Boolean) : parsed.map(p => p.text);
            const result: LyricResult = {
              syncedLyrics: parsed,
              plainLyrics: plain,
              rawSynced: best.syncedLyrics,
              source: 'lrclib-search',
            };
            this.setCache(song.id, result);
            return result;
          } else if (best?.plainLyrics) {
            const result: LyricResult = {
              syncedLyrics: [],
              plainLyrics: best.plainLyrics.split('\n').filter(Boolean),
              rawSynced: '',
              source: 'lrclib-search',
            };
            this.setCache(song.id, result);
            return result;
          }
        }
      }
    } catch {
      // continue to strategy 3
    }

    // Strategy 3: Broad search with cleaned title
    if (cleaned && cleaned.length > 2) {
      try {
        const broadRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleaned)}`);
        if (broadRes.ok) {
          const matches = await broadRes.json();
          if (Array.isArray(matches) && matches.length > 0) {
            const best = matches.find((m: any) => m.syncedLyrics) || matches[0];
            if (best?.syncedLyrics) {
              const parsed = parseLrcText(best.syncedLyrics);
              const plain = best.plainLyrics ? best.plainLyrics.split('\n').filter(Boolean) : parsed.map(p => p.text);
              const result: LyricResult = {
                syncedLyrics: parsed,
                plainLyrics: plain,
                rawSynced: best.syncedLyrics,
                source: 'lrclib-search',
              };
              this.setCache(song.id, result);
              return result;
            } else if (best?.plainLyrics) {
              const result: LyricResult = {
                syncedLyrics: [],
                plainLyrics: best.plainLyrics.split('\n').filter(Boolean),
                rawSynced: '',
                source: 'lrclib-search',
              };
              this.setCache(song.id, result);
              return result;
            }
          }
        }
      } catch {
        // continue to strategy 4
      }
    }

    // Strategy 4: JioSaavn plain lyrics endpoint
    try {
      const saavnRes = await fetch(`https://jiosaavn-api.vercel.app/lyrics?id=${song.id}`);
      if (saavnRes.ok) {
        const data = await saavnRes.json();
        if (data?.lyrics) {
          const cleanedText = data.lyrics
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .trim();
          const plain = cleanedText.split('\n').filter(Boolean);
          const result: LyricResult = {
            syncedLyrics: [],
            plainLyrics: plain,
            rawSynced: '',
            source: 'saavn',
          };
          this.setCache(song.id, result);
          return result;
        }
      }
    } catch {
      // no lyrics found
    }

    const emptyResult: LyricResult = {
      syncedLyrics: [],
      plainLyrics: ['Lyrics not available for this track.'],
      rawSynced: '',
      source: 'none',
    };
    this.setCache(song.id, emptyResult);
    return emptyResult;
  },
};
