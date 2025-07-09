import { SpotifyArtist, GraphNode, GraphLink, GraphData } from '@/app/types/spotify';

// Helper function to check if an album is a single (reused from graphProcessor)
const isSingle = (album: any): boolean => {
  // If it only has one track and the names match, it's likely a single
  if (album.total_tracks === 1) {
    const albumName = album.name.toLowerCase().trim();
    // Since we don't have track names at this point, we'll just check if it's explicitly marked as single
    return album.album_type === 'single';
  }
  return album.album_type === 'single' && album.total_tracks <= 3; // Singles can have up to 3 tracks
};

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
  
  // Filter out singles and sort albums by release date
  const actualAlbums = albums
    .filter(album => !isSingle(album))
    .sort((a, b) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime());
  
  // Track all created track nodes to ensure they're connected to artist
  const allTrackNodes = new Set<string>();
  
  // Process each album
  for (const album of actualAlbums) {
    // Create album node
    const albumNode: GraphNode = {
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
    
    // Fetch and process tracks for this album
    try {
      const tracks = await getAlbumTracks(album.id);
      
      tracks.forEach((track: any) => {
        // Create track node
        const trackNode: GraphNode = {
          id: `track-${track.id}`,
          name: track.name,
          group: 'track',
          popularity: track.popularity || 50, // Default if not available
          spotifyUrl: track.external_urls?.spotify,
          radius: 12,
        };
        nodes.push(trackNode);
        allTrackNodes.add(trackNode.id);
        
        // Link track to album
        links.push({
          source: trackNode.id,
          target: albumNode.id,
          strength: 0.8,
          type: 'album-track',
        });
        
        // Always create direct link to artist for better visualization
        links.push({
          source: trackNode.id,
          target: artistNode.id,
          strength: 0.4, // Increased strength for direct artist connection
          type: 'artist-track',
        });
      });
    } catch (error) {
      console.error(`Failed to fetch tracks for album ${album.name}:`, error);
      // Continue with other albums even if one fails
    }
  }
  
  // Also process singles to ensure their tracks are included and connected
  const singles = albums.filter(album => isSingle(album));
  
  for (const single of singles) {
    try {
      const tracks = await getAlbumTracks(single.id);
      
      tracks.forEach((track: any) => {
        // Check if track node already exists (in case it was created through another album)
        const existingTrackNode = nodes.find(n => n.id === `track-${track.id}`);
        
        if (!existingTrackNode) {
          // Create track node for single
          const trackNode: GraphNode = {
            id: `track-${track.id}`,
            name: track.name,
            group: 'track',
            popularity: track.popularity || 50,
            spotifyUrl: track.external_urls?.spotify,
            radius: 12,
          };
          nodes.push(trackNode);
          allTrackNodes.add(trackNode.id);
        }
        
        // Ensure direct connection to artist (don't create duplicate links)
        const existingArtistLink = links.find(l => 
          l.type === 'artist-track' && 
          ((l.source === `track-${track.id}` && l.target === artistNode.id) ||
           (l.target === `track-${track.id}` && l.source === artistNode.id))
        );
        
        if (!existingArtistLink) {
          links.push({
            source: `track-${track.id}`,
            target: artistNode.id,
            strength: 0.5, // Stronger connection for singles
            type: 'artist-track',
          });
        }
      });
    } catch (error) {
      console.error(`Failed to fetch tracks for single ${single.name}:`, error);
    }
  }
  
  // Add clustering nodes for better organization
  // Create invisible nodes to help cluster albums
  const albumClusterNode: GraphNode = {
    id: 'cluster-albums',
    name: 'Album Cluster',
    group: 'cluster',
    radius: 5,
    invisible: true,
  };
  nodes.push(albumClusterNode);
  
  // Link all albums to the cluster node for better grouping
  actualAlbums.forEach(album => {
    links.push({
      source: `album-${album.id}`,
      target: albumClusterNode.id,
      strength: 0.4,
      type: 'cluster-album',
    });
  });
  
  return { nodes, links };
} 