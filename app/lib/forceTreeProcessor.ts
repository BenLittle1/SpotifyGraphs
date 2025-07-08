import { SpotifyTrack, SpotifyArtist } from '@/app/types/spotify';
import { SimulationNodeDatum } from 'd3';

export interface ForceTreeNode extends SimulationNodeDatum {
  id: string;
  name: string;
  type: 'genre' | 'artist' | 'track' | 'cluster';
  value: number;
  popularity?: number;
  imageUrl?: string;
  spotifyUrl?: string;
  depth: number;
  parent?: string;
  invisible?: boolean; // Mark nodes as invisible for clustering
}

export interface ForceTreeLink {
  source: string;
  target: string;
  value: number;
  type?: 'genre-artist' | 'artist-track' | 'genre-cluster' | 'cluster-artist' | 'cluster-track';
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

  // Dynamically calculate genre count based on total nodes
  const maxGenres = Math.min(
    genreArtistMap.size, // Don't exceed available genres
    Math.max(5, Math.floor(maxNodes / 40)) // At least 5 genres, scale up with node count
  );
  
  const sortedGenres = Array.from(genreArtistMap.keys())
    .sort((a, b) => (genrePopularity.get(b) || 0) - (genrePopularity.get(a) || 0))
    .slice(0, maxGenres);

  // Create genre nodes and clustering nodes
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

    // Create invisible clustering node for this genre
    const clusterId = `cluster-${genre}`;
    const clusterNode: ForceTreeNode = {
      id: clusterId,
      name: `${genre} cluster`,
      type: 'cluster',
      value: genrePopularity.get(genre) || 0,
      depth: 0.5, // Between genre and artist
      invisible: true,
    };
    nodes.push(clusterNode);
    nodeMap.set(clusterId, clusterNode);
  });

  // Create artist nodes and links
  // Use 25-35% of nodes for artists depending on total node count
  const artistRatio = maxNodes <= 400 ? 0.25 : 0.35;
  const artistNodeCount = Math.floor(maxNodes * artistRatio);
  const trackNodeCount = maxNodes - sortedGenres.length - artistNodeCount; // Rest for tracks
  
  // Collect unique artists and their total popularity across all genres
  const artistPopularityMap = new Map<string, number>();
  const artistGenresMap = new Map<string, string[]>();
  
  sortedGenres.forEach(genre => {
    const artistsInGenre = genreArtistMap.get(genre)!;
    artistsInGenre.forEach((tracks, artistId) => {
      // Calculate total popularity for this artist
      const totalPop = tracks.reduce((sum, track) => sum + (track.popularity || 0), 0);
      
      // Add to or update artist's total popularity
      if (artistPopularityMap.has(artistId)) {
        artistPopularityMap.set(artistId, artistPopularityMap.get(artistId)! + totalPop);
      } else {
        artistPopularityMap.set(artistId, totalPop);
      }
      
      // Track which genres this artist belongs to
      if (!artistGenresMap.has(artistId)) {
        artistGenresMap.set(artistId, []);
      }
      artistGenresMap.get(artistId)!.push(genre);
    });
  });
  
  // Sort artists by total popularity and get unique artists
  const sortedArtistIds = Array.from(artistPopularityMap.keys())
    .sort((a, b) => artistPopularityMap.get(b)! - artistPopularityMap.get(a)!);
  
  // Create unique artist nodes
  const createdArtistNodes = new Set<string>();
  
  sortedArtistIds.slice(0, artistNodeCount).forEach(artistId => {
    if (createdArtistNodes.has(artistId)) return; // Skip if already created
    
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
      parent: undefined // Will be set to primary genre below
    };
    
    nodes.push(artistNode);
    nodeMap.set(artistNodeId, artistNode);
    createdArtistNodes.add(artistId);
    
    // Link to all genres this artist belongs to (from selected genres)
    const artistGenres = artistGenresMap.get(artistId) || [];
    let primaryGenre: string | null = null;
    
    artistGenres.forEach(genre => {
      if (sortedGenres.includes(genre)) {
        const genreId = `genre-${genre}`;
        
        // Set the first genre as primary parent
        if (!primaryGenre) {
          primaryGenre = genreId;
          artistNode.parent = genreId;
        }
        
        // Get tracks for this artist in this genre
        const artistsInGenre = genreArtistMap.get(genre)!;
        const tracksInGenre = artistsInGenre.get(artistId) || [];
        
        // Create link from genre to artist
        links.push({
          source: genreId,
          target: artistNodeId,
          value: tracksInGenre.length,
          type: 'genre-artist'
        });

        // Create link from clustering node to artist for natural grouping
        const clusterId = `cluster-${genre}`;
        if (nodeMap.has(clusterId)) {
          links.push({
            source: clusterId,
            target: artistNodeId,
            value: tracksInGenre.length * 1.5, // Stronger clustering force
            type: 'cluster-artist'
          });
        }
      }
    });
  });

  // Create track nodes and links
  // Collect all unique tracks with their artists
  const allTracksWithArtists: Array<[SpotifyTrack, ForceTreeNode]> = [];
  
  nodes.filter(n => n.type === 'artist').forEach(artistNode => {
    const artistId = artistNode.id.replace('artist-', '');
    
    // Get all tracks for this artist
    const artistTracks: SpotifyTrack[] = [];
    genreArtistMap.forEach(artistsMap => {
      if (artistsMap.has(artistId)) {
        artistTracks.push(...artistsMap.get(artistId)!);
      }
    });
    
    // Add unique tracks with their artist reference
    artistTracks.forEach(track => {
      if (!allTracksWithArtists.find(([t, _]) => t.id === track.id)) {
        allTracksWithArtists.push([track, artistNode]);
      }
    });
  });
  
  // Sort all tracks by popularity and take the top ones
  allTracksWithArtists
    .sort((a, b) => (b[0].popularity || 0) - (a[0].popularity || 0))
    .slice(0, trackNodeCount)
    .forEach(([track, artistNode]) => {
      const trackNodeId = `track-${track.id}`;
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
      
      // Create link from artist to track
      links.push({
        source: artistNode.id,
        target: trackNodeId,
        value: track.popularity || 50,
        type: 'artist-track'
      });

      // Link tracks to genre clustering nodes for natural grouping
      const artistId = artistNode.id.replace('artist-', '');
      const artist = artistMap.get(artistId);
      if (artist) {
        artist.genres.forEach(genre => {
          if (sortedGenres.includes(genre)) {
            const clusterId = `cluster-${genre}`;
            if (nodeMap.has(clusterId)) {
              links.push({
                source: trackNodeId,
                target: clusterId,
                value: (track.popularity || 50) * 0.6, // Medium clustering force for tracks
                type: 'cluster-track'
              });
            }
          }
        });
      }
    });

  return { nodes, links };
} 