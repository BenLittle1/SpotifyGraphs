'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session && !session.error) {
      router.push('/dashboard');
    }
  }, [session, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-neon-blue neon-text text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-dark-bg">
      <div className="relative z-10 text-center px-6">
        <h1 className="text-6xl md:text-8xl font-bold mb-4">
          <span className="text-neon-pink neon-text">Spotify</span>{' '}
          <span className="text-neon-blue neon-text">Graphs</span>
        </h1>
        
        <p className="text-xl md:text-2xl mb-12 text-gray-300 max-w-2xl mx-auto">
          Visualize your music taste in stunning network graphs with neon aesthetics
        </p>

        {session?.error === 'RefreshAccessTokenError' && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded-lg">
            <p className="text-red-400">Session expired. Please login again.</p>
          </div>
        )}

        <button
          onClick={() => signIn('spotify')}
          className="px-8 py-4 bg-neon-green text-dark-bg font-bold text-lg rounded-full 
                     hover:bg-neon-green/80 transition-all duration-300 
                     shadow-[0_0_20px_rgba(57,255,20,0.5)] hover:shadow-[0_0_30px_rgba(57,255,20,0.8)]"
        >
          Connect with Spotify
        </button>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="p-6 bg-dark-surface rounded-lg border border-neon-purple/30">
            <div className="text-neon-purple text-4xl mb-4">🎵</div>
            <h3 className="text-xl font-bold mb-2 text-neon-purple">Top Tracks</h3>
            <p className="text-gray-400">Visualize your most played songs</p>
          </div>
          
          <div className="p-6 bg-dark-surface rounded-lg border border-neon-orange/30">
            <div className="text-neon-orange text-4xl mb-4">🎤</div>
            <h3 className="text-xl font-bold mb-2 text-neon-orange">Artists & Genres</h3>
            <p className="text-gray-400">Explore connections between artists and genres</p>
          </div>
          
          <div className="p-6 bg-dark-surface rounded-lg border border-neon-yellow/30">
            <div className="text-neon-yellow text-4xl mb-4">🌐</div>
            <h3 className="text-xl font-bold mb-2 text-neon-yellow">Interactive Graphs</h3>
            <p className="text-gray-400">Zoom, drag, and explore your music network</p>
          </div>
        </div>

        {/* Version indicator for deployment testing */}
        <div className="mt-8 text-xs text-gray-600">
          v2.0 - GitHub Connected
        </div>
      </div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-pink/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-blue/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-neon-green/10 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>
    </main>
  );
} 