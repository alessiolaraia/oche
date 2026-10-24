import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerSW } from 'virtual:pwa-register';
import { useMatch } from './store/match';

// Service Worker: App-Dateien, Vosk-Worker/WASM und Schriften offline verfügbar; Updates still im Hintergrund
registerSW({ immediate: true });

// Laufendes Match aus IndexedDB laden, bevor gerendert wird – kein Flackern nach Reload.
void useMatch
  .getState()
  .resume()
  .catch(() => false)
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
