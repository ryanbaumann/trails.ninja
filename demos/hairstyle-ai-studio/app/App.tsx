import React, { useEffect, useRef, useState } from 'react';
import { ThemeToggle } from './components/ThemeToggle';
import { StepUpload } from './components/StepUpload';
import { StepStyle } from './components/StepStyle';
import { StepResult } from './components/StepResult';
import { SalonBriefModal } from './components/SalonBriefModal';
import { LoadingView } from './components/LoadingView';
import { useAppFlow } from './hooks/useAppFlow';
import { Sparkles, Scissors, ShieldCheck, ChevronRight, KeyRound, Code2, ArrowUpRight } from 'lucide-react';

const FIELDWORK_URL = 'https://ryanbaumann.dev/';
const SOURCE_URL = 'https://github.com/ryanbaumann/fieldwork/tree/main/demos/hairstyle-ai-studio';

export const App = () => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const {
    state,
    setState,
    apiKey,
    hasKey,
    handleSelectKey,
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
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState('');

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

  if (!hasKey) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4">
        <form
          className="max-w-md w-full bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800"
          onSubmit={(event) => {
            event.preventDefault();
            if (!handleSelectKey(keyInput)) {
              setKeyError('Enter a valid Gemini API key.');
              return;
            }
            setKeyInput('');
            setKeyError('');
          }}
        >
          <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <KeyRound className="text-primary-600 dark:text-primary-400" size={30} />
          </div>
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-600 dark:text-primary-400 mb-2">Bring your own Gemini key</p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Try a new look privately</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Your key stays in this tab's memory, passes transiently through Fieldwork's rate-limited proxy, and is never stored or sent to analytics.
            </p>
          </div>
          <label htmlFor="gemini-api-key" className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">
            Gemini API key
          </label>
          <input
            id="gemini-api-key"
            type="password"
            value={keyInput}
            onChange={(event) => {
              setKeyInput(event.target.value);
              setKeyError('');
            }}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="key-help key-error"
            className="w-full min-h-12 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 font-mono text-sm text-slate-900 dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            placeholder="Paste your key"
          />
          <p id="key-help" className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Need one? Create a key in <a className="font-bold text-primary-600 dark:text-primary-400 underline underline-offset-2" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>.
          </p>
          <button
            type="submit"
            className="mt-5 min-h-12 w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-primary-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            Enter the studio
          </button>
          <p id="key-error" role="alert" className="min-h-5 mt-2 text-center text-xs font-semibold text-red-600 dark:text-red-400">{keyError}</p>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
            Photos are sent to Google Gemini only when you request analysis or generation. See <a className="underline underline-offset-2" href="/privacy/">Fieldwork privacy</a>.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-xs font-bold text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <a className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" href={FIELDWORK_URL}>
              Explore Ryan's Fieldwork <ArrowUpRight size={14} aria-hidden="true" />
            </a>
            <a className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
              <Code2 size={14} aria-hidden="true" /> View source
            </a>
          </div>
        </form>
      </div>
    );
  }

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
              onClick={() => {
                handleSelectKey('');
                window.location.reload();
              }}
              className="min-h-11 rounded-lg px-3 text-xs font-bold text-slate-500 hover:text-primary dark:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="Forget Gemini API key"
            >
              Forget key
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
          {state.errorMessage && (
            <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800 shadow-sm dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-250">
              <ShieldCheck size={18} className="mt-0.5 shrink-0" />
              <div className="flex-1 text-xs">
                <p className="font-bold">Error detail</p>
                <p>{state.errorMessage}</p>
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
    </div>
  );
};
