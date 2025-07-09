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
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-500 mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-red-900/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/dashboard"
                className="text-red-200 hover:text-white transition-colors duration-200 flex items-center space-x-1"
              >
                <span>←</span>
                <span>Back to Dashboard</span>
              </Link>
              <h1 className="text-2xl font-bold">
                <span className="text-red-500">Playboi Carti</span> 
                <span className="text-white ml-2">Discography</span>
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-73px)] relative">
        {/* Controls Menu */}
        <div className={`absolute top-4 right-4 z-20 transition-all duration-300 ${showControls ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="bg-gray-900/95 backdrop-blur-sm border border-red-500/30 rounded-lg shadow-2xl p-6 w-80">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Visualization Controls</h2>
              <button
                onClick={() => setShowControls(false)}
                className="text-red-300 hover:text-white transition-colors duration-200"
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
                className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg hover:from-red-700 hover:to-red-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg"
              >
                {loading ? 'Loading...' : 'Refresh Data'}
              </button>

              {/* Stats */}
              {graphData && !loading && (
                <div className="pt-4 border-t border-red-500/20">
                  <h3 className="text-sm font-semibold text-red-300 mb-3">Statistics</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-red-200">Total Nodes:</span>
                      <span className="text-white font-medium">{graphData.nodes.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-red-200">Albums:</span>
                      <span className="text-red-400 font-medium">
                        {graphData.nodes.filter(n => n.group === 'album').length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-red-200">Tracks:</span>
                      <span className="text-white font-medium">
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
          className={`absolute top-4 right-4 z-10 p-3 bg-gray-900/95 backdrop-blur-sm border border-red-500/30 rounded-lg shadow-lg hover:bg-gray-800/95 hover:border-red-400/50 transition-all duration-300 ${showControls ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
          <svg className="w-6 h-6 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </button>

        {/* Visualization Area */}
        <div className="flex-1 relative bg-black">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-500 mx-auto mb-4"></div>
                <p className="text-red-200 text-lg">Loading Playboi Carti's discography...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
              <div className="text-center bg-gray-900/95 border border-red-500/30 rounded-lg p-8 max-w-md">
                <div className="text-red-400 mb-6 text-lg font-medium">Error: {error}</div>
                <button
                  onClick={fetchDiscography}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg hover:from-red-700 hover:to-red-600 transition-all duration-200 font-medium shadow-lg"
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
                genre: '#DC2626', // red-600 - for genre nodes
                artist: '#FFFFFF', // white - for artist nodes (Playboi Carti)
                album: '#FEF2F2', // red-50 - very light red for albums
                track: '#FECACA', // red-200 - light red for tracks
                cluster: '#FFFFFF', // white for clustering nodes
                'genre-cluster': '#FFFFFF', // white for genre clustering
                'album-cluster': '#FFFFFF', // white for album clustering
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
} 