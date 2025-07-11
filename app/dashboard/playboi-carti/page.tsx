'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ForceGraph from '@/app/components/ForceGraph';
import SpotifyClient from '@/app/lib/spotify';
import { processDiscographyToGraph } from '@/app/lib/discographyProcessor';
import { GraphData } from '@/app/types/spotify';
import Link from 'next/link';

const PLAYBOI_CARTI_ID = '699OTQXzgjhIYAHMy9RyPD';

export default function PlayboiCartiPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [hoverEnabled, setHoverEnabled] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/');
    }
  }, [session, status, router]);

  useEffect(() => {
    if (session?.accessToken) {
      fetchDiscography();
    }
  }, [session]);

  const fetchDiscography = async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const spotifyClient = new SpotifyClient(session.accessToken);
      
      // Fetch Playboi Carti's data
      const artist = await spotifyClient.getArtist(PLAYBOI_CARTI_ID);
      
      // Fetch all albums (including singles to filter them out)
      const albums = await spotifyClient.getArtistAlbums(PLAYBOI_CARTI_ID, 'album,single', 50);
      
      // Process data into graph structure
      const processedData = await processDiscographyToGraph(
        artist,
        albums,
        (albumId) => spotifyClient.getAlbumTracks(albumId)
      );
      
      setGraphData(processedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch discography');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white mx-auto mb-4"></div>
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
                className="text-gray-300 hover:text-white transition-colors duration-200 flex items-center space-x-1"
              >
                <span>←</span>
                <span>Back to Dashboard</span>
              </Link>
              <h1 className="text-2xl font-bold">
                <span className="text-white">Playboi Carti</span> 
                <span className="text-gray-400 ml-2">Discography</span>
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-73px)] relative">
        {/* Controls Menu */}
        <div className={`absolute top-4 right-4 z-20 transition-all duration-300 ${showControls ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-2xl p-6 w-80">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Visualization Controls</h2>
              <button
                onClick={() => setShowControls(false)}
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Refresh Button */}
              <button
                onClick={fetchDiscography}
                disabled={loading}
                className="w-full px-4 py-3 bg-gradient-to-r from-gray-800 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg border border-gray-600"
              >
                {loading ? 'Loading...' : 'Refresh Data'}
              </button>

              {/* Stats */}
              {graphData && !loading && (
                <div className="pt-4 border-t border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Statistics</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total Nodes:</span>
                      <span className="text-white font-medium">{graphData.nodes.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Albums:</span>
                      <span className="text-gray-200 font-medium">
                        {graphData.nodes.filter(n => n.group === 'album').length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Tracks:</span>
                      <span className="text-white font-medium">
                        {graphData.nodes.filter(n => n.group === 'track').length}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Hover Toggle */}
              <div className="pt-4 border-t border-gray-700">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Interaction</h3>
                <div className="space-y-3">
                  <label className="flex items-center space-x-2 text-sm text-gray-400">
                    <input
                      type="checkbox"
                      checked={hoverEnabled}
                      onChange={(e) => setHoverEnabled(e.target.checked)}
                      className="w-4 h-4 text-yellow-600 bg-gray-700 border-gray-600 rounded focus:ring-yellow-500 focus:ring-2"
                    />
                    <span>Hover Effects</span>
                  </label>
                  <div className="text-xs text-gray-500">
                    Enable/disable node highlighting on hover
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setShowControls(!showControls)}
          className={`absolute top-4 right-4 z-10 p-3 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-lg hover:bg-gray-800/95 hover:border-gray-600 transition-all duration-300 ${showControls ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
          <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </button>

        {/* Visualization Area */}
        <div className="flex-1 relative bg-black">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white mx-auto mb-4"></div>
                <p className="text-gray-300 text-lg">Loading Playboi Carti's discography...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
              <div className="text-center bg-gray-900/95 border border-gray-700 rounded-lg p-8 max-w-md">
                <div className="text-gray-200 mb-6 text-lg font-medium">Error: {error}</div>
                <button
                  onClick={fetchDiscography}
                  className="px-6 py-3 bg-gradient-to-r from-gray-800 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-600 transition-all duration-200 font-medium shadow-lg border border-gray-600"
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
              colorScheme={{
                genre: { fill: '#FFFFFF', stroke: '#FFFFFF', strokeWidth: 3 }, // solid white
                artist: { fill: '#000000', stroke: '#FFFFFF', strokeWidth: 3 }, // white outline, black interior
                album: { fill: '#FFFFFF', stroke: '#FFFFFF', strokeWidth: 2 }, // solid white
                track: { fill: '#000000', stroke: '#FFFFFF', strokeWidth: 2 }, // white outline, black interior
                cluster: { fill: '#FFFFFF', stroke: '#FFFFFF', strokeWidth: 1 }, // solid white
                'genre-cluster': { fill: '#FFFFFF', stroke: '#FFFFFF', strokeWidth: 1 }, // solid white
                'album-cluster': { fill: '#FFFFFF', stroke: '#FFFFFF', strokeWidth: 1 }, // solid white
              }}
              hoverEnabled={hoverEnabled}
            />
          )}
        </div>
      </div>
    </div>
  );
} 