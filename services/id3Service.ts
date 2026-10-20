// ID3 & MP4 metadata encoder and parser for native music tagging and device storage scanning

export interface AudioMetadata {
  title: string;
  artist: string;
  album: string;
  year?: string;
  lyrics?: string;
  artworkUrl?: string;
  duration?: number;
}

// Convert integer to 4-byte synchsafe integer (7 bits per byte)
function encodeSynchsafe(size: number): number[] {
  return [
    (size >> 21) & 0x7f,
    (size >> 14) & 0x7f,
    (size >> 7) & 0x7f,
    size & 0x7f
  ];
}

// Decode synchsafe integer
function decodeSynchsafe(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

// Helper to encode UTF-8 text frame for ID3v2.3
function createTextFrame(frameId: string, text: string): Uint8Array {
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(text);
  const frameSize = 1 + textBytes.length;
  const frame = new Uint8Array(10 + frameSize);

  for (let i = 0; i < 4; i++) {
    frame[i] = frameId.charCodeAt(i);
  }
  frame[4] = (frameSize >> 24) & 0xff;
  frame[5] = (frameSize >> 16) & 0xff;
  frame[6] = (frameSize >> 8) & 0xff;
  frame[7] = frameSize & 0xff;
  frame[8] = 0;
  frame[9] = 0;
  frame[10] = 0x03; // UTF-8 encoding
  frame.set(textBytes, 11);

  return frame;
}

// Create USLT (Unsynchronized lyrics) frame for MP3
function createLyricsFrame(lyrics: string): Uint8Array {
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(lyrics);
  // encoding(1) + language(3: 'eng') + content descriptor delimiter(1) + lyrics
  const frameSize = 1 + 3 + 1 + textBytes.length;
  const frame = new Uint8Array(10 + frameSize);

  frame[0] = 0x55; // U
  frame[1] = 0x53; // S
  frame[2] = 0x4c; // L
  frame[3] = 0x54; // T

  frame[4] = (frameSize >> 24) & 0xff;
  frame[5] = (frameSize >> 16) & 0xff;
  frame[6] = (frameSize >> 8) & 0xff;
  frame[7] = frameSize & 0xff;
  frame[8] = 0;
  frame[9] = 0;

  let offset = 10;
  frame[offset++] = 0x03; // UTF-8
  frame[offset++] = 0x65; // 'e'
  frame[offset++] = 0x6e; // 'n'
  frame[offset++] = 0x67; // 'g'
  frame[offset++] = 0x00; // empty desc delimiter
  frame.set(textBytes, offset);

  return frame;
}

// Create APIC (Attached Picture) frame for MP3
function createPictureFrame(imageBytes: Uint8Array, mimeType: string = 'image/jpeg'): Uint8Array {
  const encoder = new TextEncoder();
  const mimeBytes = encoder.encode(mimeType);
  const frameSize = 1 + mimeBytes.length + 1 + 1 + 1 + imageBytes.length;
  const frame = new Uint8Array(10 + frameSize);

  frame[0] = 0x41; // A
  frame[1] = 0x50; // P
  frame[2] = 0x49; // I
  frame[3] = 0x43; // C

  frame[4] = (frameSize >> 24) & 0xff;
  frame[5] = (frameSize >> 16) & 0xff;
  frame[6] = (frameSize >> 8) & 0xff;
  frame[7] = frameSize & 0xff;
  frame[8] = 0;
  frame[9] = 0;

  let offset = 10;
  frame[offset++] = 0x00; // ISO-8859-1 for MIME
  frame.set(mimeBytes, offset);
  offset += mimeBytes.length;
  frame[offset++] = 0x00; // null-terminated MIME
  frame[offset++] = 0x03; // Picture Type: 0x03 = Front Cover
  frame[offset++] = 0x00; // empty description
  frame.set(imageBytes, offset);

  return frame;
}

// Helper to convert Uint8Array / Blob to base64 data URL
export function bytesToDataUrl(bytes: Uint8Array, mimeType: string = 'image/jpeg'): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

export const id3Service = {
  // Detect container format of an audio buffer
  detectFormat(audioBuffer: ArrayBuffer): { format: 'm4a' | 'mp3' | 'flac' | 'wav' | 'ogg' | 'other'; mime: string; ext: string } {
    const bytes = new Uint8Array(audioBuffer, 0, Math.min(audioBuffer.byteLength, 32));
    
    // Check for MP4 / M4A (bytes 4-7: 'ftyp')
    if (
      bytes.length >= 8 &&
      bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
    ) {
      return { format: 'm4a', mime: 'audio/mp4', ext: 'm4a' };
    }

    // Check for FLAC ('fLaC')
    if (
      bytes.length >= 4 &&
      bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43
    ) {
      return { format: 'flac', mime: 'audio/flac', ext: 'flac' };
    }

    // Check for WAV ('RIFF'....'WAVE')
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45
    ) {
      return { format: 'wav', mime: 'audio/wav', ext: 'wav' };
    }

    // Check for OGG ('OggS')
    if (
      bytes.length >= 4 &&
      bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53
    ) {
      return { format: 'ogg', mime: 'audio/ogg', ext: 'ogg' };
    }

    // Check for MP3 (ID3 header or MPEG audio frame sync 0xFF 0xFB/0xF3/0xF2)
    if (
      (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
      (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
    ) {
      return { format: 'mp3', mime: 'audio/mp3', ext: 'mp3' };
    }

    // Default to m4a for JioSaavn / AAC CDN streams
    return { format: 'm4a', mime: 'audio/mp4', ext: 'm4a' };
  },

  // Prepare downloadable audio file with metadata, ensuring container headers remain 100% valid
  prepareDownloadableAudio(
    audioBuffer: ArrayBuffer,
    meta: {
      title: string;
      artist: string;
      album: string;
      year?: string;
      lyrics?: string;
      imageBytes?: Uint8Array;
      mimeType?: string;
    }
  ): { data: Uint8Array; mime: string; ext: string } {
    const { format, mime, ext } = this.detectFormat(audioBuffer);

    // If it's an M4A / MP4 container:
    // Retain pristine audio container structure so mobile and desktop browsers demux without errors
    if (format === 'm4a') {
      return {
        data: new Uint8Array(audioBuffer),
        mime: 'audio/mp4',
        ext: 'm4a'
      };
    }

    // If it's an MP3 file, embed ID3v2.3 tags
    if (format === 'mp3') {
      try {
        const frames: Uint8Array[] = [];
        if (meta.title) frames.push(createTextFrame('TIT2', meta.title));
        if (meta.artist) frames.push(createTextFrame('TPE1', meta.artist));
        if (meta.album) frames.push(createTextFrame('TALB', meta.album));
        if (meta.year) frames.push(createTextFrame('TYER', meta.year));
        if (meta.lyrics && meta.lyrics.trim().length > 0) {
          frames.push(createLyricsFrame(meta.lyrics));
        }
        if (meta.imageBytes && meta.imageBytes.length > 0) {
          frames.push(createPictureFrame(meta.imageBytes, meta.mimeType || 'image/jpeg'));
        }

        const totalFramesSize = frames.reduce((acc, f) => acc + f.length, 0);

        const header = new Uint8Array(10);
        header[0] = 0x49; // I
        header[1] = 0x44; // D
        header[2] = 0x33; // 3
        header[3] = 0x03; // Version 2.3
        header[4] = 0x00;
        header[5] = 0x00;
        const synchsafe = encodeSynchsafe(totalFramesSize);
        header[6] = synchsafe[0];
        header[7] = synchsafe[1];
        header[8] = synchsafe[2];
        header[9] = synchsafe[3];

        const audioBytes = new Uint8Array(audioBuffer);
        let audioDataOffset = 0;
        if (
          audioBytes.length > 10 &&
          audioBytes[0] === 0x49 &&
          audioBytes[1] === 0x44 &&
          audioBytes[2] === 0x33
        ) {
          const existingTagSize = decodeSynchsafe(audioBytes, 6);
          audioDataOffset = 10 + existingTagSize;
        }

        const pureAudioBytes = audioBytes.slice(audioDataOffset);
        const finalFile = new Uint8Array(10 + totalFramesSize + pureAudioBytes.length);

        finalFile.set(header, 0);
        let currentOffset = 10;
        for (const frame of frames) {
          finalFile.set(frame, currentOffset);
          currentOffset += frame.length;
        }
        finalFile.set(pureAudioBytes, currentOffset);

        return { data: finalFile, mime: 'audio/mp3', ext: 'mp3' };
      } catch {
        return { data: new Uint8Array(audioBuffer), mime: 'audio/mp3', ext: 'mp3' };
      }
    }

    // Default return original bytes with detected mime & extension
    return { data: new Uint8Array(audioBuffer), mime, ext };
  },

  // Alias for compatibility
  embedMetadata(
    audioBuffer: ArrayBuffer,
    meta: {
      title: string;
      artist: string;
      album: string;
      year?: string;
      lyrics?: string;
      imageBytes?: Uint8Array;
      mimeType?: string;
    }
  ): Uint8Array {
    return this.prepareDownloadableAudio(audioBuffer, meta).data;
  },

  // Parse metadata from MP3 (ID3v2) or M4A (MP4 atoms) or Filename
  async parseMetadata(file: File): Promise<AudioMetadata> {
    const defaultTitle = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
    const result: AudioMetadata = {
      title: defaultTitle,
      artist: 'Unknown Artist',
      album: 'Device Music',
      year: '',
      lyrics: '',
      artworkUrl: '',
      duration: 0
    };

    // First attempt to extract artist - title from clean filename
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    if (cleanName.includes(' - ')) {
      const parts = cleanName.split(' - ');
      if (parts.length >= 2) {
        result.title = parts[0].trim();
        result.artist = parts.slice(1).join(' - ').trim();
      }
    } else if (cleanName.includes('-')) {
      const parts = cleanName.split('-');
      if (parts.length >= 2) {
        result.artist = parts[0].trim();
        result.title = parts.slice(1).join('-').trim();
      }
    }

    try {
      // Read initial slice for inspection
      const headerBlob = file.slice(0, Math.min(file.size, 1024 * 1024));
      const buffer = await headerBlob.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // --- 1. MP4 / M4A Atom Inspection (ftyp at byte 4) ---
      if (
        bytes.length >= 8 &&
        bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
      ) {
        // Fast iTunes metadata atom scanner inside M4A
        const decoder = new TextDecoder('utf-8');
        const latinDecoder = new TextDecoder('iso-8859-1');

        // Look for 'ilst' or standard atoms in slice
        for (let i = 0; i < bytes.length - 8; i++) {
          // Check for iTunes metadata atoms: ©nam, ©ART, ©alb, ©day, ©lyr, covr
          if (
            (bytes[i] === 0xa9 && bytes[i + 1] === 0x6e && bytes[i + 2] === 0x61 && bytes[i + 3] === 0x6d) || // ©nam
            (bytes[i] === 0xa9 && bytes[i + 1] === 0x41 && bytes[i + 2] === 0x52 && bytes[i + 3] === 0x54) || // ©ART
            (bytes[i] === 0xa9 && bytes[i + 1] === 0x61 && bytes[i + 2] === 0x6c && bytes[i + 3] === 0x62) || // ©alb
            (bytes[i] === 0xa9 && bytes[i + 1] === 0x64 && bytes[i + 2] === 0x61 && bytes[i + 3] === 0x79) || // ©day
            (bytes[i] === 0xa9 && bytes[i + 1] === 0x6c && bytes[i + 2] === 0x79 && bytes[i + 3] === 0x72)    // ©lyr
          ) {
            const atomType = String.fromCharCode(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]);
            // Search ahead for 'data' atom within 24 bytes
            for (let j = i + 4; j < Math.min(bytes.length - 8, i + 32); j++) {
              if (
                bytes[j] === 0x64 && bytes[j + 1] === 0x61 &&
                bytes[j + 2] === 0x74 && bytes[j + 3] === 0x61
              ) {
                const dataSize = (bytes[j - 4] << 24) | (bytes[j - 3] << 16) | (bytes[j - 2] << 8) | bytes[j - 1];
                if (dataSize > 8 && j + dataSize <= bytes.length) {
                  const textBytes = bytes.slice(j + 8, j + dataSize);
                  const str = decoder.decode(textBytes).trim();
                  if (str) {
                    if (atomType === '\xa9nam') result.title = str;
                    else if (atomType === '\xa9ART') result.artist = str;
                    else if (atomType === '\xa9alb') result.album = str;
                    else if (atomType === '\xa9day') result.year = str.slice(0, 4);
                    else if (atomType === '\xa9lyr') result.lyrics = str;
                  }
                }
                break;
              }
            }
          } else if (
            bytes[i] === 0x63 && bytes[i + 1] === 0x6f &&
            bytes[i + 2] === 0x76 && bytes[i + 3] === 0x72 // covr (artwork)
          ) {
            for (let j = i + 4; j < Math.min(bytes.length - 8, i + 32); j++) {
              if (
                bytes[j] === 0x64 && bytes[j + 1] === 0x61 &&
                bytes[j + 2] === 0x74 && bytes[j + 3] === 0x61
              ) {
                const dataSize = (bytes[j - 4] << 24) | (bytes[j - 3] << 16) | (bytes[j - 2] << 8) | bytes[j - 1];
                if (dataSize > 8 && j + dataSize <= bytes.length) {
                  const imgBytes = bytes.slice(j + 8, j + dataSize);
                  const isPng = imgBytes.length >= 8 && imgBytes[0] === 0x89 && imgBytes[1] === 0x50;
                  const mime = isPng ? 'image/png' : 'image/jpeg';
                  result.artworkUrl = bytesToDataUrl(imgBytes, mime);
                }
                break;
              }
            }
          }
        }
      }

      // --- 2. ID3v2 Tag Inspection (for MP3 & others) ---
      else if (
        bytes.length > 10 &&
        bytes[0] === 0x49 &&
        bytes[1] === 0x44 &&
        bytes[2] === 0x33
      ) {
        const majorVersion = bytes[3];
        const tagSize = decodeSynchsafe(bytes, 6);
        const limit = Math.min(bytes.length, 10 + tagSize);

        let offset = 10;
        const decoder = new TextDecoder('utf-8');
        const latinDecoder = new TextDecoder('iso-8859-1');

        while (offset + 10 < limit) {
          const frameId = String.fromCharCode(
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3]
          );

          if (!/^[A-Z0-9]{4}$/.test(frameId)) {
            break;
          }

          let frameSize = 0;
          if (majorVersion === 4) {
            frameSize = decodeSynchsafe(bytes, offset + 4);
          } else {
            frameSize = (bytes[offset + 4] << 24) |
                        (bytes[offset + 5] << 16) |
                        (bytes[offset + 6] << 8) |
                        bytes[offset + 7];
          }

          if (frameSize <= 0 || offset + 10 + frameSize > limit) {
            break;
          }

          const frameBody = bytes.slice(offset + 10, offset + 10 + frameSize);
          const encodingByte = frameBody[0];

          const decodeText = (rawBytes: Uint8Array): string => {
            try {
              if (encodingByte === 0x01 || encodingByte === 0x02) {
                return new TextDecoder('utf-16').decode(rawBytes).replace(/\0/g, '').trim();
              } else if (encodingByte === 0x03) {
                return decoder.decode(rawBytes).replace(/\0/g, '').trim();
              }
              return latinDecoder.decode(rawBytes).replace(/\0/g, '').trim();
            } catch {
              return '';
            }
          };

          if (frameId === 'TIT2') {
            const val = decodeText(frameBody.slice(1));
            if (val) result.title = val;
          } else if (frameId === 'TPE1' || frameId === 'TPE2') {
            const val = decodeText(frameBody.slice(1));
            if (val) result.artist = val;
          } else if (frameId === 'TALB') {
            const val = decodeText(frameBody.slice(1));
            if (val) result.album = val;
          } else if (frameId === 'TYER' || frameId === 'TDRC') {
            const val = decodeText(frameBody.slice(1));
            if (val) result.year = val.slice(0, 4);
          } else if (frameId === 'USLT' || frameId === 'ULT') {
            let textOffset = 4;
            while (textOffset < frameBody.length && frameBody[textOffset] !== 0) {
              textOffset++;
            }
            textOffset++;
            if (textOffset < frameBody.length) {
              const lyricsText = decodeText(frameBody.slice(textOffset));
              if (lyricsText) result.lyrics = lyricsText;
            }
          } else if (frameId === 'APIC' || frameId === 'PIC') {
            let pOffset = 1;
            let mime = 'image/jpeg';
            const mimeStart = pOffset;
            while (pOffset < frameBody.length && frameBody[pOffset] !== 0) {
              pOffset++;
            }
            if (pOffset > mimeStart) {
              mime = latinDecoder.decode(frameBody.slice(mimeStart, pOffset));
            }
            pOffset++; // Skip null byte
            pOffset++; // Skip picture type byte
            while (pOffset < frameBody.length && frameBody[pOffset] !== 0) {
              pOffset++;
            }
            pOffset++; // Skip description null byte
            if (pOffset < frameBody.length) {
              const imageBytes = frameBody.slice(pOffset);
              result.artworkUrl = bytesToDataUrl(imageBytes, mime || 'image/jpeg');
            }
          }

          offset += 10 + frameSize;
        }
      }
    } catch (err) {
      console.warn('Metadata parsing notice:', err);
    }

    // Measure duration safely via HTMLAudioElement
    try {
      const audioUrl = URL.createObjectURL(file);
      const audio = new Audio();
      audio.preload = 'metadata';
      const durationPromise = new Promise<number>((resolve) => {
        audio.onloadedmetadata = () => {
          resolve(audio.duration || 0);
          URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = () => {
          resolve(0);
          URL.revokeObjectURL(audioUrl);
        };
        setTimeout(() => {
          resolve(0);
          URL.revokeObjectURL(audioUrl);
        }, 1200);
      });
      audio.src = audioUrl;
      result.duration = await durationPromise;
    } catch {
      result.duration = 0;
    }

    return result;
  }
};
