
export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  url: string;
  duration: number;
  lyrics?: string;
  language: 'Tamil' | 'English';
}

export interface Playlist {
  id: string;
  name: string;
  songs: Song[];
  artwork: string;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  songs: Song[];
}

export interface Artist {
  id: string;
  name: string;
  artwork: string;
  genre: string;
}

export type AppView = 'home' | 'search' | 'library';
