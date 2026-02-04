
import { Song, Album, Artist } from './types';

export const MOCK_SONGS: Song[] = [
  {
    id: '1',
    title: 'Hukum - Thalaivar Alappara',
    artist: 'Anirudh Ravichander',
    album: 'Jailer',
    artwork: 'https://picsum.photos/seed/jailer/400/400',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    duration: 210,
    language: 'Tamil',
    lyrics: "Hukum... Tiger ka Hukum...\nThalaivar Alappara...\n..."
  },
  {
    id: '2',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    artwork: 'https://picsum.photos/seed/weeknd/400/400',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    duration: 200,
    language: 'English',
    lyrics: "I've been on my own for long enough...\nI said, ooh, I'm blinded by the lights..."
  },
  {
    id: '3',
    title: 'Naa Ready',
    artist: 'Anirudh Ravichander',
    album: 'Leo',
    artwork: 'https://picsum.photos/seed/leo/400/400',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    duration: 240,
    language: 'Tamil'
  },
  {
    id: '4',
    title: 'Cruel Summer',
    artist: 'Taylor Swift',
    album: 'Lover',
    artwork: 'https://picsum.photos/seed/taylor/400/400',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    duration: 178,
    language: 'English'
  },
  {
    id: '5',
    title: 'Vaa Vaathi',
    artist: 'Shweta Mohan',
    album: 'Vaathi',
    artwork: 'https://picsum.photos/seed/vaathi/400/400',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    duration: 230,
    language: 'Tamil'
  }
];

export const MOCK_ALBUMS: Album[] = [
  { id: 'a1', title: 'Jailer', artist: 'Anirudh', artwork: 'https://picsum.photos/seed/jailer/400/400', songs: [MOCK_SONGS[0]] },
  { id: 'a2', title: 'After Hours', artist: 'The Weeknd', artwork: 'https://picsum.photos/seed/weeknd/400/400', songs: [MOCK_SONGS[1]] },
];

export const MOCK_ARTISTS: Artist[] = [
  { id: 'ar1', name: 'Anirudh Ravichander', artwork: 'https://picsum.photos/seed/anirudh/400/400', genre: 'Tamil Pop' },
  { id: 'ar2', name: 'The Weeknd', artwork: 'https://picsum.photos/seed/weeknd/400/400', genre: 'R&B/Pop' },
];
