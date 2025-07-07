'use client';

import Link from 'next/link';

export default function DiscoveryPathPage() {
  return (
    <main className="min-h-screen bg-dark-bg flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-6">🚀</div>
        <h1 className="text-4xl font-bold mb-4 text-neon-yellow neon-text">Discovery Path</h1>
        <p className="text-gray-400 mb-8 max-w-md">
          This visualization is coming soon! It will show how your music taste has evolved over time, tracking your journey through different genres and artists.
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