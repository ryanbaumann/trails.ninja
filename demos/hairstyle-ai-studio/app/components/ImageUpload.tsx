
import React, { useRef, useState, useEffect } from 'react';
import { X, Camera, Image as ImageIcon, RotateCcw } from 'lucide-react';
import { ViewType } from '../types';
import { processImageFile, downscaleDataUrl, ImageValidationError } from '../utils/image';

interface ImageUploadProps {
  view: ViewType;
  image: string | null;
  onUpload: (view: ViewType, base64: string) => void;
  onClear: (view: ViewType) => void;
  required?: boolean;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ view, image, onUpload, onClear, required }) => {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = `${view}-photo-input`;

  // Stop camera stream cleanup
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setCameraError(null);
  };

  // Start camera effect
  useEffect(() => {
    let mounted = true;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
           throw new Error("Camera API not available. Please ensure you are using HTTPS or localhost.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });

        if (mounted && isCameraOpen) {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // Play is async and can fail if element is removed
            videoRef.current.play().catch(e => console.error("Video play error:", e));
          }
        } else {
          // Clean up if component unmounted or mode changed during load
          stream.getTracks().forEach(track => track.stop());
        }
      } catch (err: any) {
        console.warn("Camera access warning:", err); // Warn instead of Error to avoid frightening the user
        if (mounted) {
          setCameraError(err.message || "Could not access camera. Please check permissions.");
        }
      }
    };

    if (isCameraOpen) {
      startCamera();
    }

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraOpen]);

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      // Match the video dimensions
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Flip horizontally if using front camera to mirror user expectation
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0);

        const base64 = canvas.toDataURL('image/jpeg', 0.9);
        // Downscale the capture to keep the upload payload small.
        downscaleDataUrl(base64).then((processed) => onUpload(view, processed));
        stopCamera();
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const processed = await processImageFile(file);
      onUpload(view, processed);
    } catch (err) {
      setUploadError(err instanceof ImageValidationError ? err.message : 'Could not process that image.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const renderGuidanceOverlay = () => {
    return (
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-40">
        <svg viewBox="0 0 200 200" className="w-full h-full p-8 text-white stroke-2 stroke-current fill-none">
          {view === 'front' && (
             <ellipse cx="100" cy="90" rx="45" ry="60" strokeDasharray="5,5" />
          )}
          {view === 'side' && (
             <path d="M 80,30 Q 130,30 130,90 Q 130,150 90,170" strokeDasharray="5,5" />
          )}
          {view === 'back' && (
             <path d="M 60,170 Q 50,150 50,100 Q 50,30 100,30 Q 150,30 150,100 Q 150,150 140,170" strokeDasharray="5,5" />
          )}
        </svg>
        <div className="absolute bottom-4 left-0 right-0 text-center text-white text-xs font-semibold drop-shadow-md">
           {view === 'front' ? 'Center your face' : view === 'side' ? 'Turn to the side' : 'Turn around'}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3 w-full animate-fadeIn">
      <div className="flex justify-between items-center px-1">
        <label htmlFor={inputId} className="text-sm font-bold text-gray-700 dark:text-gray-200 capitalize flex items-center gap-2">
          {view} View {required && <span className="text-xs text-red-500">(required)</span>}
        </label>
        {image && (
          <button
            onClick={() => onClear(view)}
            className="min-h-11 text-xs text-red-500 hover:text-red-600 flex items-center gap-1 font-medium bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-md transition-colors"
          >
            <X size={12} /> Remove
          </button>
        )}
      </div>

      <div className={`
          relative overflow-hidden transition-all duration-300 aspect-[3/4] w-full
          ${image || isCameraOpen
            ? 'rounded-2xl border-2 border-primary-500 bg-black shadow-primary-500/20 shadow-lg'
            : 'rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-white dark:hover:bg-slate-800'}
        `}>

        {/* State 1: Image Display */}
        {image && (
          <>
            <img
              src={image}
              alt={`${view} view`}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              aria-label={`Remove ${view} photo`}
              className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 focus-visible:opacity-100 flex items-center justify-center transition-opacity cursor-pointer backdrop-blur-sm"
              onClick={() => onClear(view)}
            >
              <span className="text-white font-bold flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full backdrop-blur-md">
                <RotateCcw size={18} /> Reset Photo
              </span>
            </button>
          </>
        )}

        {/* State 2: Camera Active */}
        {!image && isCameraOpen && (
          <div className="relative w-full h-full bg-black">
             {cameraError ? (
               <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                 <p className="text-white text-sm mb-4 bg-red-500/20 p-3 rounded-lg border border-red-500/50">{cameraError}</p>
                 <button onClick={stopCamera} className="min-h-11 px-3 text-white text-sm font-medium hover:underline">Cancel Camera</button>
               </div>
             ) : (
               <>
                 <video
                   ref={videoRef}
                   autoPlay
                   playsInline
                   muted
                   className="w-full h-full object-cover transform -scale-x-100" // Mirror effect
                 />
                 {renderGuidanceOverlay()}
                 <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-6 z-10 pointer-events-auto">
                    <button
                      type="button"
                      aria-label="Close camera"
                      onClick={stopCamera}
                      className="min-h-11 min-w-11 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      <X size={24} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Capture ${view} photo`}
                      onClick={capturePhoto}
                      className="p-1.5 rounded-full border-4 border-white/80 hover:scale-105 hover:border-white transition-all shadow-lg"
                    >
                      <div className="w-14 h-14 bg-white rounded-full"></div>
                    </button>
                    <div className="w-12"></div> {/* Spacer for balance */}
                 </div>
               </>
             )}
          </div>
        )}

        {/* State 3: Empty / Selection Mode */}
        {!image && !isCameraOpen && (
          <div className="flex flex-col items-center justify-center h-full p-4 group cursor-pointer">
             <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
               {view === 'front' ? <Camera className="text-slate-400" size={22} /> : <ImageIcon className="text-slate-400" size={22} />}
             </div>

             <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 text-center">Add {view} Photo</p>
             <p className="text-xs text-slate-400 text-center mb-4">JPG or PNG</p>

             {/* Updated button grid: tighter gap, reduced padding - mimicking reference */}
             <div className="flex gap-2 w-full justify-center opacity-80 group-hover:opacity-100 transition-opacity">
               <button
                 type="button"
                 aria-label={`Use camera for ${view} photo`}
                 onClick={(e) => { e.stopPropagation(); setIsCameraOpen(true); }}
                 className="min-h-11 px-3 py-1.5 text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors w-1/2 text-center"
               >
                  Camera
               </button>

               <button
                 type="button"
                 aria-label={`Upload ${view} photo`}
                 onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                 className="min-h-11 px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors w-1/2 text-center"
               >
                  Upload
               </button>
             </div>
          </div>
        )}

        {/* Hidden Input */}
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {uploadError && (
        <p className="px-1 text-[11px] font-medium text-red-500" role="alert">{uploadError}</p>
      )}
    </div>
  );
};
