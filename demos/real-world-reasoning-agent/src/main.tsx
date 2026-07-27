import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// @ts-expect-error Shared zero-build helper intentionally has no declaration file.
import { installAnalytics } from '../../shared/analytics.mjs';
import './styles/global.css';

installAnalytics(import.meta.env.VITE_ANALYTICS_MEASUREMENT_ID);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
