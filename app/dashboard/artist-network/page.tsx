'use client';

import Link from 'next/link';

export default function ArtistNetworkPage() {
  return (
    <main className="min-h-screen bg-dark-bg flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-6">🎤</div>
        <h1 className="text-4xl font-bold mb-4 text-neon-blue neon-text">Artist Network</h1>
        <p className="text-gray-400 mb-8 max-w-md">
          This visualization is coming soon! It will display how your favorite artists are connected through collaborations and similar styles.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-6 py-3 bg-neon-green text-dark-bg font-bold rounded-lg
                   hover:bg-neon-green/80 transition-all duration-300"
        >
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
} 