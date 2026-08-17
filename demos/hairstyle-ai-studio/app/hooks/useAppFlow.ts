import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, GeneratedImage, ViewType } from '../types';
import {
  generateHairstyleImage,
  refineHairstyleImage,
  getFreeTierStatus,
  validateGeminiKey,
  FreeTierStatus,
  GeminiApiError,
  RateLimitError,
} from '../services/geminiService';
import { saveImage, getImage, clearAllImages, deleteImage } from '../services/imageStorage';
import { trackEvent } from '../services/analytics';

const titleFromPrompt = (prompt: string) =>
  prompt.split(/\s+/).filter(Boolean).slice(0, 4).join(' ').replace(/[.,;:!?-]+$/, '') || 'New Hairstyle';

const describeError = (error: unknown, fallback: string): string => {
  if (error instanceof GeminiApiError) {
    if (error.code === 'FREE_TIER_EXHAUSTED') {
      return "You've used today's 5 free generations. Add your Gemini API key to keep creating.";
    }
    if (error.code === 'FREE_TIER_UNAVAILABLE') {
      return 'The shared allowance is temporarily unavailable. Add your Gemini API key to continue.';
    }
    if (error.code === 'GEMINI_QUOTA_EXHAUSTED') {
      return 'Your Gemini API key has reached its provider quota. Check its quota or connect another key.';
    }
    if (error.code === 'SITE_ABUSE_LIMIT') {
      return 'Too many requests in a short period. Wait a moment, then try again.';
    }
    return error.message;
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Generation cancelled or timed out. You can try again when ready.';
  }
  return fallback;
};

export const useAppFlow = (scrollContainerRef?: React.RefObject<HTMLElement | null>) => {
  const [apiKey, setApiKey] = useState('');
  const [freeTier, setFreeTier] = useState<FreeTierStatus | null>(null);
  const [isKeyDialogRequested, setIsKeyDialogRequested] = useState(false);
  const [state, setState] = useState<AppState>({
    step: 'upload',
    images: { front: null, side: null, back: null },
    selectedStyle: '',
    customPrompt: '',
    styleReferenceImage: null,
    styleReferenceUrl: null,
    generatedResult: null,
    history: [],
    theme: 'light',
    isSalonBriefOpen: false,
    generationMode: 'fast',
    outputLayout: 'single',
    errorMessage: null,
  });

  const [isRefining, setIsRefining] = useState(false);
  const [refinementPrompt, setRefinementPrompt] = useState("");

  // Holds the in-flight generation/refinement so the user can cancel it.
  const abortRef = useRef<AbortController | null>(null);

  const handleSelectKey = async (value: string) => {
    const nextKey = value.trim();
    if (!/^[\x21-\x7E]{20,200}$/.test(nextKey)) return false;
    const valid = await validateGeminiKey(nextKey);
    if (!valid) return false;
    setApiKey(nextKey);
    setIsKeyDialogRequested(false);
    setState(prev => ({ ...prev, errorMessage: null }));
    trackEvent('key_setup', { result: 'validated' });
    return true;
  };

  const forgetApiKey = useCallback(() => {
    setApiKey('');
    setIsKeyDialogRequested(false);
    trackEvent('key_setup', { result: 'disconnected' });
  }, []);

  const refreshFreeTier = useCallback(async () => {
    try {
      setFreeTier(await getFreeTierStatus());
    } catch {
      setFreeTier(null);
    }
  }, []);

  useEffect(() => {
    void refreshFreeTier();
  }, [refreshFreeTier]);

  // Persistence: Load History
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const saved = localStorage.getItem('hairstyle_history');
        if (saved) {
          const parsed: GeneratedImage[] = JSON.parse(saved);
          // Hydrate images from IndexedDB
          const hydratedHistory = await Promise.all(parsed.map(async (item) => {
            if (!item.url.startsWith('data:')) {
              const savedImage = await getImage(item.id);
              if (savedImage) {
                return { ...item, url: savedImage };
              }
            }
            return item;
          }));
          setState(prev => ({ ...prev, history: hydratedHistory }));
        }
      } catch (e) {
        console.error("Failed to load history", e);
      }
    };
    loadHistory();
  }, []);

  // Persistence: Save History Metadata
  useEffect(() => {
    if (state.history.length > 0) {
      const metadataOnly = state.history.map(item => ({
        ...item,
        url: item.id // Use ID as placeholder
      }));
      localStorage.setItem('hairstyle_history', JSON.stringify(metadataOnly));
    } else {
      localStorage.removeItem('hairstyle_history');
    }
  }, [state.history]);

  // Scroll to top on step change
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollContainerRef?.current?.scrollTo({
      top: 0,
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }, [scrollContainerRef, state.step]);

  // Actions
  const updateImages = useCallback((view: ViewType, base64: string) => {
    setState(prev => ({
      ...prev,
      images: { ...prev.images, [view]: base64 }
    }));
  }, []);

  const clearImage = useCallback((view: ViewType) => {
    setState(prev => ({
      ...prev,
      images: { ...prev.images, [view]: null }
    }));
  }, []);

  const handleGenerate = async (styleOverride?: string) => {
    if (!state.images.front) return;
    setState(prev => ({ ...prev, step: 'generating', errorMessage: null }));

    const promptToUse = styleOverride || state.selectedStyle || state.customPrompt;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Generate the title in parallel with the single image pass.
      trackEvent('generation_start', { layout: state.outputLayout, mode: state.generationMode });
      const imageUrl = await generateHairstyleImage(
        apiKey,
        state.images,
        promptToUse,
        state.styleReferenceImage,
        state.styleReferenceUrl,
        state.generationMode,
        state.outputLayout,
        controller.signal
      );

      const title = titleFromPrompt(promptToUse);
      const targetId = Date.now().toString();

      const newResult: GeneratedImage = {
        id: targetId,
        url: imageUrl,
        prompt: promptToUse,
        title: title,
        timestamp: Date.now(),
        generationMode: state.generationMode,
        outputLayout: state.outputLayout,
      };

      await saveImage(targetId, imageUrl);
      if (!apiKey) await refreshFreeTier();
      trackEvent('generation_success', { layout: state.outputLayout, mode: state.generationMode });

      setState(prev => ({
        ...prev,
        step: 'result',
        generatedResult: newResult,
        history: [newResult, ...prev.history]
      }));
    } catch (error) {
      console.error(error);
      trackEvent('generation_failure', { rate_limited: error instanceof RateLimitError });
      setState(prev => ({
        ...prev,
        step: 'style',
        errorMessage: describeError(error, 'Generation failed. Please check your image inputs and network, then try again.'),
      }));
      if (
        error instanceof RateLimitError ||
        (error instanceof GeminiApiError && (
          error.code === 'RATE_LIMITED' ||
          error.code === 'FREE_TIER_EXHAUSTED' ||
          error.code === 'FREE_TIER_UNAVAILABLE' ||
          error.code === 'RESOURCE_EXHAUSTED' ||
          error.code === 'GEMINI_QUOTA_EXHAUSTED' ||
          error.code === '429'
        ))
      ) {
        setIsKeyDialogRequested(true);
        void refreshFreeTier();
      }
    } finally {
      abortRef.current = null;
    }
  };

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort();
    trackEvent('generation_cancel');
  }, []);

  const handleRefine = async (instruction: string, refImage: string | null = null, refUrl: string | null = null) => {
    if (!state.generatedResult) return;
    setIsRefining(true);
    setRefinementPrompt(instruction);
    setState(prev => ({ ...prev, errorMessage: null }));

    const targetId = Date.now().toString();
    const currentUrlForRefinement = state.generatedResult.url;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      trackEvent('refinement_start', { layout: state.outputLayout, mode: state.generationMode });
      const imageUrl = await refineHairstyleImage(
        apiKey,
        currentUrlForRefinement,
        instruction,
        refImage,
        refUrl,
        state.generationMode,
        state.outputLayout,
        controller.signal
      );

      const title = titleFromPrompt(instruction);

      const newResult: GeneratedImage = {
        id: targetId,
        url: imageUrl,
        prompt: instruction,
        title: title,
        timestamp: Date.now(),
        generationMode: state.generationMode,
        outputLayout: state.outputLayout,
      };

      await saveImage(targetId, imageUrl);
      if (!apiKey) await refreshFreeTier();
      trackEvent('refinement_success', { layout: state.outputLayout, mode: state.generationMode });

      setState(prev => ({
        ...prev,
        generatedResult: newResult,
        history: [newResult, ...prev.history]
      }));
    } catch (error) {
      console.error(error);
      trackEvent('refinement_failure', { rate_limited: error instanceof RateLimitError });
      setState(prev => ({
        ...prev,
        errorMessage: describeError(error, 'Refinement failed. Try a simpler instruction or a different reference image.'),
      }));
      if (
        error instanceof RateLimitError ||
        (error instanceof GeminiApiError && (
          error.code === 'RATE_LIMITED' ||
          error.code === 'FREE_TIER_EXHAUSTED' ||
          error.code === 'FREE_TIER_UNAVAILABLE' ||
          error.code === 'RESOURCE_EXHAUSTED' ||
          error.code === 'GEMINI_QUOTA_EXHAUSTED' ||
          error.code === '429'
        ))
      ) {
        setIsKeyDialogRequested(true);
        void refreshFreeTier();
      }
    } finally {
      setIsRefining(false);
      abortRef.current = null;
    }
  };

  const handleDeleteHistoryItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteImage(id);
    setState(prev => {
      const newHistory = prev.history.filter(item => item.id !== id);
      let newGeneratedResult = prev.generatedResult;
      if (prev.generatedResult?.id === id) {
        newGeneratedResult = newHistory.length > 0 ? newHistory[0] : null;
      }
      return {
        ...prev,
        history: newHistory,
        generatedResult: newGeneratedResult,
        step: newHistory.length > 0 ? prev.step : 'upload'
      };
    });
  };

  const handleClearHistory = async () => {
    await clearAllImages();
    localStorage.removeItem('hairstyle_history');
    setState(prev => ({ ...prev, history: [], generatedResult: null, step: 'upload' }));
  };

  const navigateTo = (target: 'upload' | 'style' | 'result') => {
    if (state.step === 'generating') return;

    const canGoToUpload = true;
    const canGoToStyle = !!state.images.front || state.history.length > 0;
    const canGoToResult = !!state.generatedResult;

    if (target === 'upload' && canGoToUpload) {
      setState(prev => ({ ...prev, step: 'upload' }));
    } else if (target === 'style' && canGoToStyle) {
      setState(prev => ({ ...prev, step: 'style' }));
    } else if (target === 'result' && canGoToResult) {
      setState(prev => ({ ...prev, step: 'result' }));
    }
  };

  return {
    state,
    setState,
    apiKey,
    hasKey: Boolean(apiKey),
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
  };
};
