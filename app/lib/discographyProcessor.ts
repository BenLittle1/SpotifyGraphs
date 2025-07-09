import { SpotifyArtist, GraphNode, GraphLink, GraphData } from '@/app/types/spotify';

export async function processDiscographyToGraph(
  artist: SpotifyArtist,
  albums: any[],
  getAlbumTracks: (albumId: string) => Promise<any[]>
): Promise<GraphData> {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  
  // Create artist node (root)
  const artistNode: GraphNode = {
    id: `artist-${artist.id}`,
    name: artist.name,
    group: 'artist',
    popularity: artist.popularity,
    imageUrl: artist.images[0]?.url,
    spotifyUrl: artist.external_urls.spotify,
    radius: 40, // Larger radius for the main artist
  };
  nodes.push(artistNode);
  
  // Process all albums and collect track information
  const albumTrackMap = new Map<string, { album: any, tracks: any[] }>();
  
  // Fetch all tracks from all albums first
  for (const album of albums) {
    try {
      const tracks = await getAlbumTracks(album.id);
      albumTrackMap.set(album.id, { album, tracks });
    } catch (error) {
      console.error(`Failed to fetch tracks for album ${album.name}:`, error);
    }
  }
  
  // Now process each album and its tracks
  albumTrackMap.forEach(({ album, tracks }, albumId) => {
    const isSingleAlbum = album.album_type === 'single' || 
                         album.total_tracks === 1 || 
                         tracks.length === 1;
    
    let albumNode: GraphNode | null = null;
    
    // Only create album nodes for non-singles
    if (!isSingleAlbum) {
      albumNode = {
        id: `album-${album.id}`,
        name: album.name,
        group: 'album',
        imageUrl: album.images[0]?.url,
        spotifyUrl: album.external_urls.spotify,
        radius: 20,
      };
      nodes.push(albumNode);
      
      // Link album to artist
      links.push({
        source: albumNode.id,
        target: artistNode.id,
        strength: 0.7,
        type: 'artist-album',
      });
    }
    
    // Process tracks
    tracks.forEach((track: any) => {
      // Check if track already exists (avoid duplicates)
      const existingTrack = nodes.find(n => n.id === `track-${track.id}`);
      if (existingTrack) return;
      
      // Create track node
      const trackNode: GraphNode = {
        id: `track-${track.id}`,
        name: track.name,
        group: 'track',
        popularity: track.popularity || 50,
        spotifyUrl: track.external_urls?.spotify,
        radius: 12,
      };
      nodes.push(trackNode);
      
      if (isSingleAlbum || !albumNode) {
        // For singles, connect directly to artist
        links.push({
          source: trackNode.id,
          target: artistNode.id,
          strength: 0.6, // Strong connection for singles
          type: 'artist-track',
        });
      } else {
        // For album tracks, connect to album
        links.push({
          source: trackNode.id,
          target: albumNode.id,
          strength: 0.8,
          type: 'album-track',
        });
        
        // Also add a weaker direct connection to artist for better visualization
        links.push({
          source: trackNode.id,
          target: artistNode.id,
          strength: 0.3,
          type: 'artist-track',
        });
      }
    });
  });
  
  // Add clustering node for albums (only if we have albums)
  const albumNodes = nodes.filter(n => n.group === 'album');
  if (albumNodes.length > 0) {
    const albumClusterNode: GraphNode = {
      id: 'cluster-albums',
      name: 'Album Cluster',
      group: 'cluster',
      radius: 5,
      invisible: true,
    };
    nodes.push(albumClusterNode);
    
    // Link all albums to the cluster node for better grouping
    albumNodes.forEach(album => {
      links.push({
        source: album.id,
        target: albumClusterNode.id,
        strength: 0.4,
        type: 'cluster-album',
      });
    });
  }
  
  // Final check: ensure every track has at least one connection to the artist
  const trackNodes = nodes.filter(n => n.group === 'track');
  trackNodes.forEach(track => {
    const hasArtistConnection = links.some(l => 
      l.type === 'artist-track' && 
      ((l.source === track.id && l.target === artistNode.id) ||
       (l.target === track.id && l.source === artistNode.id))
    );
    
    if (!hasArtistConnection) {
      // Add missing connection
      console.warn(`Track "${track.name}" was missing artist connection, adding it now`);
      links.push({
        source: track.id,
        target: artistNode.id,
        strength: 0.5,
        type: 'artist-track',
      });
    }
  });
  
  console.log(`Processed ${nodes.length} nodes and ${links.length} links`);
  console.log(`Albums: ${albumNodes.length}, Tracks: ${trackNodes.length}`);
  
  return { nodes, links };
} 