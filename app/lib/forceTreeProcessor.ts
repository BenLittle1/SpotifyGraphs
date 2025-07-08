import { SpotifyTrack, SpotifyArtist } from '@/app/types/spotify';
import { SimulationNodeDatum } from 'd3';

export interface ForceTreeNode extends SimulationNodeDatum {
  id: string;
  name: string;
  type: 'genre' | 'artist' | 'track';
  value: number;
  popularity?: number;
  imageUrl?: string;
  spotifyUrl?: string;
  depth: number;
  parent?: string;
}

export interface ForceTreeLink {
  source: string;
  target: string;
  value: number;
}

export interface ForceTreeData {
  nodes: ForceTreeNode[];
  links: ForceTreeLink[];
}

export function processSpotifyDataToForceTree(
  tracks: SpotifyTrack[],
  artists: SpotifyArtist[],
  maxNodes: number = 400
): ForceTreeData {
  const nodes: ForceTreeNode[] = [];
  const links: ForceTreeLink[] = [];
  const nodeMap = new Map<string, ForceTreeNode>();
  
  // Create a map of artist ID to artist data
  const artistMap = new Map<string, SpotifyArtist>();
  artists.forEach(artist => {
    artistMap.set(artist.id, artist);
  });

  // Group tracks by genre -> artist
  const genreArtistMap = new Map<string, Map<string, SpotifyTrack[]>>();
  
  tracks.forEach(track => {
    track.artists.forEach(trackArtist => {
      const fullArtist = artistMap.get(trackArtist.id);
      if (fullArtist && fullArtist.genres) {
        fullArtist.genres.forEach(genre => {
          if (!genreArtistMap.has(genre)) {
            genreArtistMap.set(genre, new Map());
          }
          const artistsInGenre = genreArtistMap.get(genre)!;
          
          if (!artistsInGenre.has(fullArtist.id)) {
            artistsInGenre.set(fullArtist.id, []);
          }
          artistsInGenre.get(fullArtist.id)!.push(track);
        });
      }
    });
  });

  // Sort genres by total popularity
  const genrePopularity = new Map<string, number>();
  genreArtistMap.forEach((artistsMap, genre) => {
    let totalPop = 0;
    artistsMap.forEach(tracks => {
      tracks.forEach(track => {
        totalPop += track.popularity || 0;
      });
    });
    genrePopularity.set(genre, totalPop);
  });

  const sortedGenres = Array.from(genreArtistMap.keys())
    .sort((a, b) => (genrePopularity.get(b) || 0) - (genrePopularity.get(a) || 0))
    .slice(0, Math.min(8, Math.floor(maxNodes / 50))); // Limit genres based on node count

  // Create genre nodes
  sortedGenres.forEach(genre => {
    const genreId = `genre-${genre}`;
    const genreNode: ForceTreeNode = {
      id: genreId,
      name: genre,
      type: 'genre',
      value: genrePopularity.get(genre) || 0,
      depth: 0
    };
    nodes.push(genreNode);
    nodeMap.set(genreId, genreNode);
  });

  // Create artist nodes and links
  const artistNodeCount = Math.floor(maxNodes * 0.3); // 30% of nodes for artists
  const trackNodeCount = maxNodes - nodes.length - artistNodeCount; // Rest for tracks
  
  let artistCount = 0;
  
  sortedGenres.forEach(genre => {
    const artistsInGenre = genreArtistMap.get(genre)!;
    const genreId = `genre-${genre}`;
    
    // Sort artists by popularity within genre
    const sortedArtists = Array.from(artistsInGenre.entries())
      .sort((a, b) => {
        const popA = a[1].reduce((sum, track) => sum + (track.popularity || 0), 0);
        const popB = b[1].reduce((sum, track) => sum + (track.popularity || 0), 0);
        return popB - popA;
      })
      .slice(0, Math.ceil(artistNodeCount / sortedGenres.length)); // Distribute artists evenly
    
    sortedArtists.forEach(([artistId, artistTracks]) => {
      if (artistCount >= artistNodeCount) return;
      
      const artist = artistMap.get(artistId);
      if (!artist) return;
      
      const artistNodeId = `artist-${artistId}`;
      const artistNode: ForceTreeNode = {
        id: artistNodeId,
        name: artist.name,
        type: 'artist',
        value: artist.popularity || 50,
        popularity: artist.popularity,
        imageUrl: artist.images?.[0]?.url,
        spotifyUrl: artist.external_urls?.spotify,
        depth: 1,
        parent: genreId
      };
      
      nodes.push(artistNode);
      nodeMap.set(artistNodeId, artistNode);
      artistCount++;
      
      // Create link from genre to artist
      links.push({
        source: genreId,
        target: artistNodeId,
        value: artistTracks.length
      });
    });
  });

  // Create track nodes and links
  let trackCount = 0;
  const tracksPerArtist = Math.ceil(trackNodeCount / artistCount);
  
  nodes.filter(n => n.type === 'artist').forEach(artistNode => {
    const artistId = artistNode.id.replace('artist-', '');
    
    // Get all tracks for this artist
    const artistTracks: SpotifyTrack[] = [];
    genreArtistMap.forEach(artistsMap => {
      if (artistsMap.has(artistId)) {
        artistTracks.push(...artistsMap.get(artistId)!);
      }
    });
    
    // Remove duplicates and sort by popularity
    const uniqueTracks = Array.from(
      new Map(artistTracks.map(t => [t.id, t])).values()
    ).sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, tracksPerArtist);
    
    uniqueTracks.forEach(track => {
      if (trackCount >= trackNodeCount) return;
      
      const trackNodeId = `track-${track.id}`;
      if (!nodeMap.has(trackNodeId)) { // Avoid duplicates
        const trackNode: ForceTreeNode = {
          id: trackNodeId,
          name: track.name,
          type: 'track',
          value: track.popularity || 50,
          popularity: track.popularity,
          imageUrl: track.album?.images?.[0]?.url,
          spotifyUrl: track.external_urls?.spotify,
          depth: 2,
          parent: artistNode.id
        };
        
        nodes.push(trackNode);
        nodeMap.set(trackNodeId, trackNode);
        trackCount++;
        
        // Create link from artist to track
        links.push({
          source: artistNode.id,
          target: trackNodeId,
          value: track.popularity || 50
        });
      }
    });
  });

  return { nodes, links };
} 