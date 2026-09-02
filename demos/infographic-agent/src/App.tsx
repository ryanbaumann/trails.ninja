import React, { useState } from 'react';
import {
  VisualMode,
  AspectRatio,
  ImageModelOption,
  InfographicAnalysis,
  HistoryItem,
} from './types.ts';
import { prepareInfographic, renderInfographic, RateLimitError, GeminiApiError } from './services/api.ts';
import { Header } from './components/Header.tsx';
import { GeminiKeyDialog } from './components/GeminiKeyDialog.tsx';
import { TopicInput } from './components/TopicInput.tsx';
import { ResearchPlanView } from './components/ResearchPlanView.tsx';
import { ResultView } from './components/ResultView.tsx';
import { RefineSection } from './components/RefineSection.tsx';
import { AlertCircle, History, Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isKeyDialogOpen, setIsKeyDialogOpen] = useState(false);

  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<VisualMode>('data-story');
  const [aspect, setAspect] = useState<AspectRatio>('16:9');
  const [imageModel, setImageModel] = useState<ImageModelOption>('gemini-3.1-flash-lite-image');
  const [instructions, setInstructions] = useState('');

  // Workflow states
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [currentAnalysis, setCurrentAnalysis] = useState<InfographicAnalysis | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [currentRenderModel, setCurrentRenderModel] = useState<string>('gemini-3.1-flash-lite-image');

  // Session history
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const handleGenerate = async () => {
    if (!topic.trim()) return;

    setErrorMessage(null);
    setIsPlanning(true);
    setStep(2);

    try {
      // Step 1: Research & Plan with Gemini 3.8 Flash
      const planRes = await prepareInfographic({
        topic: topic.trim(),
        mode,
        aspect,
        instructions: instructions.trim() || undefined,
        apiKey,
      });

      setCurrentAnalysis(planRes.analysis);
      setCurrentPrompt(planRes.prompt);
      setIsPlanning(false);

      // Step 2: Render with Gemini Image Model
      setIsRendering(true);
      setStep(3);

      const renderRes = await renderInfographic({
        prompt: planRes.prompt,
        mode,
        aspect,
        imageModel,
        apiKey,
      });

      setCurrentImage(renderRes.image);
      setCurrentRenderModel(renderRes.model);

      const newItem: HistoryItem = {
        id: `info-${Date.now()}`,
        timestamp: Date.now(),
        topic: topic.trim(),
        mode,
        aspect,
        prompt: planRes.prompt,
        analysis: planRes.analysis,
        imageUrl: renderRes.image,
        model: renderRes.model,
      };
      setHistory((prev) => [newItem, ...prev]);
    } catch (err) {
      if (
        err instanceof RateLimitError ||
        (err instanceof GeminiApiError &&
          (err.statusCode === 429 ||
            err.statusCode === 503 ||
            err.code === 'FREE_TIER_UNAVAILABLE' ||
            err.code === 'FREE_TIER_EXHAUSTED' ||
            err.code === 'RATE_LIMITED' ||
            err.code === 'GEMINI_QUOTA_EXHAUSTED'))
      ) {
        setErrorMessage(err.message || 'Free hosted tier rate limit reached. Connect your Gemini API key to continue.');
        // Automatically open the BYOK dialog as per requirements
        setIsKeyDialogOpen(true);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred while generating the infographic.');
      }
      setStep(1);
    } finally {
      setIsPlanning(false);
      setIsRendering(false);
    }
  };

  const handleRefine = async (instruction: string) => {
    if (!currentImage || !currentPrompt) return;

    setErrorMessage(null);
    setIsRendering(true);

    try {
      const renderRes = await renderInfographic({
        prompt: currentPrompt,
        mode,
        aspect,
        imageModel,
        previousImageBase64: currentImage,
        editInstruction: instruction,
        apiKey,
      });

      setCurrentImage(renderRes.image);
      setCurrentRenderModel(renderRes.model);

      const refinedItem: HistoryItem = {
        id: `info-${Date.now()}`,
        timestamp: Date.now(),
        topic: `${topic} (Refined: ${instruction})`,
        mode,
        aspect,
        prompt: currentPrompt,
        analysis: currentAnalysis || {},
        imageUrl: renderRes.image,
        model: renderRes.model,
      };
      setHistory((prev) => [refinedItem, ...prev]);
    } catch (err) {
      if (
        err instanceof RateLimitError ||
        (err instanceof GeminiApiError &&
          (err.statusCode === 429 ||
            err.statusCode === 503 ||
            err.code === 'FREE_TIER_UNAVAILABLE' ||
            err.code === 'FREE_TIER_EXHAUSTED' ||
            err.code === 'RATE_LIMITED' ||
            err.code === 'GEMINI_QUOTA_EXHAUSTED'))
      ) {
        setErrorMessage(err.message || 'Rate limit reached. Connect your Gemini API key.');
        setIsKeyDialogOpen(true);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to refine infographic.');
      }
    } finally {
      setIsRendering(false);
    }
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setTopic(item.topic);
    setMode(item.mode);
    setAspect(item.aspect);
    setCurrentPrompt(item.prompt);
    setCurrentAnalysis(item.analysis);
    setCurrentImage(item.imageUrl);
    setCurrentRenderModel(item.model);
    setStep(3);
  };

  return (
    <div className="app-container">
      <Header apiKey={apiKey} onOpenKeyDialog={() => setIsKeyDialogOpen(true)} />

      <main className="main-content">
        {errorMessage && (
          <div className="alert-banner error" role="alert">
            <div>
              <div className="alert-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} />
                <span>Notice</span>
              </div>
              <div className="alert-body">{errorMessage}</div>
            </div>
            {!apiKey && (
              <button
                type="button"
                className="alert-action-btn"
                onClick={() => setIsKeyDialogOpen(true)}
              >
                Add Your API Key
              </button>
            )}
          </div>
        )}

        <div className="stepper-container">
          <div className={`step-item ${step >= 1 ? (step === 1 ? 'active' : 'complete') : ''}`}>
            <span className="step-number">1</span>
            <span>Configure & Topic</span>
          </div>
          <div className={`step-item ${step >= 2 ? (step === 2 ? 'active' : 'complete') : ''}`}>
            <span className="step-number">2</span>
            <span>Gemini 3.8 Flash Research</span>
          </div>
          <div className={`step-item ${step === 3 ? 'complete' : ''}`}>
            <span className="step-number">3</span>
            <span>Rendered Infographic</span>
          </div>
        </div>

        <div className="studio-grid">
          <div>
            <TopicInput
              topic={topic}
              setTopic={setTopic}
              mode={mode}
              setMode={setMode}
              aspect={aspect}
              setAspect={setAspect}
              imageModel={imageModel}
              setImageModel={setImageModel}
              instructions={instructions}
              setInstructions={setInstructions}
              onSubmit={handleGenerate}
              isLoading={isPlanning || isRendering}
            />

            {history.length > 0 && (
              <div className="panel-card" style={{ marginTop: '1.5rem' }}>
                <div className="panel-title" style={{ fontSize: '0.875rem' }}>
                  <History size={15} />
                  <span>Session History ({history.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {history.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="mode-btn"
                      onClick={() => handleSelectHistory(item)}
                      style={{ width: '100%' }}
                    >
                      <span className="mode-name">{item.topic.slice(0, 48)}...</span>
                      <span className="mode-desc">{new Date(item.timestamp).toLocaleTimeString()} • {item.mode} • {item.aspect}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            {isPlanning && (
              <div className="panel-card loading-box">
                <div className="spinner" />
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Synthesizing Visual Knowledge
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.35rem', maxWidth: '380px' }}>
                  Gemini 3.8 Flash is analyzing data points, structuring layout hierarchy, and crafting the exact spatial prompt...
                </p>
              </div>
            )}

            {isRendering && (
              <div className="panel-card loading-box">
                <div className="spinner" />
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Rendering Professional Infographic
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.35rem', maxWidth: '380px' }}>
                  {imageModel === 'gemini-3.1-flash-lite-image' ? 'Gemini 3.1 Flash Lite Image' : 'Gemini 3.1 Flash Image'} is painting high-density typography, charts, and graphics...
                </p>
              </div>
            )}

            {!isPlanning && !isRendering && currentImage && (
              <>
                <ResultView
                  imageUrl={currentImage}
                  topic={topic}
                  mode={mode}
                  aspect={aspect}
                  model={currentRenderModel}
                />

                {currentAnalysis && currentPrompt && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <ResearchPlanView analysis={currentAnalysis} prompt={currentPrompt} />
                  </div>
                )}

                <RefineSection onRefine={handleRefine} isRefining={isRendering} />
              </>
            )}

            {!isPlanning && !isRendering && !currentImage && (
              <div className="panel-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
                <Sparkles size={32} color="#3b82f6" style={{ margin: '0 auto 1rem', opacity: 0.8 }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Ready to Architect Your Infographic
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto' }}>
                  Enter any complex research topic or raw text on the left. The agent pairs Gemini 3.8 Flash research intelligence with Gemini 3.1 Flash image rendering to generate publication-grade visual posters.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <GeminiKeyDialog
        open={isKeyDialogOpen}
        onClose={() => setIsKeyDialogOpen(false)}
        apiKey={apiKey}
        onSaveKey={setApiKey}
      />
    </div>
  );
};
