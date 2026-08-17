import React, { useEffect, useRef } from 'react';
import { ThemeToggle } from './components/ThemeToggle';
import { StepUpload } from './components/StepUpload';
import { StepStyle } from './components/StepStyle';
import { StepResult } from './components/StepResult';
import { SalonBriefModal } from './components/SalonBriefModal';
import { LoadingView } from './components/LoadingView';
import { GeminiKeyDialog } from './components/GeminiKeyDialog';
import { useAppFlow } from './hooks/useAppFlow';
import { Scissors, ShieldCheck, ChevronRight, KeyRound, Code2, ArrowUpRight } from 'lucide-react';

const FIELDWORK_URL = 'https://ryanbaumann.dev/';
const SOURCE_URL = 'https://github.com/ryanbaumann/fieldwork/tree/main/demos/hairstyle-ai-studio';

export const App = () => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const {
    state,
    setState,
    apiKey,
    hasKey,
    freeTier,
    isKeyDialogRequested,
    setIsKeyDialogRequested,
    handleSelectKey,
    forgetApiKey,
    updateImages,
    clearImage,
    handleGenerate,
    handleRefine,
    cancelGeneration,
    isRefining,
    handleDeleteHistoryItem,
    handleClearHistory,
    navigateTo,
    refinementPrompt
  } = useAppFlow(scrollContainerRef);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const useDark = savedTheme === 'dark' ||
      (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', useDark);
  }, []);

  // Navigation Logic Helpers
  const canGoToUpload = true;
  const canGoToStyle = !!state.images.front || state.history.length > 0;
  const canGoToResult = !!state.generatedResult;

  return (
    <div className="h-[100dvh] overflow-hidden bg-background-light dark:bg-background-dark bg-ambient text-slate-800 dark:text-slate-100 transition-colors duration-300 flex flex-col font-sans">

      {/* Navbar */}
      <nav className="w-full px-4 sm:px-6 py-3.5 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50 border-b border-slate-200/60 dark:border-slate-800">
        <a href="/" className="flex min-h-11 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" aria-label="Back to Fieldwork">
          <div className="w-9 h-9 bg-gradient-to-br from-primary to-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md">
            <Scissors size={18} />
          </div>
          <span className="text-lg font-black tracking-tight text-slate-800 dark:text-gray-100">HairStyle AI</span>
        </a>

        {/* Desktop Stepper */}
        <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 rounded-full px-2 py-1 gap-1.5">
           <button
             onClick={() => navigateTo('upload')}
             className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${state.step === 'upload' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary cursor-default' : 'text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary'}`}
           >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${state.step === 'upload' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>1</span>
                Upload
           </button>
           <ChevronRight size={12} className="text-slate-400" />
           <button
             onClick={() => navigateTo('style')}
             disabled={!canGoToStyle}
             className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${state.step === 'style' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary cursor-default' : 'text-slate-500 dark:text-slate-400'} ${canGoToStyle && state.step !== 'style' ? 'hover:text-primary dark:hover:text-primary' : ''} ${!canGoToStyle ? 'opacity-40 cursor-not-allowed' : ''}`}
           >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${state.step === 'style' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>2</span>
                Style
           </button>
           <ChevronRight size={12} className="text-slate-400" />
           <button
             onClick={() => navigateTo('result')}
             disabled={!canGoToResult}
             className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${state.step === 'result' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary cursor-default' : 'text-slate-500 dark:text-slate-400'} ${canGoToResult && state.step !== 'result' ? 'hover:text-primary dark:hover:text-primary' : ''} ${!canGoToResult ? 'opacity-40 cursor-not-allowed' : ''}`}
           >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${state.step === 'result' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>3</span>
                Reveal
           </button>
        </div>

        <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsKeyDialogRequested(true)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-slate-500 hover:text-primary dark:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:px-3"
              aria-label={hasKey ? 'Manage Gemini API key' : 'Use your Gemini API key'}
            >
              <KeyRound size={15} aria-hidden="true" />
              <span className="hidden sm:inline">{hasKey ? 'Personal key' : 'Use my key'}</span>
            </button>
            <ThemeToggle />
        </div>
      </nav>

      {/* Mobile-first compact Stepper Bar (Context always visible) */}
      <div className="md:hidden flex items-center justify-center bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200/40 dark:border-slate-800 py-1.5 gap-2 text-[10px] font-bold tracking-wider uppercase text-slate-450 dark:text-slate-400">
         <button onClick={() => navigateTo('upload')} className={`min-h-11 px-1 ${state.step === 'upload' ? 'text-primary' : ''}`}>1. Upload</button>
         <ChevronRight size={10} className="text-slate-400" />
         <button onClick={() => navigateTo('style')} disabled={!canGoToStyle} className={`min-h-11 px-1 ${state.step === 'style' ? 'text-primary' : ''} ${!canGoToStyle ? 'opacity-50' : ''}`}>2. Style</button>
         <ChevronRight size={10} className="text-slate-400" />
         <button onClick={() => navigateTo('result')} disabled={!canGoToResult} className={`min-h-11 px-1 ${state.step === 'result' ? 'text-primary' : ''} ${!canGoToResult ? 'opacity-50' : ''}`}>3. Reveal</button>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto flex flex-col">
        <main className="max-w-6xl mx-auto px-2.5 sm:px-4 py-3 sm:py-6 flex-1 w-full">
          {!hasKey && freeTier && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-2 text-xs text-primary-950 dark:border-primary-900/50 dark:bg-primary-950/20 dark:text-primary-100">
              <p>
                {freeTier.enabled ? (
                  <>
                    <span className="font-black">{freeTier.remaining} of {freeTier.limit} free generations left today.</span>{' '}
                    Resets at midnight UTC.
                  </>
                ) : (
                  <span className="font-black">The shared tier is unavailable in this environment.</span>
                )}
              </p>
              <button
                type="button"
                onClick={() => setIsKeyDialogRequested(true)}
                className="min-h-11 rounded-lg px-2 font-black text-primary-700 underline decoration-primary-300 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-300"
              >
                Add a personal key
              </button>
            </div>
          )}
          {state.errorMessage && (
            <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800 shadow-sm dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-250">
              <ShieldCheck size={18} className="mt-0.5 shrink-0" />
              <div className="flex-1 text-xs">
                <p className="font-bold">Error detail</p>
                <p>{state.errorMessage}</p>
                {!apiKey && (
                  <button
                    type="button"
                    onClick={() => setIsKeyDialogRequested(true)}
                    className="mt-2 inline-flex items-center gap-1.5 font-bold text-red-700 underline decoration-red-300 underline-offset-4 hover:decoration-red-700 dark:text-red-300 dark:decoration-red-700 dark:hover:decoration-red-300"
                  >
                    Connect your Gemini API key
                  </button>
                )}
              </div>
              <button onClick={() => setState(prev => ({ ...prev, errorMessage: null }))} className="text-xs font-bold hover:underline">Dismiss</button>
            </div>
          )}

          {state.step === 'upload' && (
            <StepUpload
              images={state.images}
              history={state.history}
              onUpload={updateImages}
              onClear={clearImage}
              onNext={() => setState(prev => ({ ...prev, step: 'style' }))}
              onJumpToResult={(result) => setState(prev => ({ ...prev, step: 'result', generatedResult: result }))}
            />
          )}

          {state.step === 'style' && (
            <StepStyle
              selectedStyle={state.selectedStyle}
              customPrompt={state.customPrompt}
              setCustomPrompt={(val) => setState(prev => ({ ...prev, customPrompt: val }))}
              onSelect={(style) => setState(prev => ({ ...prev, selectedStyle: style }))}
              styleReferenceImage={state.styleReferenceImage}
              onStyleImageChange={(val) => setState(prev => ({ ...prev, styleReferenceImage: val }))}
              styleReferenceUrl={state.styleReferenceUrl}
              onStyleUrlChange={(val) => setState(prev => ({ ...prev, styleReferenceUrl: val }))}
              userImage={state.images.front}
              apiKey={apiKey}
              onNext={() => handleGenerate()}
              onBack={() => setState(prev => ({ ...prev, step: 'upload' }))}
              generationMode={state.generationMode}
              onGenerationModeChange={(generationMode) => setState(prev => ({ ...prev, generationMode }))}
              outputLayout={state.outputLayout}
              onOutputLayoutChange={(outputLayout) => setState(prev => ({ ...prev, outputLayout }))}
            />
          )}

          {(state.step === 'generating' || isRefining) && (
            <div className="fixed inset-0 z-50 bg-background-light dark:bg-background-dark overflow-y-auto">
               <div className="min-h-screen p-4 flex flex-col">
                  <LoadingView
                    userImage={isRefining ? state.generatedResult?.url : state.images.front}
                    prompt={isRefining ? refinementPrompt : (state.customPrompt || state.selectedStyle)}
                    onCancel={cancelGeneration}
                  />
               </div>
            </div>
          )}

          {state.step === 'result' && state.generatedResult && (
            <StepResult
              result={state.generatedResult}
              history={state.history}
              onHistorySelect={(item) => setState(prev => ({ ...prev, generatedResult: item }))}
              onRestart={() => setState(prev => ({ ...prev, step: 'upload' }))}
              onRefine={handleRefine}
              isRefining={isRefining}
              onCtaClick={() => setState(prev => ({ ...prev, isSalonBriefOpen: true }))}
              onDeleteHistoryItem={handleDeleteHistoryItem}
              onClearHistory={handleClearHistory}
              onApplyStyle={(style) => {
                  setState(prev => ({ ...prev, selectedStyle: style }));
                  handleGenerate(style);
              }}
            />
          )}
        </main>

        <div className="container mx-auto px-4 sm:px-6 pb-6 mt-auto">
          <footer className="flex flex-col items-center justify-center gap-2 py-4 text-center text-[10px] text-slate-400 sm:flex-row sm:gap-4">
              <span>© {new Date().getFullYear()} Hairstyle AI Studio. Photos are sent to Google Gemini only when requested and are not stored on our servers.</span>
              <span className="flex items-center gap-3 text-xs font-bold">
                <a className="inline-flex min-h-11 items-center gap-1 hover:text-primary-600" href={FIELDWORK_URL}>More from Ryan <ArrowUpRight size={12} aria-hidden="true" /></a>
                <a className="inline-flex min-h-11 items-center gap-1 hover:text-primary-600" href={SOURCE_URL} target="_blank" rel="noopener noreferrer"><Code2 size={12} aria-hidden="true" /> Source</a>
              </span>
          </footer>
        </div>
      </div>

      <SalonBriefModal
        isOpen={state.isSalonBriefOpen}
        onClose={() => setState(prev => ({ ...prev, isSalonBriefOpen: false }))}
        result={state.generatedResult}
        referenceImage={state.styleReferenceImage}
        referenceUrl={state.styleReferenceUrl}
      />
      <GeminiKeyDialog
        isOpen={isKeyDialogRequested}
        hasPersonalKey={hasKey}
        onClose={() => setIsKeyDialogRequested(false)}
        onConnect={handleSelectKey}
        onDisconnect={forgetApiKey}
      />
    </div>
  );
};
