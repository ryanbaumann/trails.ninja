import React from 'react';
import { Sparkles } from 'lucide-react';

interface LoadingSpinnerProps {
  progress?: number;
  message?: string;
  subMessage?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  progress,
  message,
  subMessage,
  size = 'md',
  className = ''
}) => {
  const isIndeterminate = progress === undefined;
  const currentProgress = progress ?? 0;

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  };

  const iconSize = {
    sm: 16,
    md: 24,
    lg: 32
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className={`relative ${sizeClasses[size]} mb-6 ${isIndeterminate ? 'animate-spin' : ''}`}>
        <svg
          className="w-full h-full transform -rotate-90"
          viewBox="0 0 128 128"
        >
          {/* Background Circle */}
          <circle
            cx="64"
            cy="64"
            r="58"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-gray-200 dark:text-gray-800"
          />
          {/* Progress Circle */}
          <circle
            cx="64"
            cy="64"
            r="58"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={364} // 2 * pi * 58
            strokeDashoffset={isIndeterminate ? 364 * 0.25 : 364 - (364 * currentProgress) / 100}
            className="text-primary-600 transition-all duration-300 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="text-primary-500 animate-pulse" size={iconSize[size]} />
        </div>
      </div>
      {message && (
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">
          {message}
        </h2>
      )}
      {subMessage && (
        <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
          {subMessage}
        </p>
      )}
    </div>
  );
};
