import React, { useEffect, useRef, useState } from 'react';
import { X, Printer, MapPin, Scissors } from 'lucide-react';
import { GeneratedImage } from '../types';
import { MarkdownText } from './MarkdownText';

interface SalonBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: GeneratedImage | null;
  referenceImage?: string | null;
  referenceUrl?: string | null;
}

// A stylist-ready summary the user can print, save as PDF, or show at the salon.
// This replaces the old fake "Book Stylist" waitlist and delivers the app's core
// promise: inspiration → iterate → walk into the salon ready.
export const SalonBriefModal: React.FC<SalonBriefModalProps> = ({
  isOpen,
  onClose,
  result,
  referenceImage,
  referenceUrl,
}) => {
  const [notes, setNotes] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Simple focus trap.
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen || !result) return null;

  const mapsUrl = 'https://www.google.com/maps/search/hair+salon+near+me';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn no-print"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="salon-brief-title"
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-5 sm:p-6">
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close salon brief"
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors no-print"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-xl flex items-center justify-center">
              <Scissors size={18} />
            </div>
            <div>
              <h2 id="salon-brief-title" className="text-lg font-bold text-gray-900 dark:text-white">Take this to the salon</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Print or save this brief to show your stylist.</p>
            </div>
          </div>

          {/* Printable brief */}
          <div className="salon-brief-print space-y-4 rounded-xl border border-gray-200 dark:border-gray-800 p-4 bg-gray-50/60 dark:bg-gray-950/40">
            <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-white">
              <img src={result.url} alt="Target hairstyle" className="w-full h-auto" />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Look</p>
              <div className="text-base font-bold text-gray-900 dark:text-white">
                <MarkdownText text={result.title || 'Custom Hairstyle'} />
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Style details</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{result.prompt || 'Not provided'}</p>
            </div>

            {result.outputLayout && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Reference layout</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 capitalize">{result.outputLayout.replace('-', ' / ')}</p>
              </div>
            )}

            {(referenceImage || referenceUrl) && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Inspiration reference</p>
                {referenceImage && (
                  <img src={referenceImage} alt="Inspiration reference" className="mt-1 w-24 h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-800" />
                )}
                {referenceUrl && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 break-all mt-1">{referenceUrl}</p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="salon-notes" className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Notes for your stylist</label>
              <textarea
                id="salon-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g. keep length below the shoulders, low-maintenance, book for next Saturday…"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-5 flex flex-col sm:flex-row gap-2 no-print">
            <button
              onClick={() => window.print()}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-all shadow-lg"
            >
              <Printer size={16} /> Print / Save as PDF
            </button>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-xl transition-all"
            >
              <MapPin size={16} /> Find salons nearby
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
