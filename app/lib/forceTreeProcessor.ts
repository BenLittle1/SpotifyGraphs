import { SpotifyTrack, SpotifyArtist } from '@/app/types/spotify';
import { SimulationNodeDatum } from 'd3';

export interface ForceTreeNode extends SimulationNodeDatum {
  id: string;
  name: string;
  type: 'genre' | 'artist' | 'album' | 'track' | 'cluster' | 'genre-cluster' | 'album-cluster';
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
  type?: 'genre-artist' | 'artist-album' | 'album-track' | 'artist-track' | 'cluster-artist' | 'cluster-album' | 'cluster-track' | 'genre-cluster';
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
  // Allocate nodes: ~20% artists, ~20% albums, rest for tracks
  const artistRatio = maxNodes <= 400 ? 0.20 : 0.25;
  const albumRatio = maxNodes <= 400 ? 0.20 : 0.25;
  const artistNodeCount = Math.floor(maxNodes * artistRatio);
  const albumNodeCount = Math.floor(maxNodes * albumRatio);
  const trackNodeCount = maxNodes - sortedGenres.length - artistNodeCount - albumNodeCount; // Rest for tracks
  
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

  // Create album nodes
  const albumMap = new Map<string, ForceTreeNode>();
  const albumArtistMap = new Map<string, Set<string>>(); // album ID -> artist IDs
  const albumTrackMap = new Map<string, SpotifyTrack[]>(); // album ID -> tracks
  const albumPopularityMap = new Map<string, number>(); // album ID -> total popularity
  
  // Collect album data from tracks
  tracks.forEach(track => {
    if (!albumTrackMap.has(track.album.id)) {
      albumTrackMap.set(track.album.id, []);
    }
    albumTrackMap.get(track.album.id)!.push(track);
    
    // Track album popularity
    const currentPop = albumPopularityMap.get(track.album.id) || 0;
    albumPopularityMap.set(track.album.id, currentPop + (track.popularity || 0));
    
    // Track artists for this album
    if (!albumArtistMap.has(track.album.id)) {
      albumArtistMap.set(track.album.id, new Set());
    }
    track.artists.forEach(artist => {
      albumArtistMap.get(track.album.id)!.add(artist.id);
    });
  });
  
  // Helper function to check if an album is a single
  const isSingle = (albumId: string): boolean => {
    const albumTracks = albumTrackMap.get(albumId) || [];
    if (albumTracks.length !== 1) return false;
    
    const track = albumTracks[0];
    const albumName = track.album.name.toLowerCase().trim();
    const trackName = track.name.toLowerCase().trim();
    
    // Check if names are identical or very similar
    return albumName === trackName || 
           albumName.includes(trackName) || 
           trackName.includes(albumName);
  };

  // Sort albums by popularity and create nodes for top albums (excluding singles)
  const sortedAlbumIds = Array.from(albumPopularityMap.keys())
    .filter(albumId => !isSingle(albumId)) // Skip singles
    .sort((a, b) => albumPopularityMap.get(b)! - albumPopularityMap.get(a)!);
  
  sortedAlbumIds.slice(0, albumNodeCount).forEach(albumId => {
    const albumTracks = albumTrackMap.get(albumId) || [];
    if (albumTracks.length === 0) return;
    
    const firstTrack = albumTracks[0];
    const albumPopularity = albumTracks.reduce((sum, t) => sum + t.popularity, 0) / albumTracks.length;
    
    const albumNodeId = `album-${albumId}`;
    const albumNode: ForceTreeNode = {
      id: albumNodeId,
      name: firstTrack.album.name,
      type: 'album',
      value: albumPopularity,
      popularity: albumPopularity,
      imageUrl: firstTrack.album.images?.[0]?.url,
      depth: 1.5, // Between artist and track
      parent: undefined // Will be set below
    };
    
    nodes.push(albumNode);
    nodeMap.set(albumNodeId, albumNode);
    albumMap.set(albumId, albumNode);
    
    // Create invisible album clustering node
    const albumClusterId = `album-cluster-${albumId}`;
    const albumClusterNode: ForceTreeNode = {
      id: albumClusterId,
      name: `${firstTrack.album.name} cluster`,
      type: 'album-cluster',
      value: albumPopularity,
      depth: 1.7,
      invisible: true,
    };
    nodes.push(albumClusterNode);
    nodeMap.set(albumClusterId, albumClusterNode);
    
    // Link album to its artists
    let primaryArtist: string | null = null;
    albumArtistMap.get(albumId)!.forEach(artistId => {
      const artistNodeId = `artist-${artistId}`;
      if (nodeMap.has(artistNodeId)) {
        // Set first artist as primary parent
        if (!primaryArtist) {
          primaryArtist = artistNodeId;
          albumNode.parent = artistNodeId;
        }
        
        links.push({
          source: artistNodeId,
          target: albumNodeId,
          value: albumPopularity,
          type: 'artist-album'
        });
        
        // Link to album clustering
        links.push({
          source: albumNodeId,
          target: albumClusterId,
          value: albumPopularity * 0.8,
          type: 'cluster-album'
        });
      }
    });
  });

  // Create track nodes and links
  // Collect all unique tracks with their albums (if album exists) or artists
  const allTracksWithParents: Array<[SpotifyTrack, ForceTreeNode]> = [];
  
  // First add tracks from created albums
  albumMap.forEach((albumNode, albumId) => {
    const albumTracks = albumTrackMap.get(albumId) || [];
    albumTracks.forEach(track => {
      if (!allTracksWithParents.find(([t, _]) => t.id === track.id)) {
        allTracksWithParents.push([track, albumNode]);
      }
    });
  });
  
  // Then add remaining tracks directly to artists (for albums that weren't created)
  nodes.filter(n => n.type === 'artist').forEach(artistNode => {
    const artistId = artistNode.id.replace('artist-', '');
    
    // Get all tracks for this artist
    const artistTracks: SpotifyTrack[] = [];
    genreArtistMap.forEach(artistsMap => {
      if (artistsMap.has(artistId)) {
        artistTracks.push(...artistsMap.get(artistId)!);
      }
    });
    
    // Add unique tracks that don't already have an album parent
    artistTracks.forEach(track => {
      if (!allTracksWithParents.find(([t, _]) => t.id === track.id)) {
        allTracksWithParents.push([track, artistNode]);
      }
    });
  });
  
  // Sort all tracks by popularity and take the top ones
  allTracksWithParents
    .sort((a, b) => (b[0].popularity || 0) - (a[0].popularity || 0))
    .slice(0, trackNodeCount)
    .forEach(([track, parentNode]) => {
      const trackNodeId = `track-${track.id}`;
      const trackNode: ForceTreeNode = {
        id: trackNodeId,
        name: track.name,
        type: 'track',
        value: track.popularity || 50,
        popularity: track.popularity,
        imageUrl: track.album?.images?.[0]?.url,
        spotifyUrl: track.external_urls?.spotify,
        depth: parentNode.type === 'album' ? 2.5 : 2,
        parent: parentNode.id
      };
      
      nodes.push(trackNode);
      nodeMap.set(trackNodeId, trackNode);
      
      // Create link from parent (album or artist) to track
      if (parentNode.type === 'album') {
        links.push({
          source: parentNode.id,
          target: trackNodeId,
          value: track.popularity || 50,
          type: 'album-track'
        });
        
        // Also link to album clustering
        const albumClusterId = `album-cluster-${track.album.id}`;
        if (nodeMap.has(albumClusterId)) {
          links.push({
            source: trackNodeId,
            target: albumClusterId,
            value: (track.popularity || 50) * 0.5,
            type: 'cluster-track'
          });
        }
      } else {
        // Direct artist to track link
        links.push({
          source: parentNode.id,
          target: trackNodeId,
          value: track.popularity || 50,
          type: 'artist-track'
        });
      }

      // Link tracks to genre clustering nodes for natural grouping
      track.artists.forEach(trackArtist => {
        const artist = artistMap.get(trackArtist.id);
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
    });

  return { nodes, links };
} 