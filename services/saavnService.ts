
const BASE_URL = 'https://saavnapi-red.vercel.app';

export const saavnService = {
  async searchAll(query: string) {
    const res = await fetch(`${BASE_URL}/api/search?query=${encodeURIComponent(query)}`);
    const json = await res.json();
    return json.data;
  },

  async searchSongs(query: string, page = 0, limit = 20) {
    const res = await fetch(`${BASE_URL}/api/search/songs?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
    const json = await res.json();
    return json.data.results;
  },

  async getSongDetails(id: string) {
    const res = await fetch(`${BASE_URL}/api/songs/${id}`);
    const json = await res.json();
    return json.data[0];
  },

  async getSuggestions(id: string, limit = 10) {
    const res = await fetch(`${BASE_URL}/api/songs/${id}/suggestions?limit=${limit}`);
    const json = await res.json();
    return json.data;
  },

  async getAlbumDetails(id: string) {
    const res = await fetch(`${BASE_URL}/api/albums?id=${id}`);
    const json = await res.json();
    return json.data;
  },

  async getArtistDetails(id: string) {
    const res = await fetch(`${BASE_URL}/api/artists/${id}`);
    const json = await res.json();
    return json.data;
  },

  async getPlaylistDetails(id: string) {
    const res = await fetch(`${BASE_URL}/api/playlists?id=${id}`);
    const json = await res.json();
    return json.data;
  },

  // Helper to map API song to our internal Song type
  mapSong(apiSong: any) {
    // Pick highest quality image
    const artwork = apiSong.image?.[apiSong.image.length - 1]?.url || '';
    // Pick highest quality download link (usually 320kbps is last)
    const url = apiSong.downloadUrl?.[apiSong.downloadUrl.length - 1]?.url || '';
    
    return {
      id: apiSong.id,
      title: apiSong.name || apiSong.title,
      artist: apiSong.primaryArtists || apiSong.artists?.primary?.[0]?.name || 'Unknown Artist',
      album: apiSong.album?.name || apiSong.album || 'Unknown Album',
      artwork,
      url,
      duration: apiSong.duration,
      language: apiSong.language,
      hasLyrics: apiSong.hasLyrics,
      lyricsId: apiSong.lyricsId
    };
  }
};
