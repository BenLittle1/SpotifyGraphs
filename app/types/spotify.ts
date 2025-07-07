import { SimulationNodeDatum } from 'd3';

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: {
    id: string;
    name: string;
  }[];
  album: {
    id: string;
    name: string;
    images: {
      url: string;
      height: number;
      width: number;
    }[];
  };
  popularity: number;
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
  images: {
    url: string;
    height: number;
    width: number;
  }[];
  external_urls: {
    spotify: string;
  };
}

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  name: string;
  group: 'track' | 'artist' | 'genre';
  popularity?: number;
  imageUrl?: string;
  spotifyUrl?: string;
  radius?: number;
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