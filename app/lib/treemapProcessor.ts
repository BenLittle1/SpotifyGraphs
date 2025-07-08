import { SpotifyTrack, SpotifyArtist } from '@/app/types/spotify';

export interface TreemapNode {
  name: string;
  value?: number;
  children?: TreemapNode[];
  type?: 'genre' | 'artist' | 'track';
  popularity?: number;
  imageUrl?: string;
  spotifyUrl?: string;
  id?: string;
}

export function processSpotifyDataToTreemap(
  tracks: SpotifyTrack[],
  artists: SpotifyArtist[]
): TreemapNode {
  // Create a map of artist ID to artist data for quick lookup
  const artistMap = new Map<string, SpotifyArtist>();
  artists.forEach(artist => {
    artistMap.set(artist.id, artist);
  });

  // Group tracks by genre -> artist hierarchy
  const genreMap = new Map<string, Map<string, SpotifyTrack[]>>();

  tracks.forEach(track => {
    track.artists.forEach(trackArtist => {
      const artistData = artistMap.get(trackArtist.id);
      if (artistData) {
        // If artist has no genres, use "Unknown Genre"
        const genres = artistData.genres.length > 0 ? artistData.genres : ['Unknown Genre'];
        
        genres.forEach(genre => {
          if (!genreMap.has(genre)) {
            genreMap.set(genre, new Map());
          }
          
          const artistMapInGenre = genreMap.get(genre)!;
          if (!artistMapInGenre.has(trackArtist.id)) {
            artistMapInGenre.set(trackArtist.id, []);
          }
          
          artistMapInGenre.get(trackArtist.id)!.push(track);
        });
      } else {
        // Handle case where artist data is not available
        const unknownGenre = 'Unknown Genre';
        if (!genreMap.has(unknownGenre)) {
          genreMap.set(unknownGenre, new Map());
        }
        
        const artistMapInGenre = genreMap.get(unknownGenre)!;
        if (!artistMapInGenre.has(trackArtist.id)) {
          artistMapInGenre.set(trackArtist.id, []);
        }
        
        artistMapInGenre.get(trackArtist.id)!.push(track);
      }
    });
  });

  // Build the tree structure
  const genreNodes: TreemapNode[] = [];

  genreMap.forEach((artistsInGenre, genreName) => {
    const artistNodes: TreemapNode[] = [];
    let genreValue = 0;

    artistsInGenre.forEach((tracksForArtist, artistId) => {
      const artistData = artistMap.get(artistId);
      const trackNodes: TreemapNode[] = tracksForArtist.map(track => ({
        name: track.name,
        value: Math.max(1, track.popularity || 1), // Ensure minimum value
        type: 'track' as const,
        popularity: track.popularity,
        imageUrl: track.album.images[0]?.url,
        spotifyUrl: track.external_urls.spotify,
        id: track.id,
      }));

      const artistValue = trackNodes.reduce((sum, track) => sum + (track.value || 0), 0);
      genreValue += artistValue;

      artistNodes.push({
        name: artistData?.name || 'Unknown Artist',
        value: artistValue,
        children: trackNodes,
        type: 'artist' as const,
        popularity: artistData?.popularity,
        imageUrl: artistData?.images[0]?.url,
        spotifyUrl: artistData?.external_urls.spotify,
        id: artistId,
      });
    });

    // Sort artists by value (descending)
    artistNodes.sort((a, b) => (b.value || 0) - (a.value || 0));

    genreNodes.push({
      name: genreName,
      value: genreValue,
      children: artistNodes,
      type: 'genre' as const,
    });
  });

  // Sort genres by value (descending)
  genreNodes.sort((a, b) => (b.value || 0) - (a.value || 0));

  // Create root node
  const rootValue = genreNodes.reduce((sum, genre) => sum + (genre.value || 0), 0);

  return {
    name: 'Music Library',
    value: rootValue,
    children: genreNodes,
    type: 'genre' as const,
  };
}

export function filterTreemapBySize(root: TreemapNode, maxNodes: number): TreemapNode {
  if (!root.children) return root;

  let nodeCount = 0;
  
  // Count nodes recursively
  function countNodes(node: TreemapNode): number {
    let count = 1;
    if (node.children) {
      node.children.forEach(child => count += countNodes(child));
    }
    return count;
  }

  // Trim tree to fit node limit
  function trimTree(node: TreemapNode, remainingNodes: number): TreemapNode {
    if (remainingNodes <= 1 || !node.children) {
      return { ...node, children: undefined };
    }

    // Reserve 1 node for current level
    let remainingForChildren = remainingNodes - 1;
    const trimmedChildren: TreemapNode[] = [];

    // Sort children by value to prioritize most important ones
    const sortedChildren = [...node.children].sort((a, b) => (b.value || 0) - (a.value || 0));

    for (const child of sortedChildren) {
      if (remainingForChildren <= 0) break;
      
      const childNodeCount = countNodes(child);
      if (childNodeCount <= remainingForChildren) {
        trimmedChildren.push(trimTree(child, Math.min(childNodeCount, remainingForChildren)));
        remainingForChildren -= childNodeCount;
      } else if (remainingForChildren > 1) {
        // Try to include at least some of this child
        trimmedChildren.push(trimTree(child, remainingForChildren));
        remainingForChildren = 0;
      }
    }

    return {
      ...node,
      children: trimmedChildren.length > 0 ? trimmedChildren : undefined,
    };
  }

  const totalNodes = countNodes(root);
  if (totalNodes <= maxNodes) {
    return root;
  }

  return trimTree(root, maxNodes);
} 