import { useEffect } from 'react';
import { installFlashFeedback } from './app/feedbackUi';
import { installTraining } from './app/training';
import { installCaller } from './caller';
import { useMatch } from './store/match';
import { useSession } from './store/session';
import { useSettings } from './store/settings';
import { useTraining } from './store/training';
import { Flash } from './ui/components/Flash';
import { MatchIntro } from './ui/components/MatchIntro';
import { TriggerRing } from './ui/components/TriggerRing';
import { navigate, useRoute } from './ui/router';
import { Debug } from './ui/screens/Debug';
import { Eval } from './ui/screens/Eval';
import { Game } from './ui/screens/Game';
import { Onboarding } from './ui/screens/Onboarding';
import { Settings } from './ui/screens/Settings';
import { Setup } from './ui/screens/Setup';
import { Stats } from './ui/screens/Stats';
import { Training } from './ui/screens/Training';
import { startVoice, stopVoice } from './voice/control';
import './ui/styles.css';

export function App() {
  const route = useRoute();
  const onboarded = useSettings((s) => s.onboarded);
  const intro = useSession((s) => s.intro);

  useEffect(() => installFlashFeedback(), []);
  useEffect(() => installCaller(), []);
  useEffect(() => installTraining(), []);
  useEffect(() => {
    if (!onboarded && route === 'setup') navigate('onboarding');
  }, [onboarded, route]);

  // Mikro nur im Spiel (inkl. „Around the Clock“, das im Trainings-Bildschirm läuft): beim Verlassen aus,
  // beim Zurückkehren wieder an. Einstellungen/Einrichtung starten ihren Mikro-Test selbst nach dem Wechsel.
  const atc = useTraining((t) => t.mode === 'atc');
  const inGame = route === 'game' || (route === 'training' && atc);
  useEffect(() => {
    if (!inGame) {
      stopVoice();
      return;
    }
    const running = route !== 'game' || useMatch.getState().state?.winner === null;
    if (running && useSettings.getState().voice.enabled) void startVoice();
  }, [inGame, route]);

  // Statusleiste passend zur dunklen Arena im Spiel
  useEffect(() => {
    const dark = route === 'game';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0B0B0D' : '#F3F0EC');
  }, [route]);

  // App im Hintergrund: Mikro sofort freigeben
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') stopVoice();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, []);

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
        {route === 'eval' && <Eval />}
      </main>
      {intro && route === 'game' && <MatchIntro />}
      <TriggerRing />
      <Flash />
    </div>
  );
}
