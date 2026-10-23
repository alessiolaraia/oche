import { useEffect } from 'react';
import { useSession } from '../../store/session';

export function Flash() {
  const flash = useSession((s) => s.flash);
  const clear = useSession((s) => s.clearFlash);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(clear, 950);
    return () => clearTimeout(t);
  }, [flash, clear]);
  if (!flash) return null;
  return (
    <div className="flash" data-kind={flash.kind} key={flash.id} role="status" aria-live="assertive">
      <span className="flash-text">{flash.text}</span>
    </div>
  );
}
