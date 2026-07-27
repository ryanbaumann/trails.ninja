import React, { useState, useEffect } from 'react';
import { Wand2, Sparkles, Edit3, Images, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { analyzeUserImage } from '../services/geminiService';
import { PromptInput } from './PromptInput';
import { StyleGrid } from './StyleGrid';
import { STYLE_PRINCIPLES, STYLES, LUCKY_PROMPTS } from '../data/styleOptions';
import { GenerationMode, OutputLayout, HairstyleOption } from '../types';
import { OUTPUT_LAYOUT_LABELS } from '../services/geminiModels';

// Flatten the real preset catalog so the model recommends an id we can actually match.
const STYLE_CATALOG: HairstyleOption[] = STYLES.flatMap((section) =>
  section.items.map((item) => ({
    id: item.id,
    label: item.label,
    description: item.desc,
    category: 'style' as const,
  }))
);

interface StepStyleProps {
  onSelect: (style: string) => void;
  selectedStyle: string;
  customPrompt: string;
  setCustomPrompt: (val: string) => void;
  styleReferenceImage: string | null;
  onStyleImageChange: (base64: string | null) => void;
  styleReferenceUrl: string | null;
  onStyleUrlChange: (url: string | null) => void;
  userImage?: string | null;
  apiKey: string;
  onNext: () => void;
  onBack: () => void;
  generationMode: GenerationMode;
  onGenerationModeChange: (mode: GenerationMode) => void;
  outputLayout: OutputLayout;
  onOutputLayoutChange: (layout: OutputLayout) => void;
}

export const StepStyle: React.FC<StepStyleProps> = ({
  onSelect,
  selectedStyle,
  customPrompt,
  setCustomPrompt,
  styleReferenceImage,
  onStyleImageChange,
  styleReferenceUrl,
  onStyleUrlChange,
  userImage,
  apiKey,
  onNext,
  onBack,
  generationMode,
  onGenerationModeChange,
  outputLayout,
  onOutputLayoutChange
}) => {
  const [activeTab, setActiveTab] = useState<'All' | 'Women' | 'Men'>('All');
  const [inputValue, setInputValue] = useState(customPrompt || selectedStyle);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showTokens, setShowTokens] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendationError, setRecommendationError] = useState('');

  useEffect(() => {
    setInputValue(customPrompt || selectedStyle);
  }, [selectedStyle, customPrompt]);

  const handleRecommend = async () => {
    if (!userImage || isRecommending) return;
    setIsRecommending(true);
    setRecommendationError('');
    try {
      const { recommendedStyleId } = await analyzeUserImage(apiKey, userImage, STYLE_CATALOG);
      const match = STYLES.flatMap((section) => section.items).find((item) => item.id === recommendedStyleId);
      if (!match) throw new Error('No matching style returned.');
      const value = `${match.label} - ${match.desc}`;
      setInputValue(value);
      setCustomPrompt('');
      onSelect(value);
    } catch {
      setRecommendationError('Could not recommend a style right now. You can still choose any look below.');
    } finally {
      setIsRecommending(false);
    }
  };

  const handleInputChange = (val: string) => {
    setInputValue(val);
    setCustomPrompt(val);
    onSelect(val);
  };

  const handleAddToken = (token: string) => {
    let newVal = inputValue.trim();
    const tokenLower = token.toLowerCase();

    const exists = newVal.toLowerCase().includes(tokenLower);

    if (exists) {
      const regex = new RegExp(`(^|,\\s*)${token}(,\\s*|$)`, 'i');
      newVal = newVal.replace(regex, (match, p1, p2) => {
        if (p1 && p2) return ', ';
        return '';
      }).trim();

      newVal = newVal.replace(/^,\s*/, '').replace(/,\s*$/, '').replace(/,\s*,/g, ',');
    } else {
      if (!newVal) {
        newVal = token;
      } else {
        newVal = `${newVal}, ${token}`;
      }
    }
    handleInputChange(newVal);
  };

  const handleLucky = () => {
    const prompt = LUCKY_PROMPTS[Math.floor(Math.random() * LUCKY_PROMPTS.length)];
    setInputValue(prompt);
    setCustomPrompt(prompt);
    onSelect(prompt);
  };

  const hasContent = selectedStyle || styleReferenceImage || styleReferenceUrl || inputValue;

  return (
    <div className="max-w-4xl mx-auto pb-24 sm:pb-32 px-1">

      {/* Input Area */}
      <div className="bg-background-light/95 dark:bg-background-dark/95 py-3 sm:py-4 mb-4 sm:mb-6 -mx-2 sm:-mx-4 px-3 sm:px-6 border-b border-slate-200/40 dark:border-slate-800/40 transition-all shadow-sm rounded-b-xl">
        <div className="flex gap-3 items-start">
             {/* Thumbnail preview of user image */}
             {userImage && (
                <div className="hidden sm:block shrink-0">
                    <div className="w-14 h-14 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm relative group">
                        <img src={userImage} alt="You" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/10" />
                    </div>
                    <p className="text-[9px] text-center text-gray-400 mt-1 font-semibold">Selfie</p>
                </div>
             )}

            <div className="flex-1 w-full">
                <PromptInput
                value={inputValue}
                onChange={handleInputChange}
                onImageUpload={onStyleImageChange}
                image={styleReferenceImage}
                onUrlAdd={onStyleUrlChange}
                url={styleReferenceUrl}
                enableSurpriseMe={true}
                onSurpriseMe={handleLucky}
                onSubmit={onNext}
                submitLabel="Transform Now"
                hideSubmitOnMobile={true}
                label={
                    <div className="flex items-center gap-1.5 text-primary-600 dark:text-primary-400">
                    <Edit3 size={15} />
                    <span className="font-bold text-sm">Describe hairstyle</span>
                    <span className="text-gray-400 text-xs font-normal hidden sm:inline">- or choose a trend below</span>
                    </div>
                }
                placeholder="Describe your desired cut, length, style, or color..."
                />
            </div>
        </div>
      </div>

      {/* Output presentation (the one setting that changes real output) */}
      <div className="mb-4 bg-white/70 dark:bg-slate-900/50 border border-slate-200/40 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="min-h-11 w-full flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-primary transition-colors"
        >
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-slate-400" />
            <span>Output Presentation</span>
            <span className="text-[10px] font-normal text-slate-400 ml-2 hidden sm:inline">
              ({OUTPUT_LAYOUT_LABELS[outputLayout]})
            </span>
          </div>
          {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showAdvanced && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-850 animate-fadeIn">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Images size={14} className="text-indigo-500" />
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Result Layout</h4>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(OUTPUT_LAYOUT_LABELS) as OutputLayout[]).map((layout) => (
                  <button
                    key={layout}
                    onClick={() => onOutputLayoutChange(layout)}
                    className={`min-h-11 rounded-xl border px-1 py-2 text-[10px] sm:text-xs font-bold transition-all truncate ${outputLayout === layout ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm' : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 hover:border-indigo-300'}`}
                  >
                    {OUTPUT_LAYOUT_LABELS[layout]}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">Single reveal, a salon sheet (front/side/back), or a before/after comparison.</p>
            </div>
          </div>
        )}
      </div>

      {/* Style Presets Grid (Horizontal filmstrips on mobile) */}
      {userImage && (
        <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-primary-200/70 bg-primary-50/70 p-3 dark:border-primary-900/60 dark:bg-primary-950/20 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Want a starting point? Gemini can analyze your front photo once to recommend a catalog style.
          </p>
          <button
            type="button"
            onClick={handleRecommend}
            disabled={isRecommending}
            className="min-h-11 shrink-0 rounded-xl bg-white px-4 text-xs font-bold text-primary-700 shadow-sm ring-1 ring-primary-200 hover:bg-primary-50 disabled:opacity-60 dark:bg-slate-900 dark:text-primary-300 dark:ring-primary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {isRecommending ? 'Finding a match…' : 'Recommend for me'}
          </button>
          {recommendationError && <p role="alert" className="text-xs font-semibold text-red-600 dark:text-red-400 sm:basis-full">{recommendationError}</p>}
        </div>
      )}
      <StyleGrid
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedStyle={inputValue}
        onSelect={(val) => {
            setInputValue(val);
            setCustomPrompt('');
            onSelect(val);
        }}
      />

      {/* Collapsible Style Builder / Custom Tokens */}
      <div className="mt-6 bg-white/70 dark:bg-slate-900/50 border border-slate-200/40 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setShowTokens(!showTokens)}
          className="min-h-11 w-full flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-primary transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-purple-500" />
            <span>Style Builder (Refine details manually)</span>
          </div>
          {showTokens ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showTokens && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-850 animate-fadeIn">
            {STYLE_PRINCIPLES.map((category) => (
              <div key={category.id} className="bg-slate-50/40 dark:bg-slate-950/20 rounded-xl p-2.5 border border-gray-150/40 dark:border-slate-800/60">
                <div className="flex items-center gap-1 mb-2 text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-slate-800 pb-1.5">
                  <category.icon size={12} className="text-primary-500" />
                  <span className="text-[9px] font-black uppercase tracking-wider">{category.label}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
                  {category.options.map((option) => {
                    const isSelected = inputValue.toLowerCase().includes(option.toLowerCase());
                    return (
                      <button
                        key={option}
                        onClick={() => handleAddToken(option)}
                        className={`
                          text-[9px] font-bold px-2 py-1 rounded-md transition-all duration-200 border
                          ${isSelected
                            ? 'bg-primary border-primary text-white'
                            : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200/60 dark:border-gray-700/60 hover:border-primary-300'}
                        `}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky Bottom Actions on Mobile */}
      <div className="safe-area-bottom fixed bottom-0 inset-x-0 z-45 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-850 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] sm:hidden">
          <div className="p-4 flex gap-3">
            <button
                type="button"
                onClick={onBack}
                className="min-h-11 px-4 py-3 rounded-xl font-bold text-xs border border-slate-250 dark:border-slate-700 text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
                Back
            </button>
            <button
                type="button"
                disabled={!hasContent}
                onClick={onNext}
                className={`
                    min-h-11 flex-1 flex items-center justify-between px-6 py-3 rounded-xl font-black uppercase tracking-wider text-xs transition-all
                    ${hasContent
                        ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-lg shadow-primary-500/25 ring-2 ring-primary-500/10'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}
                `}
            >
                <div className="flex items-center gap-1.5">
                    <Wand2 size={15} />
                    <span>Generate Hairstyle</span>
                </div>
                <span>Transform</span>
            </button>
          </div>
      </div>

    </div>
  );
};
