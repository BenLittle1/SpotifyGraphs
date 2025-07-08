'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Treemap from '@/app/components/Treemap';
import SpotifyClient from '@/app/lib/spotify';
import { processSpotifyDataToTreemap, filterTreemapBySize, TreemapNode } from '@/app/lib/treemapProcessor';
import Link from 'next/link';

export default function TreemapPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [treemapData, setTreemapData] = useState<TreemapNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'short_term' | 'medium_term' | 'long_term'>('medium_term');
  const [nodeCount, setNodeCount] = useState<number>(200);
  const [hasLoaded, setHasLoaded] = useState(false);

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

      // Process data into treemap format
      const fullTreemapData = processSpotifyDataToTreemap(uniqueTracks, artists);
      
      // Filter to selected node count
      const filteredData = filterTreemapBySize(fullTreemapData, nodeCount);
      
      setTreemapData(filteredData);
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

  // Count total nodes in tree
  const countNodes = (node: TreemapNode): number => {
    let count = 1;
    if (node.children) {
      count += node.children.reduce((sum, child) => sum + countNodes(child), 0);
    }
    return count;
  };

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
            <h1 className="text-2xl font-bold text-neon-purple">Music Treemap</h1>
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
          </div>
        </div>
      </div>

      <div className="flex">
        <div className="flex-1 h-[calc(100vh-73px)] overflow-hidden">
          {!hasLoaded ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <h2 className="text-3xl font-bold text-neon-purple mb-6">Choose Your Treemap Size</h2>
                <p className="text-gray-400 mb-8">
                  Select how many nodes you want to visualize. Click rectangles to drill down through Genres → Artists → Songs.
                </p>
                
                <div className="bg-dark-surface p-6 rounded-lg border border-gray-700">
                  <div className="mb-6">
                    <label className="block text-white mb-4">
                      Node Count: <span className="text-neon-purple font-bold">{nodeCount}</span>
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="1000"
                      step="50"
                      value={nodeCount}
                      onChange={(e) => setNodeCount(Number(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                      <span>50</span>
                      <span>200</span>
                      <span>400</span>
                      <span>600</span>
                      <span>800</span>
                      <span>1000</span>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-400 mb-6">
                    <p>• 50-100: Fast & clean</p>
                    <p>• 200-400: Good detail</p>
                    <p>• 500-1000: Maximum detail</p>
                  </div>
                  
                  <button
                    onClick={fetchSpotifyData}
                    className="w-full px-6 py-3 bg-neon-purple text-dark-bg font-bold rounded-lg hover:bg-neon-purple/80 transition-all"
                  >
                    Load Treemap
                  </button>
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-neon-purple neon-text text-2xl mb-4">
                  Loading {nodeCount} nodes...
                </div>
                <div className="w-16 h-16 border-4 border-neon-purple border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-gray-400 mt-4 text-sm">
                  Building your music hierarchy
                </p>
              </div>
            </div>
          ) : (
            treemapData && (
              <Treemap 
                data={treemapData} 
                width={typeof window !== 'undefined' ? window.innerWidth : 1200} 
                height={typeof window !== 'undefined' ? window.innerHeight - 73 : 800} 
              />
            )
          )}
        </div>

        <div className="w-80 h-[calc(100vh-73px)] bg-dark-surface border-l border-gray-800 p-6 overflow-y-auto">
          <h2 className="text-xl font-bold mb-4 text-neon-purple">Treemap Guide</h2>
          
          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-gradient-to-r from-neon-pink to-neon-pink/60"></div>
              <span className="text-gray-300">Genres</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-gradient-to-r from-neon-blue to-neon-blue/60"></div>
              <span className="text-gray-300">Artists</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-gradient-to-r from-neon-green to-neon-green/60"></div>
              <span className="text-gray-300">Tracks</span>
            </div>
          </div>

          {hasLoaded && (
            <>
              <div className="border-t border-gray-700 pt-4 mb-4">
                <h3 className="text-lg font-semibold mb-3 text-neon-yellow">How to Navigate</h3>
                <div className="space-y-2 text-sm text-gray-400">
                  <p>• Click any rectangle to zoom into that level</p>
                  <p>• Click the orange bar at top to zoom out</p>
                  <p>• Rectangle size = popularity/play count</p>
                  <p>• Click track rectangles to open in Spotify</p>
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4 mb-4">
                <h3 className="text-lg font-semibold mb-3 text-neon-yellow">Node Control</h3>
                <div className="space-y-3">
                  <label className="block text-sm text-gray-400">
                    Current Size: <span className="text-neon-purple font-bold">{nodeCount} nodes</span>
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="50"
                    value={nodeCount}
                    onChange={(e) => setNodeCount(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-xs text-gray-500">
                    Adjust to change treemap detail level
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <h3 className="text-lg font-semibold mb-3 text-neon-yellow">Stats</h3>
                {treemapData && (
                  <div className="space-y-2 text-sm text-gray-400">
                    <div className="font-semibold text-white">Total Nodes: {countNodes(treemapData)}</div>
                    <div>Genres: {treemapData.children?.length || 0}</div>
                    <div>
                      Artists: {treemapData.children?.reduce((sum, genre) => 
                        sum + (genre.children?.length || 0), 0) || 0}
                    </div>
                    <div>
                      Tracks: {treemapData.children?.reduce((sum, genre) => 
                        sum + (genre.children?.reduce((artistSum, artist) => 
                          artistSum + (artist.children?.length || 0), 0) || 0), 0) || 0}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="border-t border-gray-700 pt-4 mt-4">
            <h3 className="text-lg font-semibold mb-3 text-neon-orange">Hierarchy</h3>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <span className="text-neon-pink">1.</span>
                <span>Start with all genres</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-neon-blue">2.</span>
                <span>Click genre → see artists</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-neon-green">3.</span>
                <span>Click artist → see tracks</span>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4 mt-4">
            <h3 className="text-lg font-semibold mb-3 text-neon-orange">Performance</h3>
            <p className="text-sm text-gray-400">
              {nodeCount <= 100 ? 'Smooth performance mode' :
               nodeCount <= 300 ? 'Balanced detail' :
               nodeCount <= 600 ? 'High detail - good performance' :
               'Maximum detail - smooth on modern devices'}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
} 