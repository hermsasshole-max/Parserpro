import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { checkAndRequestStartupPermissions } from './utils/nativePermissions';
import './index.css';

// Immediately trigger Capacitor Permissions on Android app startup
// Prompts native OS dialogs upfront before the user attempts to scan a receipt
checkAndRequestStartupPermissions().catch((err) => {
  console.warn('[main.tsx] Startup permission prompt note:', err);
});

// Register Service Worker for PWA installability on Android & mobile browsers
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      console.log('SW registration note:', err);
    });
  });
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}


