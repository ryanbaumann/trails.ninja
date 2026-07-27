import React, { useState } from 'react';
import { X } from 'lucide-react';
import { GeneratedImage } from '../types';
import { MarkdownText } from './MarkdownText';

interface HistoryItemProps {
  item: GeneratedImage;
  isSelected: boolean;
  onSelect: (item: GeneratedImage) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export const HistoryItem: React.FC<HistoryItemProps> = ({ item, isSelected, onSelect, onDelete }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(item); }}
      className={`
          w-full text-left rounded-xl overflow-hidden border transition-all duration-300 ease-out relative group shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]
          ${isSelected
              ? 'border-primary-500 ring-2 ring-primary-500/30 bg-primary-50/70 dark:bg-primary-900/20 backdrop-blur-md'
              : 'border-gray-200/50 dark:border-gray-800/50 hover:border-primary-300/80 dark:hover:border-primary-700/80 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm'}
      `}
    >
      <div className="flex gap-2 p-1.5">
          <img src={item.url} alt="Thumbnail" className="w-12 h-12 object-cover rounded-lg bg-gray-100" />
          <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="text-xs font-semibold text-gray-900 dark:text-white truncate leading-tight tracking-tight">
                  <MarkdownText text={item.title?.split(' ').slice(0, 2).join(' ') || item.prompt.split('-')[0].split(' ').slice(0, 2).join(' ') || "Custom Look"} />
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {new Date(item.timestamp).toLocaleDateString([], {month: 'short', day: 'numeric'})} • {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirmDelete) {
                onDelete(item.id, e);
              } else {
                setConfirmDelete(true);
                setTimeout(() => setConfirmDelete(false), 3000);
              }
            }}
            className={`absolute top-2 right-2 p-1.5 text-white rounded-full transition-all duration-300 ${
              confirmDelete
                ? 'bg-red-500 opacity-100 scale-110'
                : 'bg-black/40 hover:bg-red-400 opacity-0 group-hover:opacity-100 backdrop-blur-md'
            }`}
            title={confirmDelete ? "Click again to confirm" : "Delete Image"}
            aria-label={confirmDelete ? "Click again to confirm deletion" : "Delete this look"}
          >
            <X size={12} />
          </button>
      </div>
    </div>
  );
};
