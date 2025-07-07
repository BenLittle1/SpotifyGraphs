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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'short_term' | 'medium_term' | 'long_term'>('medium_term');

  useEffect(() => {
    if (status === 'unauthenticated' || session?.error) {
      router.push('/');
    }
  }, [session, status, router]);

  useEffect(() => {
    if (session?.accessToken) {
      fetchSpotifyData();
    }
  }, [session, timeRange]);

  const fetchSpotifyData = async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const client = new SpotifyClient(session.accessToken);
      
      // Fetch top tracks
      const tracks = await client.getTopTracks(50, timeRange);
      
      if (tracks.length === 0) {
        setError('No top tracks found. Try listening to more music!');
        setLoading(false);
        return;
      }

      // Get unique artist IDs from tracks
      const artistIds = Array.from(new Set(
        tracks.flatMap(track => track.artists.map(artist => artist.id))
      ));

      // Fetch artist details for genres
      const artists = await client.getMultipleArtists(artistIds);

      // Process data into graph format
      const fullGraphData = processSpotifyDataToGraph(tracks, artists);
      
      // Filter to ~200 nodes for performance
      const filteredData = filterGraphBySize(fullGraphData, 200);
      
      setGraphData(filteredData);
    } catch (err) {
      console.error('Error fetching Spotify data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch Spotify data');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <div className="text-center">
          <div className="text-neon-blue neon-text text-2xl mb-4">Loading your music data...</div>
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
          </div>
        </div>
      </div>

      <div className="flex">
        <div className="flex-1 h-[calc(100vh-73px)] overflow-hidden">
          {graphData && (
            <ForceGraph 
              data={graphData} 
              width={typeof window !== 'undefined' ? window.innerWidth : 1200} 
              height={typeof window !== 'undefined' ? window.innerHeight - 73 : 800} 
            />
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

          <div className="border-t border-gray-700 pt-4">
            <h3 className="text-lg font-semibold mb-3 text-neon-yellow">Stats</h3>
            {graphData && (
              <div className="space-y-2 text-sm text-gray-400">
                <div>Total Nodes: {graphData.nodes.length}</div>
                <div>Total Connections: {graphData.links.length}</div>
                <div>Tracks: {graphData.nodes.filter(n => n.group === 'track').length}</div>
                <div>Artists: {graphData.nodes.filter(n => n.group === 'artist').length}</div>
                <div>Genres: {graphData.nodes.filter(n => n.group === 'genre').length}</div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-700 pt-4 mt-4">
            <h3 className="text-lg font-semibold mb-3 text-neon-orange">Tips</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>• Larger nodes = higher popularity</li>
              <li>• Click nodes to open in Spotify</li>
              <li>• Drag to rearrange the graph</li>
              <li>• Scroll to zoom in/out</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
} 