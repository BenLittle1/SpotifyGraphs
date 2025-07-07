'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function ErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'AccessDenied':
        return 'Access was denied. Please make sure to authorize the app.';
      case 'Configuration':
        return 'There is a problem with the server configuration.';
      case 'Verification':
        return 'The verification token has expired or has already been used.';
      default:
        return 'An error occurred during authentication.';
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-dark-bg">
      <div className="text-center max-w-md px-6">
        <div className="text-6xl mb-6">⚠️</div>
        <h1 className="text-3xl font-bold mb-4 text-red-500">Authentication Error</h1>
        <p className="text-gray-400 mb-8">{getErrorMessage(error)}</p>
        
        <Link
          href="/"
          className="inline-block px-8 py-3 bg-neon-green text-dark-bg font-bold rounded-lg
                   hover:bg-neon-green/80 transition-all duration-300"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
} 