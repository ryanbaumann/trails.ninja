import React, { useState } from 'react';
import { ArrowRight, Scan, Layers, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { ImageUpload } from './ImageUpload';
import { UploadedImages, ViewType, GeneratedImage } from '../types';

interface StepUploadProps {
  images: UploadedImages;
  history?: GeneratedImage[];
  onUpload: (view: ViewType, base64: string) => void;
  onClear: (view: ViewType) => void;
  onNext: () => void;
  onJumpToResult: (result: GeneratedImage) => void;
}

// Local, optimized preview images (no external hosts / CSP holes).
const PREVIEW_IMAGES = [
    "images/optimized/women/copper-shag.jpg",
    "images/optimized/men/modern-mullet.jpg",
    "images/optimized/women/glass-bob.jpg"
];

export const StepUpload: React.FC<StepUploadProps> = ({ images, history, onUpload, onClear, onNext, onJumpToResult }) => {
  const [showOptionalViews, setShowOptionalViews] = useState(false);

  return (
    <div className="container mx-auto px-2 sm:px-6 flex flex-col lg:flex-row gap-6 lg:gap-12 items-start pb-24 sm:pb-8">

      {/* Left Column: Hero & Preview - Hidden on Mobile */}
      <div className="hidden lg:flex w-full lg:w-5/12 flex-col gap-6">
            <div className="space-y-3">
                <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight text-slate-900 dark:text-white">
                    Reinvent your look <br />
                    <span className="text-gradient">in seconds.</span>
                </h1>
                <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg">
                    Try on trending styles from photos or videos to find your perfect cut. Compare looks, choose your favorite, and make your next styling decision amazing.
                </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <div className="bg-slate-100 dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Preview Mode: Vibrant Copper</span>
                    <div className="w-8"></div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800">
                    <div className="grid grid-cols-3 gap-2 h-40 sm:h-56">
                         {PREVIEW_IMAGES.map((src, i) => (
                            <div key={i} className="relative rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700 h-full">
                                <img
                                    src={src}
                                    alt={`Preview view ${i+1}`}
                                    className={`object-cover w-full h-full opacity-90 hover:scale-105 transition-transform duration-700 ${i === 2 ? 'transform scale-x-[-1]' : ''}`}
                                />
                            </div>
                         ))}
                    </div>
                </div>
            </div>

            <div className="flex gap-6 justify-center lg:justify-start pt-1">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium text-sm">
                    <Scan size={18} className="text-primary" />
                    Face Mapping
                </div>
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium text-sm">
                    <Layers size={18} className="text-primary" />
                    360° Matrix
                </div>
            </div>
      </div>

      {/* Right Column: Upload Canvas */}
      <div className="w-full lg:w-7/12">
            {/* Mobile Header / Quick Context */}
            <div className="lg:hidden mb-4 px-1">
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    HairStyle AI Studio
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Upload your photo to try trending cuts, textures, and colors in seconds.
                </p>
            </div>

            <div className="bg-card-light dark:bg-card-dark rounded-2xl p-4 sm:p-6 shadow-soft dark:shadow-none border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Step 1: Upload Photo</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Start with a clear selfie or portrait.</p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                        Required: Front
                    </span>
                </div>

                {/* Main upload view: Front */}
                <div className="grid grid-cols-1 gap-4 mb-4">
                    <div className="flex flex-col gap-1.5">
                         <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 pl-0.5">Front View (Main Portrait)</span>
                         <ImageUpload
                            view="front"
                            image={images.front}
                            onUpload={onUpload}
                            onClear={onClear}
                            required
                        />
                    </div>
                </div>

                {/* Collapsible optional views for Side & Back to save vertical space on mobile */}
                <div className="border-t border-slate-100 dark:border-slate-850 pt-3 mt-3">
                    <button
                        type="button"
                        onClick={() => setShowOptionalViews(!showOptionalViews)}
                        className="min-h-11 w-full flex items-center justify-between py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-primary transition-colors pl-0.5"
                    >
                        <span>Add Side & Back angles (Optional)</span>
                        {showOptionalViews ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {showOptionalViews && (
                        <div className="grid grid-cols-2 gap-3 pt-3 pb-2 animate-fadeIn">
                            <div className="flex flex-col gap-1.5">
                                 <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 pl-0.5">Side View</span>
                                 <ImageUpload
                                    view="side"
                                    image={images.side}
                                    onUpload={onUpload}
                                    onClear={onClear}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                 <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 pl-0.5">Back View</span>
                                 <ImageUpload
                                    view="back"
                                    image={images.back}
                                    onUpload={onUpload}
                                    onClear={onClear}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Desktop-only action footer */}
                <div className="hidden sm:flex items-center justify-between gap-4 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-400 max-w-xs leading-tight flex items-center gap-2">
                        <ShieldCheck size={14} className="shrink-0 text-emerald-500" />
                        Photos are sent to Google Gemini to generate looks and aren't stored on our servers. Your history stays in this browser.
                    </p>
                    <button
                        className={`px-8 py-3 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all whitespace-nowrap
                            ${images.front
                                ? 'bg-primary text-white shadow-glow hover:shadow-lg hover:bg-primary-dark cursor-pointer'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-500 cursor-not-allowed'}`}
                        disabled={!images.front}
                        onClick={onNext}
                    >
                        Choose Your Style
                        <ArrowRight size={18} />
                    </button>
                </div>
            </div>

            {/* Resume Session Block */}
            {history && history.length > 0 && (
                <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/50 dark:border-slate-800 flex items-center justify-between text-xs">
                     <span className="font-medium text-slate-500 dark:text-slate-400">
                        You have {history.length} generated looks in this session.
                     </span>
                     <button
                        onClick={() => onJumpToResult(history[0])}
                        className="text-primary dark:text-primary-light hover:text-primary-dark font-bold hover:underline"
                    >
                        View History
                     </button>
                </div>
            )}
      </div>

      {/* Sticky Call-To-Action Footer on Mobile */}
      <div className="safe-area-bottom fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] sm:hidden">
          <div className="p-4 flex flex-col gap-2">
            <button
                disabled={!images.front}
                onClick={onNext}
                className={`
                    w-full flex items-center justify-between px-6 py-3 rounded-xl font-black uppercase tracking-wider text-sm transition-all
                    ${images.front
                        ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-lg shadow-primary-500/25 ring-2 ring-primary-500/10'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}
                `}
            >
                <span>Continue to style selection</span>
                <div className="flex items-center gap-1.5 font-bold">
                    <span>Next</span>
                    <ArrowRight size={16} />
                </div>
            </button>
            <p className="text-[9px] text-slate-400 text-center flex items-center justify-center gap-1">
                <ShieldCheck size={11} className="text-emerald-500" /> Sent to Google Gemini · not stored on our servers · history stays on-device
            </p>
          </div>
      </div>

    </div>
  );
};
