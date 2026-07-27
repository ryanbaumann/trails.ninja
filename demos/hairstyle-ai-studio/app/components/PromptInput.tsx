
import React, { useRef, useState } from 'react';
import { Edit3, Dices, ImageIcon, Link as LinkIcon, Wand2, Trash2 } from 'lucide-react';
import { processImageFile, ImageValidationError } from '../utils/image';

const MAX_URL_LENGTH = 300;

const Youtube = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
);

interface PromptInputProps {
  value: string;
  onChange: (val: string) => void;
  onImageUpload: (base64: string | null) => void;
  image: string | null;
  onUrlAdd: (url: string | null) => void;
  url: string | null;
  onSubmit?: () => void;
  isGenerating?: boolean;
  placeholder?: string;
  label?: React.ReactNode;
  enableSurpriseMe?: boolean;
  onSurpriseMe?: () => void;
  submitLabel?: string;
  inputClassName?: string;
  hideSubmitOnMobile?: boolean;
}

export const PromptInput: React.FC<PromptInputProps> = ({
  value,
  onChange,
  onImageUpload,
  image,
  onUrlAdd,
  url,
  onSubmit,
  isGenerating = false,
  placeholder = "Describe your look...",
  label,
  enableSurpriseMe = false,
  onSurpriseMe,
  submitLabel = "Generate",
  inputClassName = "min-h-[80px]",
  hideSubmitOnMobile = false
}) => {
  const [isLinkInputOpen, setIsLinkInputOpen] = useState(false);
  const [tempLink, setTempLink] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isYoutube = /(?:youtube\.com|youtu\.be)/i.test(url || '');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const processed = await processImageFile(file);
      onImageUpload(processed);
    } catch (err) {
      setUploadError(err instanceof ImageValidationError ? err.message : 'Could not process that image.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddLink = () => {
    const trimmed = tempLink.trim().slice(0, MAX_URL_LENGTH);
    if (trimmed) {
      onUrlAdd(trimmed);
      setTempLink('');
      setIsLinkInputOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="w-full group">
      {/* Header / Label */}
      <div className="flex justify-between items-end mb-2 px-1">
        <label htmlFor="hairstyle-description" className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
          {label || (
            <>
              <Edit3 size={14} className="text-primary-500" />
              Describe details
            </>
          )}
        </label>
        {enableSurpriseMe && onSurpriseMe && (
          <button
            type="button"
            onClick={onSurpriseMe}
            className="min-h-11 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1 bg-primary-50 dark:bg-primary-900/20 px-3 py-1 rounded-md transition-colors"
          >
            <Dices size={14} /> Surprise Me
          </button>
        )}
      </div>

      {uploadError && (
        <div className="mb-2 px-3 py-1.5 text-[11px] font-medium text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-lg" role="alert">
          {uploadError}
        </div>
      )}

      <div className={`
        relative shadow-lg rounded-xl bg-white dark:bg-gray-900 border transition-all duration-200
        ${isGenerating ? 'opacity-70 pointer-events-none' : ''}
        border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-primary-500/50 focus-within:border-primary-500
      `}>

        {/* Input Area */}
        <textarea
          id="hairstyle-description"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full px-4 pt-4 pb-2 bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400 font-medium resize-none ${inputClassName}`}
          disabled={isGenerating}
        />

        {/* New Enhanced Media Cards Area */}
        {(image || url) && (
          <div className="px-4 pb-4 animate-fadeIn">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                {/* Image Card */}
                {image && (
                  <div className="relative h-32 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group/card">
                     <img src={image} alt="Reference" className="w-full h-full object-cover" />
                     <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
                     <div className="absolute bottom-2 left-3">
                        <p className="text-white text-xs font-bold flex items-center gap-1.5">
                            <ImageIcon size={12} /> Reference Photo
                        </p>
                     </div>
                     <button
                        type="button"
                        onClick={() => onImageUpload(null)}
                        className="absolute top-2 right-2 min-h-11 min-w-11 p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-full backdrop-blur-sm transition-colors opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 sm:focus-visible:opacity-100"
                        aria-label="Remove reference photo"
                     >
                        <Trash2 size={14} />
                     </button>
                  </div>
                )}

                {/* Video/URL Card */}
                {url && (
                   <div className="relative h-32 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-900 group/card">
                      <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                           <div className="flex flex-col items-center gap-2 text-gray-400">
                              <LinkIcon size={24} />
                              <span className="text-xs font-medium">Style link</span>
                           </div>
                        </div>

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90" />

                      <div className="absolute bottom-2 left-3 right-10">
                         <p className="text-white text-xs font-bold flex items-center gap-1.5">
                             {isYoutube ? <Youtube size={12} className="text-red-500" /> : <LinkIcon size={12} />}
                             {isYoutube ? 'YouTube Inspiration' : 'Style Link'}
                         </p>
                         <p className="text-gray-300 text-[10px] truncate w-full opacity-80">{url}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onUrlAdd(null)}
                        className="absolute top-2 right-2 min-h-11 min-w-11 p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-full backdrop-blur-sm transition-colors opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 sm:focus-visible:opacity-100"
                        aria-label="Remove style link"
                      >
                         <Trash2 size={14} />
                      </button>
                   </div>
                )}
             </div>
          </div>
        )}

        {/* Toolbar / Actions Footer */}
        <div className="flex flex-wrap items-center justify-between px-2 py-2 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 rounded-b-xl gap-2">
            <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-h-11 items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-300 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                  title="Upload Reference Photo"
                  disabled={isGenerating}
                >
                  <ImageIcon size={16} className="text-blue-500" />
                  <span>Reference Photo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsLinkInputOpen(true)}
                  className="flex min-h-11 items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-300 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                  title="Link Video Style"
                  disabled={isGenerating}
                >
                  <LinkIcon size={16} className="text-red-500" />
                  <span>Video URL</span>
                </button>
            </div>

            {/* Submit Button (Hidden on Mobile if sticky footer exists) */}
            {onSubmit && (
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={(!value && !image && !url) || isGenerating}
                    className={`
                        ${hideSubmitOnMobile ? 'hidden sm:flex' : 'flex'} items-center gap-2 px-6 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition-all shadow-lg ml-auto
                        ${value || image || url
                            ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white hover:from-primary-500 hover:to-indigo-500 shadow-primary-500/30 hover:shadow-primary-500/50 hover:-translate-y-0.5 active:translate-y-0 active:scale-95'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}
                        ${(value || image || url) && !isGenerating ? 'animate-pulse ring-2 ring-primary-500/20' : ''}
                    `}
                >
                    {isGenerating ? <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" /> : <Wand2 size={16} />}
                    {submitLabel}
                </button>
            )}
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          id="style-reference-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* URL Input Popover */}
        {isLinkInputOpen && (
          <div
            className="absolute bottom-full left-0 mb-2 p-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 animate-scaleIn origin-bottom-left w-full max-w-sm"
            role="dialog"
            aria-labelledby="style-link-label"
            onKeyDown={(event) => {
              if (event.key === 'Escape') setIsLinkInputOpen(false);
            }}
          >
             <div className="p-3">
                <label id="style-link-label" htmlFor="style-link-input" className="block text-xs font-semibold text-gray-900 dark:text-white mb-2">Paste a style link</label>
                <div className="flex gap-2">
                    <input
                        id="style-link-input"
                        autoFocus
                        type="text"
                        value={tempLink}
                        onChange={(e) => setTempLink(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
                        placeholder="https://..."
                        className="flex-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                    <button
                        type="button"
                        onClick={handleAddLink}
                        className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-700"
                    >
                        Add
                    </button>
                </div>
             </div>
             <div className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-b-lg border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                 <span className="text-[10px] text-gray-500">We use the link text as a style hint. We can't watch the video.</span>
                 <button type="button" onClick={() => setIsLinkInputOpen(false)} className="min-h-11 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-[10px] font-medium px-2">Cancel</button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
