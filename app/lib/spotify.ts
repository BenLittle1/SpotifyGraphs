import { SpotifyTrack, SpotifyArtist, SpotifyError } from '@/app/types/spotify';

class SpotifyClient {
  private accessToken: string;
  private baseUrl = 'https://api.spotify.com/v1';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async fetchWithRetry(url: string, retries = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        });

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : 1000 * (i + 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (response.status === 403) {
          throw new Error('Access token expired or invalid. Please sign out and sign back in.');
        }

        if (response.status === 401) {
          throw new Error('Unauthorized. Please sign out and sign back in.');
        }

        return response;
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    
    throw new Error('Max retries reached');
  }

  async getTopTracks(limit = 50, timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term'): Promise<SpotifyTrack[]> {
    try {
      const response = await this.fetchWithRetry(
        `${this.baseUrl}/me/top/tracks?limit=${limit}&time_range=${timeRange}`
      );

      if (!response.ok) {
        // Check if response is HTML (Spotify error page) instead of JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          throw new Error('Authentication failed. Please sign out and sign back in.');
        }
        
        try {
          const error: SpotifyError = await response.json();
          throw new Error(`Spotify API Error: ${error.error.message}`);
        } catch (jsonError) {
          throw new Error('Authentication failed. Please sign out and sign back in.');
        }
      }

      const data = await response.json();
      return data.items;
    } catch (error) {
      console.error('Error fetching top tracks:', error);
      throw error;
    }
  }

  async getTopArtists(limit = 50, timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term'): Promise<SpotifyArtist[]> {
    try {
      const response = await this.fetchWithRetry(
        `${this.baseUrl}/me/top/artists?limit=${limit}&time_range=${timeRange}`
      );

      if (!response.ok) {
        // Check if response is HTML (Spotify error page) instead of JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          throw new Error('Authentication failed. Please sign out and sign back in.');
        }
        
        try {
          const error: SpotifyError = await response.json();
          throw new Error(`Spotify API Error: ${error.error.message}`);
        } catch (jsonError) {
          throw new Error('Authentication failed. Please sign out and sign back in.');
        }
      }

      const data = await response.json();
      return data.items;
    } catch (error) {
      console.error('Error fetching top artists:', error);
      throw error;
    }
  }

  async getSavedTracks(limit = 50, offset = 0): Promise<SpotifyTrack[]> {
    try {
      const response = await this.fetchWithRetry(
        `${this.baseUrl}/me/tracks?limit=${limit}&offset=${offset}`
      );

      if (!response.ok) {
        // Check if response is HTML (Spotify error page) instead of JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          throw new Error('Authentication failed. Please sign out and sign back in.');
        }
        
        try {
          const error: SpotifyError = await response.json();
          throw new Error(`Spotify API Error: ${error.error.message}`);
        } catch (jsonError) {
          throw new Error('Authentication failed. Please sign out and sign back in.');
        }
      }

      const data = await response.json();
      return data.items.map((item: any) => item.track);
    } catch (error) {
      console.error('Error fetching saved tracks:', error);
      throw error;
    }
  }

  async getArtist(artistId: string): Promise<SpotifyArtist> {
    try {
      const response = await this.fetchWithRetry(
        `${this.baseUrl}/artists/${artistId}`
      );

      if (!response.ok) {
        // Check if response is HTML (Spotify error page) instead of JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          throw new Error('Authentication failed. Please sign out and sign back in.');
        }
        
        try {
          const error: SpotifyError = await response.json();
          throw new Error(`Spotify API Error: ${error.error.message}`);
        } catch (jsonError) {
          throw new Error('Authentication failed. Please sign out and sign back in.');
        }
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching artist:', error);
      throw error;
    }
  }

  async getMultipleArtists(artistIds: string[]): Promise<SpotifyArtist[]> {
    try {
      // Spotify API allows max 50 artists per request
      const chunks = [];
      for (let i = 0; i < artistIds.length; i += 50) {
        chunks.push(artistIds.slice(i, i + 50));
      }

      const allArtists: SpotifyArtist[] = [];
      
      for (const chunk of chunks) {
        const response = await this.fetchWithRetry(
          `${this.baseUrl}/artists?ids=${chunk.join(',')}`
        );

        if (!response.ok) {
          // Check if response is HTML (Spotify error page) instead of JSON
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('text/html')) {
            throw new Error('Authentication failed. Please sign out and sign back in.');
          }
          
          try {
            const error: SpotifyError = await response.json();
            throw new Error(`Spotify API Error: ${error.error.message}`);
          } catch (jsonError) {
            throw new Error('Authentication failed. Please sign out and sign back in.');
          }
        }

        const data = await response.json();
        allArtists.push(...data.artists);
      }

      return allArtists;
    } catch (error) {
      console.error('Error fetching multiple artists:', error);
      throw error;
    }
  }

  async getUserPlaylists(limit = 50, offset = 0): Promise<any[]> {
    try {
      const response = await this.fetchWithRetry(
        `${this.baseUrl}/me/playlists?limit=${limit}&offset=${offset}`
      );

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          throw new Error('Authentication failed. Please sign out and sign back in.');
        }
        
        try {
          const error: SpotifyError = await response.json();
          throw new Error(`Spotify API Error: ${error.error.message}`);
        } catch (jsonError) {
          throw new Error('Authentication failed. Please sign out and sign back in.');
        }
      }

      const data = await response.json();
      return data.items;
    } catch (error) {
      console.error('Error fetching playlists:', error);
      throw error;
    }
  }

  async getRecentlyPlayed(limit = 50): Promise<SpotifyTrack[]> {
    try {
      const response = await this.fetchWithRetry(
        `${this.baseUrl}/me/player/recently-played?limit=${limit}`
      );

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          throw new Error('Authentication failed. Please sign out and sign back in.');
        }
        
        try {
          const error: SpotifyError = await response.json();
          throw new Error(`Spotify API Error: ${error.error.message}`);
        } catch (jsonError) {
          throw new Error('Authentication failed. Please sign out and sign back in.');
        }
      }

      const data = await response.json();
      return data.items.map((item: any) => item.track);
    } catch (error) {
      console.error('Error fetching recently played tracks:', error);
      throw error;
    }
  }

  async getPlaylistTracks(playlistId: string, limit = 100, offset = 0): Promise<SpotifyTrack[]> {
    try {
      const response = await this.fetchWithRetry(
        `${this.baseUrl}/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`
      );

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          throw new Error('Authentication failed. Please sign out and sign back in.');
        }
        
        try {
          const error: SpotifyError = await response.json();
          throw new Error(`Spotify API Error: ${error.error.message}`);
        } catch (jsonError) {
          throw new Error('Authentication failed. Please sign out and sign back in.');
        }
      }

      const data = await response.json();
      return data.items
        .filter((item: any) => item.track && item.track.id) // Filter out null or local tracks
        .map((item: any) => item.track);
    } catch (error) {
      console.error('Error fetching playlist tracks:', error);
      throw error;
    }
  }

  async getArtistAlbums(artistId: string, includeGroups: string = 'album,single', limit = 50, offset = 0): Promise<any[]> {
    try {
      const response = await this.fetchWithRetry(
        `${this.baseUrl}/artists/${artistId}/albums?include_groups=${includeGroups}&limit=${limit}&offset=${offset}`
      );

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          throw new Error('Authentication failed. Please sign out and sign back in.');
        }
        
        try {
          const error: SpotifyError = await response.json();
          throw new Error(`Spotify API Error: ${error.error.message}`);
        } catch (jsonError) {
          throw new Error('Authentication failed. Please sign out and sign back in.');
        }
      }

      const data = await response.json();
      return data.items;
    } catch (error) {
      console.error('Error fetching artist albums:', error);
      throw error;
    }
  }

  async getAlbumTracks(albumId: string, limit = 50, offset = 0): Promise<SpotifyTrack[]> {
    try {
      const response = await this.fetchWithRetry(
        `${this.baseUrl}/albums/${albumId}/tracks?limit=${limit}&offset=${offset}`
      );

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          throw new Error('Authentication failed. Please sign out and sign back in.');
        }
        
        try {
          const error: SpotifyError = await response.json();
          throw new Error(`Spotify API Error: ${error.error.message}`);
        } catch (jsonError) {
          throw new Error('Authentication failed. Please sign out and sign back in.');
        }
      }

      const data = await response.json();
      // Add album info to each track since album endpoints don't include full track info
      return data.items.map((track: any) => ({
        ...track,
        album: {
          id: albumId,
          // These will need to be filled in by the caller if needed
          name: '',
          images: []
        }
      }));
    } catch (error) {
      console.error('Error fetching album tracks:', error);
      throw error;
    }
  }
}

export default SpotifyClient; 