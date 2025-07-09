import { SpotifyTrack, SpotifyArtist, GraphNode, GraphLink, GraphData } from '@/app/types/spotify';

export function processSpotifyDataToGraph(
  tracks: SpotifyTrack[],
  artists: SpotifyArtist[]
): GraphData {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const nodeMap = new Map<string, GraphNode>();

  // First, collect all genres and their artists for similarity calculation
  const genreArtistsMap = new Map<string, Set<string>>();
  artists.forEach(artist => {
    artist.genres.forEach(genre => {
      if (!genreArtistsMap.has(genre)) {
        genreArtistsMap.set(genre, new Set());
      }
      genreArtistsMap.get(genre)!.add(artist.id);
    });
  });

  // Calculate genre similarity based on shared artists (Jaccard similarity)
  const calculateGenreSimilarity = (genre1: string, genre2: string): number => {
    const artists1 = genreArtistsMap.get(genre1) || new Set();
    const artists2 = genreArtistsMap.get(genre2) || new Set();
    
    const artists1Array = Array.from(artists1);
    const artists2Array = Array.from(artists2);
    
    const intersection = new Set(artists1Array.filter(x => artists2.has(x)));
    const union = new Set([...artists1Array, ...artists2Array]);
    
    return intersection.size / union.size; // Jaccard coefficient
  };

  // Create genre clusters based on similarity
  const genreList = Array.from(genreArtistsMap.keys());
  const genreClusters = new Map<string, string[]>(); // cluster ID -> genres
  const genreToCluster = new Map<string, string>(); // genre -> cluster ID
  const similarityThreshold = 0.3; // Threshold for clustering
  let clusterCounter = 0;

  // Simple clustering algorithm
  genreList.forEach(genre => {
    if (genreToCluster.has(genre)) return; // Already assigned

    const cluster: string[] = [genre];
    const clusterId = `genre-cluster-${clusterCounter++}`;
    
    // Find similar genres
    genreList.forEach(otherGenre => {
      if (genre !== otherGenre && !genreToCluster.has(otherGenre)) {
        const similarity = calculateGenreSimilarity(genre, otherGenre);
        if (similarity >= similarityThreshold) {
          cluster.push(otherGenre);
        }
      }
    });

    // Assign genres to cluster
    cluster.forEach(g => genreToCluster.set(g, clusterId));
    genreClusters.set(clusterId, cluster);
  });

  // Create genre nodes and clustering nodes
  const genreMap = new Map<string, GraphNode>();
  const clusterMap = new Map<string, GraphNode>();
  const genreClusterMap = new Map<string, GraphNode>(); // For genre clustering nodes
  
  artists.forEach(artist => {
    artist.genres.forEach(genre => {
      if (!genreMap.has(genre)) {
        const genreNode: GraphNode = {
          id: `genre-${genre}`,
          name: genre,
          group: 'genre',
          radius: 20,
        };
        genreMap.set(genre, genreNode);
        nodeMap.set(genreNode.id, genreNode);
        nodes.push(genreNode);

        // Create invisible clustering node for this genre (artist clustering)
        const clusterNode: GraphNode = {
          id: `cluster-${genre}`,
          name: `${genre} cluster`,
          group: 'cluster',
          radius: 5,
          invisible: true,
        };
        clusterMap.set(genre, clusterNode);
        nodeMap.set(clusterNode.id, clusterNode);
        nodes.push(clusterNode);
      }
    });
  });

  // Create genre cluster nodes (for genre clustering)
  genreClusters.forEach((genres, clusterId) => {
    if (genres.length > 1) { // Only create cluster if it has multiple genres
      const clusterName = genres.slice(0, 2).join(' + ') + (genres.length > 2 ? '...' : '');
      const genreClusterNode: GraphNode = {
        id: clusterId,
        name: `${clusterName} cluster`,
        group: 'genre-cluster',
        radius: 8,
        invisible: true,
      };
      genreClusterMap.set(clusterId, genreClusterNode);
      nodeMap.set(genreClusterNode.id, genreClusterNode);
      nodes.push(genreClusterNode);
    }
  });

  // Create genre clustering links
  genreClusters.forEach((genres, clusterId) => {
    if (genres.length > 1) {
      genres.forEach(genre => {
        const genreNode = genreMap.get(genre);
        const genreClusterNode = genreClusterMap.get(clusterId);
        if (genreNode && genreClusterNode) {
          links.push({
            source: genreNode.id,
            target: genreClusterNode.id,
            strength: 0.6,
            type: 'genre-cluster',
          });
        }
      });
    }
  });

  // Create artist nodes (deduplicate by ID just in case)
  const processedArtistIds = new Set<string>();
  artists.forEach(artist => {
    if (processedArtistIds.has(artist.id)) return; // Skip duplicates
    
    const artistNode: GraphNode = {
      id: `artist-${artist.id}`,
      name: artist.name,
      group: 'artist',
      popularity: artist.popularity,
      imageUrl: artist.images[0]?.url,
      spotifyUrl: artist.external_urls.spotify,
      radius: Math.max(15, Math.min(30, artist.popularity / 3)),
    };
    nodeMap.set(artistNode.id, artistNode);
    nodes.push(artistNode);
    processedArtistIds.add(artist.id);

    // Link artists to their genres
    artist.genres.forEach(genre => {
      const genreNode = genreMap.get(genre);
      if (genreNode) {
        links.push({
          source: artistNode.id,
          target: genreNode.id,
          strength: 0.5,
          type: 'genre-artist',
        });
      }

      // Link artists to their clustering nodes for natural grouping
      const clusterNode = clusterMap.get(genre);
      if (clusterNode) {
        links.push({
          source: artistNode.id,
          target: clusterNode.id,
          strength: 0.8, // Stronger clustering force
          type: 'cluster-artist',
        });
      }
    });
  });

  // Helper function to check if an album is a single
  const isSingle = (albumId: string): boolean => {
    const albumTracks = tracks.filter(t => t.album.id === albumId);
    if (albumTracks.length !== 1) return false;
    
    const track = albumTracks[0];
    const albumName = track.album.name.toLowerCase().trim();
    const trackName = track.name.toLowerCase().trim();
    
    // Check if names are identical or very similar
    return albumName === trackName || 
           albumName.includes(trackName) || 
           trackName.includes(albumName);
  };

  // Create album nodes and clustering nodes (excluding singles)
  const albumMap = new Map<string, GraphNode>();
  const albumClusterMap = new Map<string, GraphNode>();
  const albumArtistMap = new Map<string, Set<string>>(); // album ID -> artist IDs
  
  tracks.forEach(track => {
    if (!albumMap.has(track.album.id) && !isSingle(track.album.id)) {
      // Calculate album popularity as average of its tracks
      const albumTracks = tracks.filter(t => t.album.id === track.album.id);
      const albumPopularity = albumTracks.reduce((sum, t) => sum + t.popularity, 0) / albumTracks.length;
      
      const albumNode: GraphNode = {
        id: `album-${track.album.id}`,
        name: track.album.name,
        group: 'album',
        popularity: albumPopularity,
        imageUrl: track.album.images[0]?.url,
        radius: Math.max(12, Math.min(25, albumPopularity / 4)),
      };
      albumMap.set(track.album.id, albumNode);
      nodeMap.set(albumNode.id, albumNode);
      nodes.push(albumNode);
      
      // Create invisible album clustering node
      const albumClusterNode: GraphNode = {
        id: `album-cluster-${track.album.id}`,
        name: `${track.album.name} cluster`,
        group: 'album-cluster',
        radius: 3,
        invisible: true,
      };
      albumClusterMap.set(track.album.id, albumClusterNode);
      nodeMap.set(albumClusterNode.id, albumClusterNode);
      nodes.push(albumClusterNode);
    }
    
    // Track which artists are on this album
    if (!albumArtistMap.has(track.album.id)) {
      albumArtistMap.set(track.album.id, new Set());
    }
    track.artists.forEach(artist => {
      albumArtistMap.get(track.album.id)!.add(artist.id);
    });
  });
  
  // Link albums to their artists
  albumArtistMap.forEach((artistIds, albumId) => {
    const albumNode = albumMap.get(albumId);
    if (albumNode) {
      artistIds.forEach(artistId => {
        const artistNodeId = `artist-${artistId}`;
        if (nodeMap.has(artistNodeId)) {
          links.push({
            source: artistNodeId,
            target: albumNode.id,
            strength: 0.7,
            type: 'artist-album',
          });
          
          // Link album to album clustering node
          const albumClusterNode = albumClusterMap.get(albumId);
          if (albumClusterNode) {
            links.push({
              source: albumNode.id,
              target: albumClusterNode.id,
              strength: 0.7,
              type: 'cluster-album',
            });
          }
        }
      });
    }
  });

  // Create track nodes and link to albums (instead of directly to artists)
  tracks.forEach(track => {
    // Track nodes: range from 8 to 20 (smaller than genres)
    const trackNode: GraphNode = {
      id: `track-${track.id}`,
      name: track.name,
      group: 'track',
      popularity: track.popularity,
      imageUrl: track.album.images[0]?.url,
      spotifyUrl: track.external_urls.spotify,
      radius: Math.max(8, Math.min(20, track.popularity / 5)),
    };
    nodeMap.set(trackNode.id, trackNode);
    nodes.push(trackNode);

    // Link tracks to their albums
    const albumNodeId = `album-${track.album.id}`;
    if (nodeMap.has(albumNodeId)) {
      links.push({
        source: trackNode.id,
        target: albumNodeId,
        strength: 0.8,
        type: 'album-track',
      });
      
      // Also link tracks to album clustering nodes
      const albumClusterNode = albumClusterMap.get(track.album.id);
      if (albumClusterNode) {
        links.push({
          source: trackNode.id,
          target: albumClusterNode.id,
          strength: 0.6,
          type: 'cluster-track',
        });
      }
    }

    // Also create direct artist-track links for flexibility
    track.artists.forEach(trackArtist => {
      const artistNodeId = `artist-${trackArtist.id}`;
      if (nodeMap.has(artistNodeId)) {
        // For singles (no album node), make artist-track link stronger
        const linkStrength = nodeMap.has(albumNodeId) ? 0.3 : 0.8;
        links.push({
          source: trackNode.id,
          target: artistNodeId,
          strength: linkStrength,
          type: 'artist-track',
        });

        // Link tracks to genre clustering nodes for natural grouping
        const artist = artists.find(a => a.id === trackArtist.id);
        if (artist) {
          artist.genres.forEach(genre => {
            const clusterNode = clusterMap.get(genre);
            if (clusterNode) {
              links.push({
                source: trackNode.id,
                target: clusterNode.id,
                strength: 0.4, // Medium clustering force for tracks
                type: 'cluster-track',
              });
            }
          });
        }
      }
    });
  });

  return { nodes, links };
}

export function filterGraphBySize(graphData: GraphData, maxNodes: number): GraphData {
  if (graphData.nodes.length <= maxNodes) {
    return graphData;
  }

  // Prioritize nodes by popularity and type
  const sortedNodes = [...graphData.nodes].sort((a, b) => {
    // Genre nodes get highest priority
    if (a.group === 'genre' && b.group !== 'genre') return -1;
    if (b.group === 'genre' && a.group !== 'genre') return 1;
    
    // Then sort by popularity
    return (b.popularity || 0) - (a.popularity || 0);
  });

  const selectedNodes = sortedNodes.slice(0, maxNodes);
  const selectedNodeIds = new Set(selectedNodes.map(n => n.id));

  // Filter links to only include those between selected nodes
  const filteredLinks = graphData.links.filter(link => 
    selectedNodeIds.has(link.source) && selectedNodeIds.has(link.target)
  );

  return {
    nodes: selectedNodes,
    links: filteredLinks,
  };
} 