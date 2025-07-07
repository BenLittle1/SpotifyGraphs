import { SpotifyTrack, SpotifyArtist, GraphNode, GraphLink, GraphData } from '@/app/types/spotify';

export function processSpotifyDataToGraph(
  tracks: SpotifyTrack[],
  artists: SpotifyArtist[]
): GraphData {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const nodeMap = new Map<string, GraphNode>();

  // Create genre nodes first
  const genreMap = new Map<string, GraphNode>();
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
      }
    });
  });

  // Create artist nodes
  artists.forEach(artist => {
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

    // Link artists to their genres
    artist.genres.forEach(genre => {
      const genreNode = genreMap.get(genre);
      if (genreNode) {
        links.push({
          source: artistNode.id,
          target: genreNode.id,
          strength: 0.5,
        });
      }
    });
  });

  // Create track nodes and link to artists
  tracks.forEach(track => {
    const trackNode: GraphNode = {
      id: `track-${track.id}`,
      name: track.name,
      group: 'track',
      popularity: track.popularity,
      imageUrl: track.album.images[0]?.url,
      spotifyUrl: track.external_urls.spotify,
      radius: Math.max(10, Math.min(25, track.popularity / 4)),
    };
    nodeMap.set(trackNode.id, trackNode);
    nodes.push(trackNode);

    // Link tracks to their artists
    track.artists.forEach(trackArtist => {
      const artistNodeId = `artist-${trackArtist.id}`;
      if (nodeMap.has(artistNodeId)) {
        links.push({
          source: trackNode.id,
          target: artistNodeId,
          strength: 0.8,
        });
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