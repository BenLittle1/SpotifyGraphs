'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

interface GraphType {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  route: string;
}

const graphTypes: GraphType[] = [
  {
    id: 'top-tracks',
    title: 'Top Tracks Network',
    description: 'Visualize your most played tracks and their connections',
    icon: '🎵',
    color: 'neon-green',
    route: '/dashboard/top-tracks',
  },
  {
    id: 'genre-map',
    title: 'Genre Map',
    description: 'Explore the genres you listen to and how they connect',
    icon: '🌐',
    color: 'neon-pink',
    route: '/dashboard/genre-map',
  },
  {
    id: 'artist-network',
    title: 'Artist Network',
    description: 'See how your favorite artists are connected',
    icon: '🎤',
    color: 'neon-blue',
    route: '/dashboard/artist-network',
  },
  {
    id: 'discovery-path',
    title: 'Discovery Path',
    description: 'Track how your music taste evolved over time',
    icon: '🚀',
    color: 'neon-yellow',
    route: '/dashboard/discovery-path',
  },
];

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated' || session?.error) {
      router.push('/');
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-neon-blue neon-text text-2xl">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <main className="min-h-screen bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-bold">
            <span className="text-neon-pink neon-text">Your</span>{' '}
            <span className="text-neon-blue neon-text">Music Graphs</span>
          </h1>
          
          <button
            onClick={() => signOut()}
            className="px-6 py-2 bg-dark-surface border border-neon-purple/50 text-neon-purple rounded-lg
                     hover:bg-neon-purple/10 transition-all duration-300"
          >
            Sign Out
          </button>
        </header>

        <div className="mb-8 p-6 bg-dark-surface rounded-lg border border-gray-800">
          <h2 className="text-xl font-semibold mb-2 text-neon-green">Welcome back!</h2>
          <p className="text-gray-400">Choose a visualization to explore your Spotify data</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {graphTypes.map((graph) => (
            <Link
              key={graph.id}
              href={graph.route}
              className={`group p-8 bg-dark-surface rounded-xl border border-${graph.color}/30 
                       hover:border-${graph.color}/60 transition-all duration-300
                       hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]`}
            >
              <div className="flex items-start gap-6">
                <div className={`text-6xl text-${graph.color}`}>{graph.icon}</div>
                <div className="flex-1">
                  <h3 className={`text-2xl font-bold mb-2 text-${graph.color} group-hover:neon-text transition-all`}>
                    {graph.title}
                  </h3>
                  <p className="text-gray-400">{graph.description}</p>
                  
                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                    <span>Click to explore</span>
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12 p-6 bg-dark-surface/50 rounded-lg border border-gray-800">
          <h3 className="text-lg font-semibold mb-2 text-neon-orange">Pro Tips:</h3>
          <ul className="space-y-2 text-gray-400">
            <li>• Click and drag nodes to rearrange the graph</li>
            <li>• Scroll to zoom in and out</li>
            <li>• Click on nodes to open them in Spotify</li>
            <li>• Hover over nodes to see more details</li>
          </ul>
        </div>
      </div>
    </main>
  );
} 