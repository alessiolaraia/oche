import { useEffect } from 'react';
import { installFlashFeedback } from './app/feedbackUi';
import { installCaller } from './caller';
import { useSettings } from './store/settings';
import { Flash } from './ui/components/Flash';
import { Ring } from './ui/components/Ring';
import { navigate, useRoute } from './ui/router';
import { Debug } from './ui/screens/Debug';
import { Game } from './ui/screens/Game';
import { Onboarding } from './ui/screens/Onboarding';
import { Settings } from './ui/screens/Settings';
import { Setup } from './ui/screens/Setup';
import { Stats } from './ui/screens/Stats';
import { Training } from './ui/screens/Training';
import './ui/styles.css';

export function App() {
  const route = useRoute();
  const theme = useSettings((s) => s.display.theme);
  const onboarded = useSettings((s) => s.onboarded);

  useEffect(() => installFlashFeedback(), []);
  useEffect(() => installCaller(), []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'light' ? '#efe4cc' : '#1a1714');
  }, [theme]);
  useEffect(() => {
    if (!onboarded && route === 'setup') navigate('onboarding');
  }, [onboarded, route]);

  return (
    <div className="app">
      <Ring />
      <main className="app-main" style={{ height: '100%' }}>
        {route === 'setup' && <Setup />}
        {route === 'game' && <Game />}
        {route === 'stats' && <Stats />}
        {route === 'settings' && <Settings />}
        {route === 'onboarding' && <Onboarding />}
        {route === 'training' && <Training />}
        {route === 'debug' && <Debug />}
      </main>
      <Flash />
    </div>
  );
}
