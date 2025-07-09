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
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
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
                <span className="text-red-500">Playboi Carti</span> Discography
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-73px)] relative">
        {/* Controls Menu */}
        <div className={`absolute top-4 right-4 z-20 transition-all duration-300 ${showControls ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-6 w-80">
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
              {/* Refresh Button */}
              <button
                onClick={fetchDiscography}
                disabled={loading}
                className="w-full px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-md hover:from-red-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Refresh Data'}
              </button>

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
                      <span className="text-gray-500">Genres:</span>
                      <span className="text-pink-400">
                        {graphData.nodes.filter(n => n.group === 'genre').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Albums:</span>
                      <span className="text-red-400">
                        {graphData.nodes.filter(n => n.group === 'album').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tracks:</span>
                      <span className="text-green-400">
                        {graphData.nodes.filter(n => n.group === 'track').length}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setShowControls(!showControls)}
          className={`absolute top-4 right-4 z-10 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-lg hover:bg-gray-800 transition-all duration-300 ${showControls ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </button>

        {/* Visualization Area */}
        <div className="flex-1 relative bg-black">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-red-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading Playboi Carti's discography...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-red-500 mb-4">Error: {error}</div>
                <button
                  onClick={fetchDiscography}
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
            />
          )}
        </div>
      </div>
    </div>
  );
} 