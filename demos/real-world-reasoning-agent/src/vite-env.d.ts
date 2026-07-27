/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GMP_API_KEY: string;
  readonly VITE_GMP_MAP_ID?: string;
  readonly VITE_ANALYTICS_MEASUREMENT_ID?: string;
  readonly VITE_GEMINI_CHAT_MODEL?: string;
  readonly VITE_GEMINI_IMAGE_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Google Maps invokes this global when the browser key is missing, invalid,
// or blocked by the HTTP-referrer restriction. See src/App.tsx / src/shell/MapErrorNotice.tsx.
interface Window {
  gm_authFailure?: () => void;
}

// Google Maps web components used imperatively (CF8): declare them for JSX/TSX.
declare namespace JSX {
  interface IntrinsicElements {
    'gmp-place-contextual': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement>,
      HTMLElement
    > & { children?: React.ReactNode };
    'gmp-place-contextual-list-config': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement>,
      HTMLElement
    > & { layout?: string; 'map-mode'?: string };
  }
}
