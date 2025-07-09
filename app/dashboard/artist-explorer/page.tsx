'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ForceGraph from '@/app/components/ForceGraph';
import SpotifyLinkPopup from '@/app/components/SpotifyLinkPopup';
import SpotifyClient from '@/app/lib/spotify';
import { processDiscographyToGraph } from '@/app/lib/discographyProcessor';
import { GraphData, GraphNode } from '@/app/types/spotify';
import Link from 'next/link';

export default function ArtistExplorerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [clickedNode, setClickedNode] = useState<{
    name: string;
    type: 'artist' | 'album' | 'track';
    spotifyUrl: string;
  } | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/');
    }
  }, [session, status, router]);

  const searchArtists = async () => {
    if (!session?.accessToken || !searchQuery.trim()) return;

    setSearching(true);
    setError(null);

    try {
      const spotifyClient = new SpotifyClient(session.accessToken);
      const response = await spotifyClient.searchArtists(searchQuery);
      setSearchResults(response.artists.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search artists');
    } finally {
      setSearching(false);
    }
  };

  const selectArtist = async (artist: any) => {
    setSelectedArtist(artist);
    setSearchResults([]);
    setSearchQuery('');
    await fetchArtistDiscography(artist.id);
  };

  const fetchArtistDiscography = async (artistId: string) => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const spotifyClient = new SpotifyClient(session.accessToken);
      
      // Fetch artist data
      const artist = await spotifyClient.getArtist(artistId);
      
      // Fetch all albums (including singles)
      const albums = await spotifyClient.getArtistAlbums(artistId, 'album,single', 50);
      
      // Process data into graph structure using the same logic as playboi carti
      const processedData = await processDiscographyToGraph(
        artist,
        albums,
        (albumId: string) => spotifyClient.getAlbumTracks(albumId)
      );
      
      setGraphData(processedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch discography');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchArtists();
    }
  };

  const handleNodeClick = (node: GraphNode) => {
    if (node.spotifyUrl) {
      setClickedNode({
        name: node.name,
        type: node.group as 'artist' | 'album' | 'track',
        spotifyUrl: node.spotifyUrl
      });
    }
  };

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-green-500 mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/dashboard"
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold">
                <span className="text-green-500">Artist Explorer</span>
              </h1>
            </div>
            
            {/* Search Box */}
            {!selectedArtist && (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Search for an artist..."
                  className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500 w-80"
                />
                <button
                  onClick={searchArtists}
                  disabled={searching || !searchQuery.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </div>
            )}
            
            {/* Selected Artist */}
            {selectedArtist && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  {selectedArtist.images?.[0] && (
                    <img 
                      src={selectedArtist.images[0].url} 
                      alt={selectedArtist.name}
                      className="w-10 h-10 rounded-full"
                    />
                  )}
                  <span className="text-lg font-medium">{selectedArtist.name}</span>
                </div>
                <button
                  onClick={() => {
                    setSelectedArtist(null);
                    setGraphData(null);
                    setClickedNode(null);
                  }}
                  className="px-3 py-1 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors text-sm"
                >
                  Change Artist
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Results Dropdown */}
      {searchResults.length > 0 && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-96 max-h-96 overflow-y-auto bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50">
          {searchResults.map((artist) => (
            <button
              key={artist.id}
              onClick={() => selectArtist(artist)}
              className="w-full px-4 py-3 hover:bg-gray-800 transition-colors flex items-center space-x-3 border-b border-gray-800 last:border-b-0"
            >
              {artist.images?.[0] && (
                <img 
                  src={artist.images[0].url} 
                  alt={artist.name}
                  className="w-12 h-12 rounded-full"
                />
              )}
              <div className="text-left">
                <div className="font-medium">{artist.name}</div>
                <div className="text-sm text-gray-400">
                  {artist.followers?.total.toLocaleString()} followers
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="flex h-[calc(100vh-73px)] relative">
        {/* Controls Menu */}
        <div className={`absolute top-4 right-4 z-20 transition-all duration-300 ${showControls ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl p-6 w-80">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Visualization Controls</h2>
              <button
                onClick={() => setShowControls(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Stats */}
              {graphData && !loading && (
                <div className="pt-4 border-t border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">Statistics</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Nodes:</span>
                      <span className="text-white">{graphData.nodes.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Albums:</span>
                      <span className="text-green-400">
                        {graphData.nodes.filter((n: GraphNode) => n.group === 'album').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tracks:</span>
                      <span className="text-blue-400">
                        {graphData.nodes.filter((n: GraphNode) => n.group === 'track').length}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Toggle Button */}
        {graphData && (
          <button
            onClick={() => setShowControls(!showControls)}
            className={`absolute top-4 right-4 z-10 p-3 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-lg hover:bg-gray-800 transition-all duration-300 ${showControls ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>
        )}

        {/* Visualization Area */}
        <div className="flex-1 relative bg-black">
          {!selectedArtist && !loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🎵</div>
                <h2 className="text-2xl font-bold text-gray-300 mb-2">Search for an Artist</h2>
                <p className="text-gray-500">Enter an artist name above to explore their discography</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading {selectedArtist?.name}'s discography...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-red-500 mb-4">Error: {error}</div>
                <button
                  onClick={() => selectedArtist && fetchArtistDiscography(selectedArtist.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {graphData && !loading && (
            <ForceGraph
              data={graphData}
              width={window.innerWidth}
              height={window.innerHeight - 73}
              onNodeClick={handleNodeClick}
            />
          )}
        </div>
      </div>

      {/* Spotify Link Popup */}
      {clickedNode && (
        <SpotifyLinkPopup
          name={clickedNode.name}
          type={clickedNode.type}
          spotifyUrl={clickedNode.spotifyUrl}
          onClose={() => setClickedNode(null)}
        />
      )}
    </div>
  );
} 