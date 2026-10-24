import { useEffect } from 'react';
import { installFlashFeedback } from './app/feedbackUi';
import { installTraining } from './app/training';
import { installCaller } from './caller';
import { useSettings } from './store/settings';
import { Flash } from './ui/components/Flash';
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
  const onboarded = useSettings((s) => s.onboarded);

  useEffect(() => installFlashFeedback(), []);
  useEffect(() => installCaller(), []);
  useEffect(() => installTraining(), []);
  useEffect(() => {
    if (!onboarded && route === 'setup') navigate('onboarding');
  }, [onboarded, route]);

  return (
    <div className="app">
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
