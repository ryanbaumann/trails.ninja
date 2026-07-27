import React, { useState, useMemo } from 'react';
import { RotateCcw, Download, History, Scissors, Edit3, Share2, Trash2 } from 'lucide-react';
import { GeneratedImage } from '../types';
import { PromptInput } from './PromptInput';
import { MarkdownText } from './MarkdownText';
import { LoadingSpinner } from './LoadingSpinner';
import { HistoryItem } from './HistoryItem';
import { RefinementTools, REFINEMENT_TOOLS } from './RefinementTools';

const mimeFromDataUrl = (url: string) => /^data:([^;,]+)[;,]/i.exec(url)?.[1]?.toLowerCase() || '';

const extensionFromMime = (mime: string) => {
  const normalizedMime = mime.toLowerCase().split(';', 1)[0];
  if (normalizedMime === 'image/jpeg' || normalizedMime === 'image/jpg') return 'jpg';
  if (normalizedMime === 'image/webp') return 'webp';
  return 'png';
};

interface StepResultProps {
  result: GeneratedImage;
  history: GeneratedImage[];
  onHistorySelect: (item: GeneratedImage) => void;
  onRestart: () => void;
  onRefine: (text: string, refImage: string | null, refUrl: string | null) => Promise<void>;
  isRefining: boolean;
  onCtaClick: (type: 'book' | 'pro') => void;
  onDeleteHistoryItem: (id: string, e: React.MouseEvent) => void;
  onClearHistory: () => void;
  onApplyStyle: (style: string) => void;
}

export const StepResult: React.FC<StepResultProps> = ({
  result,
  history,
  onHistorySelect,
  onRestart,
  onRefine,
  isRefining,
  onCtaClick,
  onDeleteHistoryItem,
  onClearHistory,
  onApplyStyle
}) => {
  const [refinementText, setRefinementText] = useState('');
  const [refImage, setRefImage] = useState<string | null>(null);
  const [refUrl, setRefUrl] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleDownload = async () => {
    let mime = mimeFromDataUrl(result.url);
    if (!mime && result.url.startsWith('blob:')) {
      try {
        mime = (await (await fetch(result.url)).blob()).type;
      } catch {
        // The original URL can still download even when its MIME lookup fails.
      }
    }
    const link = document.createElement('a');
    link.href = result.url;
    link.download = `hairstyle-${result.id}.${extensionFromMime(mime)}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Native share sheet with the generated image; falls back to download.
  const handleShare = async () => {
    try {
      const res = await fetch(result.url);
      const blob = await res.blob();
      const mime = blob.type || mimeFromDataUrl(result.url) || 'image/png';
      const file = new File([blob], `hairstyle-${result.id}.${extensionFromMime(mime)}`, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: result.title || 'My new hairstyle',
          text: 'Check out this look from HairStyle AI Studio',
        });
        return;
      }
    } catch (e) {
      // Ignore and fall back to download (e.g. user cancelled the share sheet).
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
    await handleDownload();
  };

  const handleClearHistoryClick = () => {
    if (confirmClear) {
      onClearHistory();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  const submitRefinement = () => {
    if ((!refinementText.trim() && !refImage && !refUrl) || isRefining) return;
    onRefine(refinementText, refImage, refUrl);
    setRefinementText('');
    setRefImage(null);
    setRefUrl(null);
  };

  const toggleRefinement = (option: string) => {
    setRefinementText(prev => {
      const lowerPrev = prev.toLowerCase();
      const lowerOption = option.toLowerCase();

      if (lowerPrev.includes(lowerOption)) {
        // Remove option
        const regex = new RegExp(`(^|,\\s*)${option}(,\\s*|$)`, 'i');
        let newVal = prev.replace(regex, (match, p1, p2) => {
           if (p1 && p2) return ', ';
           return '';
        }).trim();
        return newVal.replace(/^,\s*/, '').replace(/,\s*$/, '').replace(/,\s*,/g, ',');
      } else {
        // Add option
        return prev ? `${prev}, ${option}` : option;
      }
    });
  };

  const selectedRefinements = useMemo(() => {
    const lowerText = refinementText.toLowerCase();
    const allOptions = REFINEMENT_TOOLS.flatMap(tool => tool.options);
    return allOptions.filter(opt => lowerText.includes(opt.toLowerCase()));
  }, [refinementText]);

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 pb-24 lg:pb-12 px-1">

      {/* Sidebar: History (Desktop) */}
      <div className="hidden lg:block lg:col-span-3 order-2 lg:order-1 space-y-4">
        <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-gray-900 dark:text-white font-bold text-base">
                <History size={18} /> Your Collection
            </div>
            {history.length > 0 && (
              <button
                onClick={handleClearHistoryClick}
                aria-label="Clear all saved looks"
                className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md transition-colors ${confirmClear ? 'bg-red-500 text-white' : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
              >
                <Trash2 size={12} /> {confirmClear ? 'Confirm?' : 'Clear'}
              </button>
            )}
        </div>
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {history.map((item) => (
                <HistoryItem
                  key={item.id}
                  item={item}
                  isSelected={result.id === item.id}
                  onSelect={onHistorySelect}
                  onDelete={onDeleteHistoryItem}
                />
            ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:col-span-9 order-1 lg:order-2 space-y-4 sm:space-y-6">

        {/* Mobile History Filmstrip (Ultra-compact horizontal scroll) */}
        {history.length > 1 && (
          <div className="lg:hidden space-y-1.5 mb-2">
            <div className="flex items-center gap-1.5 text-gray-900 dark:text-white font-bold text-xs pl-1">
                <History size={14} /> History ({history.length} versions)
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1.5 -mx-4 px-4 snap-x hide-scrollbar">
                {history.map((item) => (
                    <div key={item.id} className="snap-start shrink-0 w-32">
                      <HistoryItem
                        item={item}
                        isSelected={result.id === item.id}
                        onSelect={onHistorySelect}
                        onDelete={onDeleteHistoryItem}
                      />
                    </div>
                ))}
            </div>
          </div>
        )}

        {/* Top Desktop Actions Bar (Hidden on Mobile) */}
        <div className="hidden sm:flex flex-wrap gap-4 justify-between items-center glass-panel p-4 rounded-2xl shadow-soft">
            <button
                onClick={onRestart}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-semibold text-sm"
            >
                <RotateCcw size={16} /> <span>Start New Look</span>
            </button>
            <div className="flex gap-2">
                <button
                    onClick={handleShare}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold text-sm transition-all"
                >
                    <Share2 size={16} /> <span>Share</span>
                </button>
                <button
                    onClick={() => onCtaClick('book')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:shadow-md transition-all"
                >
                    <Scissors size={16} /> <span>Salon Brief</span>
                </button>
                <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 text-white font-bold text-sm shadow-glow hover:shadow-lg transition-all"
                >
                    <Download size={16} /> Save Image
                </button>
            </div>
        </div>

        {/* Main Render Image Card */}
        <div className="glass-panel hover-lift rounded-2xl p-2 shadow-xl relative overflow-hidden group">
            <img
                src={result.url}
                alt="New Hairstyle Result"
                className="w-full h-auto rounded-xl"
            />

            {/* Title Overlay with a scrim so it stays legible across layouts */}
            <div className="absolute top-2 left-2 right-2 rounded-t-xl pointer-events-none bg-gradient-to-b from-black/50 to-transparent h-16" />
            <div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur-md text-white px-3 py-1 rounded-lg text-xs border border-white/10 max-w-[80%]">
               <MarkdownText text={result.title || "Generated Style"} className="font-semibold truncate block" />
            </div>

            {/* Refining Loading Overlay */}
            {isRefining && (
              <div className="absolute inset-2 bg-white/90 dark:bg-black/70 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center z-20 animate-fadeIn">
                <LoadingSpinner
                  message="Refining hairstyle..."
                  subMessage="This will update the version"
                  size="md"
                />
              </div>
            )}
        </div>

        {/* Refinement Panel */}
        <div className="bg-white/80 dark:bg-slate-900/50 rounded-2xl p-4 sm:p-5 border border-slate-200/40 dark:border-slate-800 shadow-soft">
            <PromptInput
                value={refinementText}
                onChange={setRefinementText}
                onImageUpload={setRefImage}
                image={refImage}
                onUrlAdd={setRefUrl}
                url={refUrl}
                onSubmit={submitRefinement}
                isGenerating={isRefining}
                inputClassName="min-h-[60px]"
                label={
                    <span className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                         <Edit3 size={12} /> Refine / Tweak Style
                    </span>
                }
                placeholder="Describe adjustments (e.g. 'shorten the bangs', 'dye it honey blonde')..."
                submitLabel="Refine"
            />

            <RefinementTools
              selectedOptions={selectedRefinements}
              onToggle={toggleRefinement}
              disabled={isRefining}
            />
        </div>

        <aside className="rounded-2xl border border-primary-200/70 bg-primary-50/80 p-4 text-center dark:border-primary-900/50 dark:bg-primary-950/20 sm:flex sm:items-center sm:justify-between sm:gap-5 sm:text-left">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-600 dark:text-primary-400">Keep exploring</p>
            <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">See more experiments and field notes from Ryan Baumann.</p>
          </div>
          <a
            href="https://ryanbaumann.dev/"
            className="mt-3 inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 px-5 py-2 text-sm font-bold text-white transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:bg-white dark:text-slate-950 dark:hover:bg-primary-100 sm:mt-0"
          >
            Explore Fieldwork
          </a>
        </aside>

      </div>

      {/* Sticky Bottom Actions on Mobile */}
      <div className="safe-area-bottom fixed bottom-0 inset-x-0 z-45 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-850 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] sm:hidden">
          <div className="p-4 flex gap-2">
            <button
                type="button"
                onClick={onRestart}
                aria-label="Start a new look"
                className="min-h-11 min-w-11 p-3 rounded-xl border border-slate-250 dark:border-slate-700 text-slate-650 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
                <RotateCcw size={16} />
            </button>
            <button
                type="button"
                onClick={handleShare}
                aria-label="Share this look"
                className="min-h-11 min-w-11 p-3 rounded-xl border border-slate-250 dark:border-slate-700 text-slate-650 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
                <Share2 size={16} />
            </button>
            <button
                type="button"
                onClick={() => onCtaClick('book')}
                className="min-h-11 flex-1 py-3 px-4 rounded-xl bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-black uppercase tracking-wider text-xs flex items-center justify-center gap-1.5"
            >
                <Scissors size={14} />
                <span>Salon Brief</span>
            </button>
            <button
                type="button"
                onClick={handleDownload}
                className="min-h-11 flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 text-white font-black uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 shadow-md shadow-primary-500/10"
            >
                <Download size={14} />
                <span>Save</span>
            </button>
          </div>
      </div>

    </div>
  );
};
