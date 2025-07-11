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
  const [nodeCount, setNodeCount] = useState(1000);
  const [showNodeSelector, setShowNodeSelector] = useState(true);
  const [chargeStrength, setChargeStrength] = useState(1.8);
  const [collisionRadius, setCollisionRadius] = useState(2.0);
  const [linkDistance, setLinkDistance] = useState(2.0);
  const [gravity, setGravity] = useState(1.0);
  const [nodeScale, setNodeScale] = useState(1.0);
  const [linkOpacity, setLinkOpacity] = useState(0.4);
  const [showControls, setShowControls] = useState(false);
  const [hoverEnabled, setHoverEnabled] = useState(true);

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
      
      // Fetch more data to support higher node counts
      const trackPromises = [];
      
      // Fetch top tracks
      trackPromises.push(spotifyClient.getTopTracks(50, timeRange));
      
      // Fetch recently played tracks (adds variety)
      trackPromises.push(spotifyClient.getRecentlyPlayed(50));
      
      // Fetch multiple pages of saved tracks to get more data
      const savedTrackPages = Math.ceil(nodeCount / 100); // More pages for higher node counts
      for (let i = 0; i < savedTrackPages; i++) {
        trackPromises.push(spotifyClient.getSavedTracks(50, i * 50));
      }
      
      const trackResponses = await Promise.all(trackPromises);
      const allTracks = trackResponses.flat();

      // If we need more tracks, fetch from playlists
      if (nodeCount > 800 && allTracks.length < nodeCount) {
        try {
          // Fetch user's playlists
          const playlists = await spotifyClient.getUserPlaylists(50);
          
          // Sort playlists by track count (prioritize larger playlists)
          const sortedPlaylists = playlists
            .filter(p => p.tracks.total > 0)
            .sort((a, b) => b.tracks.total - a.tracks.total);
          
          // Fetch tracks from top playlists
          const playlistTrackPromises = [];
          let estimatedTracks = allTracks.length;
          
          for (const playlist of sortedPlaylists) {
            if (estimatedTracks >= nodeCount * 1.5) break; // Get extra to account for duplicates
            
            // Fetch tracks from this playlist
            const pages = Math.ceil(Math.min(playlist.tracks.total, 300) / 100); // Limit to 300 tracks per playlist
            for (let page = 0; page < pages; page++) {
              playlistTrackPromises.push(
                spotifyClient.getPlaylistTracks(playlist.id, 100, page * 100)
              );
            }
            estimatedTracks += Math.min(playlist.tracks.total, 300);
          }
          
          if (playlistTrackPromises.length > 0) {
            const playlistTrackResponses = await Promise.all(playlistTrackPromises);
            const playlistTracks = playlistTrackResponses.flat();
            allTracks.push(...playlistTracks);
          }
        } catch (playlistError) {
          console.warn('Failed to fetch playlist tracks:', playlistError);
          // Continue with tracks we have
        }
      }

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
    if (nodeCount <= 800) return 'Building connections between your music...';
    if (nodeCount <= 1200) return 'Mapping your entire music universe...';
    if (nodeCount <= 2000) return 'Processing massive music constellation...';
    return 'Assembling the complete musical cosmos from your playlists...';
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
      <div className="flex h-[calc(100vh-73px)] relative">
        {/* Popout Controls Menu */}
        <div className={`absolute top-4 right-4 z-20 transition-all duration-300 ${showControls ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-6 w-80 max-h-[calc(100vh-120px)] overflow-y-auto">
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
                  max="2500"
                  step="100"
                  value={nodeCount}
                  onChange={(e) => setNodeCount(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  disabled={loading}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>200</span>
                  <span>2500</span>
                </div>
              </div>

              {/* Update Button */}
              <button
                onClick={fetchData}
                disabled={loading}
                className="w-full px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-md hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Update Data'}
              </button>

              {/* Divider */}
              <div className="border-t border-gray-700 pt-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">Visual Controls</h3>
              </div>

              {/* Charge Strength Slider */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Charge Strength: {chargeStrength.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.1"
                  value={chargeStrength}
                  onChange={(e) => setChargeStrength(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Tight</span>
                  <span>Spread</span>
                </div>
              </div>

              {/* Collision Radius Slider */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Collision Radius: {collisionRadius.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.1"
                  value={collisionRadius}
                  onChange={(e) => setCollisionRadius(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Compact</span>
                  <span>Spacious</span>
                </div>
              </div>

              {/* Link Distance Slider */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Link Distance: {linkDistance.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={linkDistance}
                  onChange={(e) => setLinkDistance(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Close</span>
                  <span>Far</span>
                </div>
              </div>

              {/* Gravity Slider */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Gravity: {gravity.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.1"
                  value={gravity}
                  onChange={(e) => setGravity(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Free Float</span>
                  <span>Strong Pull</span>
                </div>
              </div>

              {/* Node Scale Slider */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Node Scale: {nodeScale.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={nodeScale}
                  onChange={(e) => setNodeScale(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Small</span>
                  <span>Large</span>
                </div>
              </div>

              {/* Link Opacity Slider */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Link Opacity: {(linkOpacity * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={linkOpacity}
                  onChange={(e) => setLinkOpacity(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Faint</span>
                  <span>Bold</span>
                </div>
              </div>

              {/* Hover Toggle */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-400 mb-2">
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

              {/* Stats */}
              {treeData && !loading && (
                <div className="pt-4 border-t border-gray-700">
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
                    max="2500"
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
                  {nodeCount <= 400 && "Quick loading, focused on top items"}
                  {nodeCount > 400 && nodeCount <= 800 && "Good balance of detail and performance"}
                  {nodeCount > 800 && nodeCount <= 1200 && "High detail, includes saved tracks"}
                  {nodeCount > 1200 && nodeCount <= 2000 && "Very high detail, includes playlist tracks"}
                  {nodeCount > 2000 && "Maximum detail, pulls from all your playlists"}
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
              width={window.innerWidth}
              height={window.innerHeight - 73}
              chargeStrength={chargeStrength}
              collisionRadius={collisionRadius}
              linkDistance={linkDistance}
              gravity={gravity}
              nodeScale={nodeScale}
              linkOpacity={linkOpacity}
              hoverEnabled={hoverEnabled}
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