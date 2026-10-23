import '@fontsource-variable/big-shoulders-display';
import '@fontsource/barlow/latin-400';
import '@fontsource/barlow/latin-600';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useMatch } from './store/match';

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
