import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { ShieldCheck, X } from 'lucide-react';

interface LoadingViewProps {
  userImage?: string | null;
  prompt?: string;
  onCancel?: () => void;
}

export const LoadingView: React.FC<LoadingViewProps> = ({ userImage, prompt, onCancel }) => (
  <div
    className="mx-auto flex min-h-[70dvh] w-full max-w-3xl flex-col items-center justify-center gap-6 px-4 py-8 animate-fadeIn"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <div className="relative aspect-[16/10] w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-2xl dark:border-slate-800">
      {userImage && <img src={userImage} alt="" className="h-full w-full object-cover opacity-35 blur-[1px]" />}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-slate-950/50 p-6 text-center">
        <LoadingSpinner size="lg" />
        <div>
          <h1 className="text-xl font-black text-white sm:text-2xl">Creating your hairstyle</h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-200">
            Gemini is applying {prompt ? 'your selected look' : 'the requested changes'}. This can take up to two minutes.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-200">
          <ShieldCheck size={15} className="text-emerald-400" />
          Your photos are not stored by Fieldwork
        </div>
      </div>
    </div>
    {onCancel && (
      <button
        type="button"
        onClick={onCancel}
        className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 hover:border-red-300 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        <X size={17} /> Cancel generation
      </button>
    )}
  </div>
);
