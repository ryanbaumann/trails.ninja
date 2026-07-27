import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { installAnalytics } from '../../shared/analytics.mjs';
import './index.css';

installAnalytics(import.meta.env.VITE_ANALYTICS_MEASUREMENT_ID);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
