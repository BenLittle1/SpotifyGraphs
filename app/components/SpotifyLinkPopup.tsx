'use client';

import React, { useEffect, useState, useRef } from 'react';

interface SpotifyLinkPopupProps {
  name: string;
  type: 'artist' | 'album' | 'track';
  spotifyUrl: string;
  onClose: () => void;
}

const SpotifyLinkPopup: React.FC<SpotifyLinkPopupProps> = ({ name, type, spotifyUrl, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Animate in
    setIsVisible(true);

    // Set timeout to auto-close after 5 seconds
    timeoutRef.current = setTimeout(() => {
      handleClose();
    }, 5000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [name, spotifyUrl]); // Re-run effect when props change

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for animation to complete
  };

  const getIcon = () => {
    switch (type) {
      case 'artist':
        return '🎤';
      case 'album':
        return '💿';
      case 'track':
        return '🎵';
      default:
        return '🎵';
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'artist':
        return 'Artist';
      case 'album':
        return 'Album';
      case 'track':
        return 'Track';
      default:
        return 'Item';
    }
  };

  return (
    <div
      className={`fixed bottom-4 left-4 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-4 max-w-sm transition-all duration-300 z-50 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{getIcon()}</span>
          <div>
            <p className="text-xs text-gray-400">{getTypeLabel()}</p>
            <p className="text-sm font-medium text-white truncate max-w-[200px]">{name}</p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-white transition-colors ml-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <a
        href={spotifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center space-x-2 w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
        <span>Open in Spotify</span>
      </a>
    </div>
  );
};

export default SpotifyLinkPopup; 