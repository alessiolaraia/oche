import { useSyncExternalStore } from 'react';

export type Route =
  'setup' | 'game' | 'stats' | 'settings' | 'onboarding' | 'training' | 'cricket' | 'debug' | 'eval';
const ROUTES: readonly Route[] = [
  'setup',
  'game',
  'stats',
  'settings',
  'onboarding',
  'training',
  'cricket',
  'debug',
  'eval',
];

function read(): Route {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0] ?? '';
  return (ROUTES as readonly string[]).includes(h) ? (h as Route) : 'setup';
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, read, () => 'setup');
}

export function navigate(route: Route): void {
  location.hash = `/${route}`;
}
