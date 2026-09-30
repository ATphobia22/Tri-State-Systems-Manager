/**
 * BackgroundMusic — persistent background-music player for the operator's own
 * tracks. Rendered once in RootLayout so playback continues across routes.
 *
 * Browser autoplay policy forbids starting audio without a user gesture, so
 * the player always mounts paused; the operator taps play once and the
 * playlist then advances on its own. Track position is restored from
 * localStorage, but playback itself is never auto-resumed.
 *
 * Tracks are original works written by Anthony Tucker, vendored under
 * public/audio/.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../lib/design-tokens';

interface Track {
  file: string;
  title: string;
}

const TRACKS: Track[] = [
  { file: 'monster-down.mp3', title: 'Monster Down' },
  { file: 'get-it-out-the-mud.mp3', title: 'Get It Out The Mud' },
  { file: 'dadhuntin2.mp3', title: 'Dad Huntin 2' },
];

const STORAGE_KEY = 'tsm-bgm-track-index';

function readStoredIndex(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const idx = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isInteger(idx) && idx >= 0 && idx < TRACKS.length ? idx : 0;
  } catch {
    return 0;
  }
}

export default function BackgroundMusic(): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [trackIndex, setTrackIndex] = useState<number>(() => readStoredIndex());
  const [playing, setPlaying] = useState(false);

  const track = TRACKS[trackIndex];

  const playIndex = useCallback((idx: number, autoplay: boolean) => {
    const el = audioRef.current;
    if (!el) return;
    const next = ((idx % TRACKS.length) + TRACKS.length) % TRACKS.length;
    setTrackIndex(next);
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* storage unavailable */ }
    el.src = `${import.meta.env.BASE_URL}audio/${TRACKS[next].file}`;
    if (autoplay) {
      void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }, []);

  // Advance automatically when a track ends.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = (): void => playIndex(trackIndex + 1, true);
    el.addEventListener('ended', onEnded);
    return () => el.removeEventListener('ended', onEnded);
  }, [trackIndex, playIndex]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      if (!el.src) el.src = `${import.meta.env.BASE_URL}audio/${track.file}`;
      void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }, [playing, track.file]);

  const btn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 44, minHeight: 44, padding: '0.4rem 0.55rem',
    background: 'transparent', border: 'none', borderRadius: t.radius.sm,
    color: t.color.text.body, fontSize: '1.1rem', cursor: 'pointer',
  };

  return (
    <div
      role="region"
      aria-label="Background music"
      style={{
        position: 'fixed', right: '0.75rem', bottom: '0.75rem', zIndex: 150,
        display: 'flex', alignItems: 'center', gap: '0.15rem',
        background: t.color.surface.deep, border: `1px solid ${t.color.surface.card}`,
        borderRadius: t.radius.md, padding: '0.2rem 0.35rem',
        boxShadow: '0 4px 16px rgba(0,0,0,0.45)', maxWidth: 'calc(100vw - 1.5rem)',
      }}
    >
      <audio ref={audioRef} preload="none" aria-hidden="true" />
      <button type="button" style={btn} aria-label="Previous track" onClick={() => playIndex(trackIndex - 1, playing)}>⏮</button>
      <button type="button" style={btn} aria-label={playing ? 'Pause background music' : 'Play background music'} aria-pressed={playing} onClick={toggle}>
        {playing ? '⏸' : '▶'}
      </button>
      <button type="button" style={btn} aria-label="Next track" onClick={() => playIndex(trackIndex + 1, playing)}>⏭</button>
      <div style={{ padding: '0 0.4rem', minWidth: 0 }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: t.color.text.body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '11rem' }} title={track.title}>
          {playing ? '♪ ' : ''}{track.title}
        </div>
        <div style={{ fontSize: '0.6rem', color: t.color.text.secondary, whiteSpace: 'nowrap' }}>Anthony Tucker</div>
      </div>
    </div>
  );
}
