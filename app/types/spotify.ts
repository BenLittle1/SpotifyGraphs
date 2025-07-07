import { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{
    id: string;
    name: string;
  }>;
  album: {
    id: string;
    name: string;
    images: Array<{
      url: string;
      height: number;
      width: number;
    }>;
  };
  popularity: number;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  external_urls: {
    spotify: string;
  };
}

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  name: string;
  group: 'genre' | 'artist' | 'track';
  radius?: number;
  popularity?: number;
  imageUrl?: string;
  spotifyUrl?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  strength: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface SpotifyError {
  error: {
    status: number;
    message: string;
  };
} 