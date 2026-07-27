import React, { useState } from 'react';
import { Scissors } from 'lucide-react';

interface PresetImageProps {
  src: string;
  alt: string;
}

export const PresetImage: React.FC<PresetImageProps> = ({ src, alt }) => {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (error) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 flex flex-col items-center justify-center text-primary-300 dark:text-gray-700">
        <Scissors size={32} className="mb-2 opacity-50" />
      </div>
    );
  }

  return (
    <>
      {!loaded && <div className="absolute inset-0 bg-gray-200 dark:bg-gray-800 animate-pulse" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </>
  );
};
