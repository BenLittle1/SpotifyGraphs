'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ForceGraph from '@/app/components/ForceGraph';
import SpotifyClient from '@/app/lib/spotify';
import { processSpotifyDataToGraph, filterGraphBySize } from '@/app/lib/graphProcessor';
import { GraphData } from '@/app/types/spotify';
import Link from 'next/link';

export default function TopTracksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'short_term' | 'medium_term' | 'long_term'>('medium_term');
  const [nodeCount, setNodeCount] = useState<number>(200);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<'network' | 'hierarchical'>('network');

  useEffect(() => {
    if (status === 'unauthenticated' || session?.error) {
      router.push('/');
    }
  }, [session, status, router]);

  const fetchSpotifyData = async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);
    setHasLoaded(true);

    try {
      const client = new SpotifyClient(session.accessToken);
      
      // Fetch MUCH more data to support up to 2000 nodes
      const fetchPromises = [
        client.getTopTracks(50, timeRange),
      ];
      
      // Fetch saved tracks in batches (up to 500 tracks)
      for (let offset = 0; offset < 500; offset += 50) {
        fetchPromises.push(client.getSavedTracks(50, offset));
      }
      
      const allResults = await Promise.all(fetchPromises);
      const topTracks = allResults[0];
      const savedTracks = allResults.slice(1).flat();
      
      // Combine and deduplicate tracks
      const allTracksMap = new Map();
      [topTracks, ...savedTracks].flat().forEach(track => {
        allTracksMap.set(track.id, track);
      });
      const uniqueTracks = Array.from(allTracksMap.values());
      
      if (uniqueTracks.length === 0) {
        setError('No tracks found. Try listening to more music!');
        setLoading(false);
        return;
      }

      // Get unique artist IDs from all tracks
      const artistIds = Array.from(new Set(
        uniqueTracks.flatMap(track => track.artists.map((artist: { id: string; name: string }) => artist.id))
      ));

      // Fetch artist details for genres
      const artists = await client.getMultipleArtists(artistIds);

      // Process data into graph format
      const fullGraphData = processSpotifyDataToGraph(uniqueTracks, artists);
      
      // Filter to selected node count
      const filteredData = filterGraphBySize(fullGraphData, nodeCount);
      
      setGraphData(filteredData);
    } catch (err) {
      console.error('Error fetching Spotify data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch Spotify data');
    } finally {
      setLoading(false);
    }
  };

  // Re-filter data when node count changes (if data is already loaded)
  useEffect(() => {
    if (hasLoaded && session?.accessToken) {
      fetchSpotifyData();
    }
  }, [nodeCount, timeRange]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <div className="text-center">
          <div className="text-neon-blue neon-text text-2xl mb-4">Initializing...</div>
          <div className="w-16 h-16 border-4 border-neon-pink border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-2xl mb-4">Error</div>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={fetchSpotifyData}
            className="px-6 py-3 bg-neon-green text-dark-bg font-bold rounded-lg hover:bg-neon-green/80 transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-dark-bg">
      <div className="p-4 bg-dark-surface border-b border-gray-800">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link 
              href="/dashboard"
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-neon-green">Top Tracks Network</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <label className="text-gray-400 text-sm">Time Range:</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="bg-dark-surface border border-gray-700 text-white px-4 py-2 rounded-lg"
            >
              <option value="short_term">Last 4 Weeks</option>
              <option value="medium_term">Last 6 Months</option>
              <option value="long_term">All Time</option>
            </select>
            
            {hasLoaded && (
              <>
                <div className="h-8 w-px bg-gray-700"></div>
                <label className="text-gray-400 text-sm">View:</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode('network')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      viewMode === 'network' 
                        ? 'bg-neon-green text-dark-bg' 
                        : 'bg-dark-surface border border-gray-700 text-gray-400 hover:text-white'
                    }`}
                  >
                    Network
                  </button>
                  <button
                    onClick={() => setViewMode('hierarchical')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      viewMode === 'hierarchical' 
                        ? 'bg-neon-green text-dark-bg' 
                        : 'bg-dark-surface border border-gray-700 text-gray-400 hover:text-white'
                    }`}
                  >
                    Hierarchical
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex">
        <div className="flex-1 h-[calc(100vh-73px)] overflow-hidden">
          {!hasLoaded ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <h2 className="text-3xl font-bold text-neon-pink mb-6">Choose Your Network Size</h2>
                <p className="text-gray-400 mb-8">
                  Select how many nodes you want to visualize. More nodes = more detail but slower performance.
                </p>
                
                <div className="bg-dark-surface p-6 rounded-lg border border-gray-700">
                  <div className="mb-6">
                    <label className="block text-white mb-4">
                      Node Count: <span className="text-neon-blue font-bold">{nodeCount}</span>
                    </label>
                    <input
                      type="range"
                      min="200"
                      max="2000"
                      step="200"
                      value={nodeCount}
                      onChange={(e) => setNodeCount(Number(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                      <span>200</span>
                      <span>600</span>
                      <span>1000</span>
                      <span>1400</span>
                      <span>1800</span>
                      <span>2000</span>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-400 mb-6">
                    <p>• 200-400: Fast & responsive</p>
                    <p>• 600-1000: Balanced detail</p>
                    <p>• 1200-2000: Maximum detail (may be slow)</p>
                  </div>
                  
                  <button
                    onClick={fetchSpotifyData}
                    className="w-full px-6 py-3 bg-neon-green text-dark-bg font-bold rounded-lg hover:bg-neon-green/80 transition-all"
                  >
                    Load Visualization
                  </button>
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-neon-blue neon-text text-2xl mb-4">
                  Loading {nodeCount} nodes...
                </div>
                <div className="w-16 h-16 border-4 border-neon-pink border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-gray-400 mt-4 text-sm">
                  {nodeCount >= 1000 ? 'This may take a moment with many nodes' : 'Preparing your music network'}
                </p>
              </div>
            </div>
          ) : (
            graphData && (
              <ForceGraph 
                data={graphData} 
                width={typeof window !== 'undefined' ? window.innerWidth : 1200} 
                height={typeof window !== 'undefined' ? window.innerHeight - 73 : 800} 
                viewMode={viewMode}
              />
            )
          )}
        </div>

        <div className="w-80 h-[calc(100vh-73px)] bg-dark-surface border-l border-gray-800 p-6 overflow-y-auto">
          <h2 className="text-xl font-bold mb-4 text-neon-pink">Legend</h2>
          
          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-neon-green"></div>
              <span className="text-gray-300">Tracks</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-neon-blue"></div>
              <span className="text-gray-300">Artists</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-neon-pink"></div>
              <span className="text-gray-300">Genres</span>
            </div>
          </div>

          {hasLoaded && (
            <>
              <div className="border-t border-gray-700 pt-4 mb-4">
                <h3 className="text-lg font-semibold mb-3 text-neon-yellow">View Mode</h3>
                <div className="space-y-2 text-sm text-gray-400">
                  <p className="font-semibold text-white">
                    {viewMode === 'network' ? 'Network View' : 'Hierarchical View'}
                  </p>
                  <p>
                    {viewMode === 'network' 
                      ? 'Traditional force-directed graph showing all connections equally.'
                      : 'Circular layout: Genres form inner circles, Artists orbit around their genres, and Tracks orbit around their artists, creating nested circular structures.'}
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4 mb-4">
                <h3 className="text-lg font-semibold mb-3 text-neon-yellow">Node Control</h3>
                <div className="space-y-3">
                  <label className="block text-sm text-gray-400">
                    Current Size: <span className="text-neon-blue font-bold">{nodeCount} nodes</span>
                  </label>
                  <input
                    type="range"
                    min="200"
                    max="2000"
                    step="200"
                    value={nodeCount}
                    onChange={(e) => setNodeCount(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-xs text-gray-500">
                    Adjust to change visualization size
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <h3 className="text-lg font-semibold mb-3 text-neon-yellow">Stats</h3>
                {graphData && (
                  <div className="space-y-2 text-sm text-gray-400">
                    <div className="font-semibold text-white">Total Nodes: {graphData.nodes.length}</div>
                    <div>Total Connections: {graphData.links.length}</div>
                    <div>Tracks: {graphData.nodes.filter(n => n.group === 'track').length}</div>
                    <div>Artists: {graphData.nodes.filter(n => n.group === 'artist').length}</div>
                    <div>Genres: {graphData.nodes.filter(n => n.group === 'genre').length}</div>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="border-t border-gray-700 pt-4 mt-4">
            <h3 className="text-lg font-semibold mb-3 text-neon-orange">Tips</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>• Larger nodes = higher popularity</li>
              <li>• Click nodes to open in Spotify</li>
              <li>• Drag to rearrange the graph</li>
              <li>• Scroll to zoom in/out</li>
            </ul>
          </div>

          <div className="border-t border-gray-700 pt-4 mt-4">
            <h3 className="text-lg font-semibold mb-3 text-neon-purple">Performance</h3>
            <p className="text-sm text-gray-400">
              {nodeCount <= 400 ? 'Smooth performance mode' :
               nodeCount <= 800 ? 'Balanced performance' :
               nodeCount <= 1200 ? 'Detailed view - may be slower' :
               'Maximum detail - performance varies by device'}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
} 