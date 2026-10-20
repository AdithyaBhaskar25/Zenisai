import { Song } from '../types';
import { id3Service } from './id3Service';
import { lyricsService } from './lyricsService';

const DB_NAME = 'zenisai_device_music_db';
const DB_VERSION = 3;
const STORE_NAME = 'device_tracks';
const DIR_STORE_NAME = 'directory_handles';
const META_STORE_NAME = 'downloaded_meta';

// Memory map of object URLs for currently loaded audio blobs
const activeObjectUrls = new Map<string, string>();

interface StoredTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  artworkDataUrl?: string;
  audioBlob: Blob;
  embeddedLyrics?: string;
  dateAdded: number;
  fileName?: string;
  fileSize?: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(DIR_STORE_NAME)) {
          db.createObjectStore(DIR_STORE_NAME, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(META_STORE_NAME)) {
          db.createObjectStore(META_STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

// Inspect container magic bytes and return a Blob with the verified correct MIME type
async function getCorrectedAudioBlob(originalBlob: Blob): Promise<Blob> {
  try {
    const slice = originalBlob.slice(0, 32);
    const buf = await slice.arrayBuffer();
    const head = new Uint8Array(buf);
    let mime = originalBlob.type;

    // Check for MP4 / M4A ('ftyp')
    if (head.length >= 8 && head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) {
      mime = 'audio/mp4';
    }
    // Check for MP3 (ID3 header or MPEG sync)
    else if (
      (head.length >= 3 && head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) ||
      (head.length >= 2 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0)
    ) {
      mime = 'audio/mp3';
    }
    // Check for FLAC ('fLaC')
    else if (head.length >= 4 && head[0] === 0x66 && head[1] === 0x4c && head[2] === 0x61 && head[3] === 0x43) {
      mime = 'audio/flac';
    }
    // Check for WAV ('RIFF')
    else if (head.length >= 4 && head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46) {
      mime = 'audio/wav';
    }
    // Check for OGG ('OggS')
    else if (head.length >= 4 && head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53) {
      mime = 'audio/ogg';
    }

    if (mime && mime !== originalBlob.type) {
      return new Blob([originalBlob], { type: mime });
    }
  } catch {}
  return originalBlob;
}

export const deviceMusicService = {
  // Store user-selected Music directory handle for auto-scanning on every app launch
  async saveDirectoryHandle(handle: any): Promise<void> {
    try {
      const db = await openDB();
      if (!db.objectStoreNames.contains(DIR_STORE_NAME)) return;
      const tx = db.transaction(DIR_STORE_NAME, 'readwrite');
      const store = tx.objectStore(DIR_STORE_NAME);
      store.put({ id: 'primary_music_dir', handle, name: handle.name, dateSaved: Date.now() });
    } catch (err) {
      console.warn('Could not store directory handle in IndexedDB:', err);
    }
  },

  // Retrieve stored directory handle
  async getStoredDirectoryHandle(): Promise<any | null> {
    try {
      const db = await openDB();
      if (!db.objectStoreNames.contains(DIR_STORE_NAME)) return null;
      return new Promise<any | null>((resolve) => {
        try {
          const tx = db.transaction(DIR_STORE_NAME, 'readonly');
          const store = tx.objectStore(DIR_STORE_NAME);
          const req = store.get('primary_music_dir');
          req.onsuccess = () => resolve(req.result?.handle || null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    } catch {
      return null;
    }
  },

  // Cache metadata for songs downloaded within the app
  async saveDownloadedMetadata(key: string, meta: { title: string; artist: string; album: string; lyrics?: string; artwork?: string }): Promise<void> {
    const cleanKey = key.trim().toLowerCase();
    // 1. Dual-write to localStorage for instant synchronous retrieval
    try {
      localStorage.setItem(`zenisai_dl_meta_${cleanKey}`, JSON.stringify({ id: cleanKey, ...meta, dateSaved: Date.now() }));
    } catch {}

    // 2. Dual-write to IndexedDB
    try {
      const db = await openDB();
      if (!db.objectStoreNames.contains(META_STORE_NAME)) return;
      const tx = db.transaction(META_STORE_NAME, 'readwrite');
      tx.objectStore(META_STORE_NAME).put({ id: cleanKey, ...meta, dateSaved: Date.now() });
    } catch {}
  },

  // Look up cached downloaded song metadata by clean filename
  async getDownloadedMetadata(key: string): Promise<any | null> {
    const cleanKey = key.trim().toLowerCase();

    // 1. Check localStorage first (instant & reliable across versions)
    try {
      const saved = localStorage.getItem(`zenisai_dl_meta_${cleanKey}`);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}

    // 2. Fallback to IndexedDB
    try {
      const db = await openDB();
      if (!db.objectStoreNames.contains(META_STORE_NAME)) return null;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(META_STORE_NAME, 'readonly');
          const req = tx.objectStore(META_STORE_NAME).get(cleanKey);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    } catch {
      return null;
    }
  },

  // Remove stored directory handle
  async removeStoredDirectoryHandle(): Promise<void> {
    try {
      const db = await openDB();
      if (!db.objectStoreNames.contains(DIR_STORE_NAME)) return;
      const tx = db.transaction(DIR_STORE_NAME, 'readwrite');
      tx.objectStore(DIR_STORE_NAME).delete('primary_music_dir');
    } catch {}
  },

  // Get a guaranteed fresh, playable object URL for a given track id
  async getPlayableUrl(songId: string, forceRefresh = false): Promise<string | null> {
    if (!forceRefresh) {
      const cached = activeObjectUrls.get(songId);
      if (cached) return cached;
    }

    try {
      const db = await openDB();
      return new Promise<string | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(songId);
        req.onsuccess = async () => {
          const item: StoredTrack = req.result;
          if (item && item.audioBlob) {
            try {
              const correctedBlob = await getCorrectedAudioBlob(item.audioBlob);
              const url = URL.createObjectURL(correctedBlob);
              activeObjectUrls.set(songId, url);
              resolve(url);
            } catch {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },

  // Load all previously saved device songs from IndexedDB with fresh playable URLs
  async loadSavedSongs(): Promise<Song[]> {
    try {
      const db = await openDB();
      return new Promise<Song[]>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = async () => {
          const storedList: StoredTrack[] = req.result || [];
          const songs: Song[] = [];

          for (const item of storedList) {
            let url = activeObjectUrls.get(item.id);
            if (!url && item.audioBlob) {
              try {
                const corrected = await getCorrectedAudioBlob(item.audioBlob);
                url = URL.createObjectURL(corrected);
                activeObjectUrls.set(item.id, url);
              } catch {
                url = '';
              }
            }

            songs.push({
              id: item.id,
              title: item.title,
              artist: item.artist,
              album: item.album,
              artwork: item.artworkDataUrl || 'https://picsum.photos/seed/audio/400/400',
              url: url || '',
              duration: item.duration || 0,
              lyrics: item.embeddedLyrics || '',
              embeddedLyrics: item.embeddedLyrics || '',
              isLocal: true,
              language: 'Device Audio'
            });
          }
          resolve(songs);
        };

        req.onerror = () => resolve([]);
      });
    } catch (err) {
      console.warn('Failed to open local music storage:', err);
      return [];
    }
  },

  // Scan a directory handle recursively for all audio files
  async scanDirectoryHandle(
    dirHandle: any,
    onProgress?: (processed: number, total: number, currentTitle: string) => void
  ): Promise<Song[]> {
    const audioFiles: File[] = [];

    async function collectAudioFromDir(handle: any, depth = 0) {
      if (depth > 4) return;
      try {
        // @ts-ignore
        for await (const entry of handle.values()) {
          if (entry.kind === 'file') {
            if (/\.(mp3|m4a|flac|wav|ogg|aac|opus|weba)$/i.test(entry.name)) {
              try {
                const file = await entry.getFile();
                audioFiles.push(file);
              } catch {}
            }
          } else if (entry.kind === 'directory') {
            await collectAudioFromDir(entry, depth + 1);
          }
        }
      } catch (err) {
        console.warn('Directory scan notice:', err);
      }
    }

    await collectAudioFromDir(dirHandle);
    if (audioFiles.length === 0) return [];

    return this.processAudioFiles(audioFiles, onProgress);
  },

  // Automatically scan on app startup if enabled and directory handle is present
  async autoScanOnStartup(
    onProgress?: (processed: number, total: number, currentTitle: string) => void
  ): Promise<Song[]> {
    const autoScanEnabled = localStorage.getItem('zenisai_auto_scan_device') !== 'false';
    if (!autoScanEnabled) {
      return this.loadSavedSongs();
    }

    const dirHandle = await this.getStoredDirectoryHandle();
    if (dirHandle) {
      try {
        let permission = 'prompt';
        if (typeof dirHandle.queryPermission === 'function') {
          permission = await dirHandle.queryPermission({ mode: 'read' });
        }
        if (permission === 'granted') {
          const scanned = await this.scanDirectoryHandle(dirHandle, onProgress);
          if (scanned.length > 0) return scanned;
        }
      } catch (err) {
        console.warn('Auto scan on startup notice:', err);
      }
    }

    return this.loadSavedSongs();
  },

  // Process selected device audio files with MIME verification and ID3/iTunes tag extraction
  async processAudioFiles(
    files: FileList | File[],
    onProgress?: (processed: number, total: number, currentTitle: string) => void
  ): Promise<Song[]> {
    const fileArray = Array.from(files).filter(f => 
      f.type.startsWith('audio/') || 
      /\.(mp3|m4a|flac|wav|ogg|aac|opus|weba)$/i.test(f.name)
    );

    if (fileArray.length === 0) return [];

    const db = await openDB().catch(() => null);
    const addedSongs: Song[] = [];

    // Query existing saved tracks to avoid duplicate processing
    const existingFingerprints = new Set<string>();
    if (db) {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        await new Promise<void>((res) => {
          req.onsuccess = () => {
            const list: StoredTrack[] = req.result || [];
            list.forEach(item => {
              if (item.fileName && item.fileSize) {
                existingFingerprints.add(`${item.fileName}_${item.fileSize}`);
              }
            });
            res();
          };
          req.onerror = () => res();
        });
      } catch {}
    }

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const fingerprint = `${file.name}_${file.size}`;

      if (onProgress) {
        onProgress(i + 1, fileArray.length, file.name);
      }

      // If already stored, skip duplicate processing
      if (existingFingerprints.has(fingerprint)) {
        continue;
      }

      const fileId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${i}`;

      try {
        // Correct MIME type so decoder never receives wrong codec instruction
        const correctedBlob = await getCorrectedAudioBlob(file);

        // Check if this file was downloaded from Zenisai with cached metadata
        const cleanBaseName = file.name.replace(/\.[^/.]+$/, '').trim();
        const cachedMeta = await this.getDownloadedMetadata(cleanBaseName);

        // Parse ID3v2 & iTunes tags
        const meta = await id3Service.parseMetadata(file);

        let finalTitle = cachedMeta?.title || meta.title || cleanBaseName;
        let finalArtist = cachedMeta?.artist || meta.artist || 'Unknown Artist';
        let finalAlbum = cachedMeta?.album || meta.album || 'Device Music';
        let finalArtwork = cachedMeta?.artwork || meta.artworkUrl || 'https://picsum.photos/seed/audio/400/400';
        let finalLyrics = cachedMeta?.lyrics || meta.lyrics || '';

        // If no lyrics found yet and artist is known, attempt quick search from LRCLIB
        if (!finalLyrics && finalTitle && finalArtist && finalArtist !== 'Unknown Artist') {
          try {
            const fetched = await lyricsService.fetchLyrics({
              id: fileId,
              title: finalTitle,
              artist: finalArtist,
              duration: meta.duration
            });
            if (fetched?.syncedLyrics?.length || fetched?.plainLyrics?.length) {
              finalLyrics = fetched.rawSynced || fetched.plainLyrics.join('\n');
            }
          } catch {}
        }

        const objectUrl = URL.createObjectURL(correctedBlob);
        activeObjectUrls.set(fileId, objectUrl);

        const newSong: Song = {
          id: fileId,
          title: finalTitle,
          artist: finalArtist,
          album: finalAlbum,
          artwork: finalArtwork,
          url: objectUrl,
          duration: Math.round(meta.duration || 0),
          lyrics: finalLyrics,
          embeddedLyrics: meta.lyrics || finalLyrics || '',
          isLocal: true,
          language: 'Device Audio'
        };

        addedSongs.push(newSong);

        // Save into IndexedDB for persistent offline access
        if (db) {
          try {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const record: StoredTrack = {
              id: fileId,
              title: newSong.title,
              artist: newSong.artist,
              album: newSong.album,
              duration: newSong.duration,
              artworkDataUrl: finalArtwork.startsWith('data:') ? finalArtwork : (finalArtwork.startsWith('http') ? finalArtwork : undefined),
              audioBlob: correctedBlob,
              embeddedLyrics: finalLyrics,
              dateAdded: Date.now(),
              fileName: file.name,
              fileSize: file.size
            };
            store.put(record);
          } catch (storageErr) {
            console.warn('Could not persist track in IndexedDB:', storageErr);
          }
        }
      } catch (fileErr) {
        console.warn('Error reading device audio file:', file.name, fileErr);
      }
    }

    return addedSongs;
  },

  // Delete a local song from storage
  async removeSong(songId: string): Promise<void> {
    const existingUrl = activeObjectUrls.get(songId);
    if (existingUrl) {
      try { URL.revokeObjectURL(existingUrl); } catch {}
      activeObjectUrls.delete(songId);
    }
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(songId);
    } catch {}
  },

  // Clear all device songs
  async clearAll(): Promise<void> {
    for (const [, url] of activeObjectUrls.entries()) {
      try { URL.revokeObjectURL(url); } catch {}
    }
    activeObjectUrls.clear();
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
    } catch {}
  }
};
