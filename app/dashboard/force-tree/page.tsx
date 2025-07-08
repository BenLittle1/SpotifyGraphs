'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ForceTree from '@/app/components/ForceTree';
import SpotifyClient from '@/app/lib/spotify';
import { processSpotifyDataToForceTree, ForceTreeData } from '@/app/lib/forceTreeProcessor';
import Link from 'next/link';

export default function ForceTreePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [treeData, setTreeData] = useState<ForceTreeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'short_term' | 'medium_term' | 'long_term'>('medium_term');
  const [nodeCount, setNodeCount] = useState(400);
  const [showNodeSelector, setShowNodeSelector] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/');
    }
  }, [session, status, router]);

  const fetchData = async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const spotifyClient = new SpotifyClient(session.accessToken);
      
      // Fetch top tracks and saved tracks
      const [topTracksResponse, savedTracksResponse] = await Promise.all([
        spotifyClient.getTopTracks(50, timeRange),
        spotifyClient.getSavedTracks(50)
      ]);

      const allTracks = [
        ...topTracksResponse,
        ...savedTracksResponse
      ];

      // Remove duplicates
      const uniqueTracks = Array.from(
        new Map(allTracks.map(track => [track.id, track])).values()
      );

      // Get unique artists
      const artistIds = Array.from(
        new Set(
          uniqueTracks.flatMap(track => track.artists.map(artist => artist.id))
        )
      );

      // Fetch full artist data in batches
      const artists = [];
      for (let i = 0; i < artistIds.length; i += 50) {
        const batch = artistIds.slice(i, i + 50);
        const response = await spotifyClient.getMultipleArtists(batch);
        artists.push(...response);
      }

      // Process data into force tree structure
      const processedData = processSpotifyDataToForceTree(uniqueTracks, artists, nodeCount);
      setTreeData(processedData);
      setShowNodeSelector(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleNodeCountSelect = () => {
    fetchData();
  };

  const getLoadingMessage = () => {
    if (nodeCount <= 400) return 'Creating your music tree...';
    if (nodeCount <= 600) return 'Building connections between your music...';
    return 'Mapping your entire music universe...';
  };

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500 mx-auto mb-4"></div>
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
              <h1 className="text-2xl font-bold">Force-Directed Tree</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar */}
        <div className="w-80 bg-gray-900 border-r border-gray-800 p-6 overflow-y-auto">
          <h2 className="text-xl font-semibold mb-4">Visualization Controls</h2>
          
          <div className="space-y-6">
            {/* Time Range */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Time Range
              </label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                disabled={loading}
              >
                <option value="short_term">Last 4 Weeks</option>
                <option value="medium_term">Last 6 Months</option>
                <option value="long_term">All Time</option>
              </select>
            </div>

            {/* Node Count */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Node Count: {nodeCount}
              </label>
              <input
                type="range"
                min="200"
                max="800"
                step="100"
                value={nodeCount}
                onChange={(e) => setNodeCount(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                disabled={loading}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>200</span>
                <span>800</span>
              </div>
            </div>

            {/* Update Button */}
            <button
              onClick={fetchData}
              disabled={loading}
              className="w-full px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-md hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Update Visualization'}
            </button>

            {/* Stats */}
            {treeData && !loading && (
              <div className="pt-6 border-t border-gray-800">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">Statistics</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Nodes:</span>
                    <span className="text-white">{treeData.nodes.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Genres:</span>
                    <span className="text-pink-400">
                      {treeData.nodes.filter(n => n.type === 'genre').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Artists:</span>
                    <span className="text-cyan-400">
                      {treeData.nodes.filter(n => n.type === 'artist').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tracks:</span>
                    <span className="text-green-400">
                      {treeData.nodes.filter(n => n.type === 'track').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Connections:</span>
                    <span className="text-white">{treeData.links.length}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="pt-6 border-t border-gray-800">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Instructions</h3>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>• Drag nodes to reposition</li>
                <li>• Scroll to zoom in/out</li>
                <li>• Click nodes to open in Spotify</li>
                <li>• Genres form the center</li>
                <li>• Artists orbit around genres</li>
                <li>• Tracks orbit around artists</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Visualization Area */}
        <div className="flex-1 relative bg-black">
          {showNodeSelector && !loading && !treeData && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90 z-10">
              <div className="bg-gray-900 p-8 rounded-lg max-w-md w-full mx-4">
                <h2 className="text-2xl font-bold mb-4 text-center">
                  Select Visualization Size
                </h2>
                <p className="text-gray-400 text-center mb-6">
                  Choose how many nodes to display in your force-directed tree
                </p>
                
                <div className="mb-6">
                  <div className="text-center mb-2">
                    <span className="text-4xl font-bold text-cyan-400">{nodeCount}</span>
                    <span className="text-gray-400 ml-2">nodes</span>
                  </div>
                  <input
                    type="range"
                    min="200"
                    max="800"
                    step="100"
                    value={nodeCount}
                    onChange={(e) => setNodeCount(Number(e.target.value))}
                    className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>Minimal</span>
                    <span>Balanced</span>
                    <span>Comprehensive</span>
                  </div>
                </div>

                <div className="text-sm text-gray-500 mb-6">
                  {nodeCount <= 300 && "Quick loading, focused on top items"}
                  {nodeCount > 300 && nodeCount <= 500 && "Good balance of detail and performance"}
                  {nodeCount > 500 && "Maximum detail, may take longer to stabilize"}
                </div>

                <button
                  onClick={handleNodeCountSelect}
                  className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-md hover:from-cyan-600 hover:to-blue-600 transition-all font-semibold"
                >
                  Create Force Tree
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                <p className="text-gray-400">{getLoadingMessage()}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-red-500 mb-4">Error: {error}</div>
                <button
                  onClick={fetchData}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {treeData && !loading && (
            <ForceTree
              data={treeData}
              width={window.innerWidth - 320}
              height={window.innerHeight - 73}
            />
          )}
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: #06b6d4;
          cursor: pointer;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(6, 182, 212, 0.5);
        }
        
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #06b6d4;
          cursor: pointer;
          border-radius: 50%;
          border: none;
          box-shadow: 0 0 10px rgba(6, 182, 212, 0.5);
        }
      `}</style>
    </div>
  );
} 