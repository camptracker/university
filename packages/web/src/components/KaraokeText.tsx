/**
 * KaraokeText component — word-by-word text highlighting synced to audio playback.
 *
 * Props:
 * - text: string — markdown fallback content (rendered when timestamps unavailable)
 * - audioRef: RefObject<HTMLAudioElement> — audio element to track
 * - isPlaying: boolean — drives the animation frame loop
 * - timestampsUrl: string — URL to a JSON array of {word, start, end} (Whisper format)
 *
 * Behavior:
 * - Fetches timestamps from timestampsUrl on mount/url change
 * - Falls back to ReactMarkdown rendering if timestamps fail to load
 * - Uses requestAnimationFrame to track audio currentTime and highlight the active word
 * - Groups words into paragraphs on sentence-ending punctuation + gaps > 0.8s
 * - Words get CSS classes: 'karaoke-word', 'spoken' (already said), 'active' (current)
 *
 * NOTE: This component is not currently wired to any page in the app.
 */
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

interface Props {
  text: string;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  timestampsUrl: string;
}

export default function KaraokeText({ text, audioRef, isPlaying, timestampsUrl }: Props) {
  const [timestamps, setTimestamps] = useState<WordTimestamp[] | null>(null);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const rafRef = useRef<number>(0);

  // Load timestamps
  useEffect(() => {
    setTimestamps(null);
    fetch(timestampsUrl)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (Array.isArray(data)) setTimestamps(data); })
      .catch(() => setTimestamps(null));
  }, [timestampsUrl]);

  // Track audio position via requestAnimationFrame
  useEffect(() => {
    if (!isPlaying || !timestamps || !audioRef.current) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = () => {
      const time = audioRef.current?.currentTime ?? 0;
      let idx = -1;
      for (let i = 0; i < timestamps.length; i++) {
        if (time >= timestamps[i].start) {
          idx = i;
        } else {
          break;
        }
      }
      setActiveWordIndex(idx);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, timestamps, audioRef]);

  // Reset when stopped
  useEffect(() => {
    if (!isPlaying) setActiveWordIndex(-1);
  }, [isPlaying]);

  // No timestamps loaded yet or failed — fall back to markdown
  if (!timestamps) {
    return <ReactMarkdown>{text}</ReactMarkdown>;
  }

  // Render words directly from Whisper timestamps
  // Group into paragraphs by detecting sentence-ending punctuation followed by a pause
  const paragraphs: WordTimestamp[][] = [[]];
  for (let i = 0; i < timestamps.length; i++) {
    paragraphs[paragraphs.length - 1].push(timestamps[i]);
    // Start new paragraph on long pauses (>0.8s gap between words)
    if (i < timestamps.length - 1) {
      const gap = timestamps[i + 1].start - timestamps[i].end;
      const endsWithPeriod = /[.!?]$/.test(timestamps[i].word);
      if (endsWithPeriod && gap > 0.8) {
        paragraphs.push([]);
      }
    }
  }

  return (
    <div className={`karaoke-container${isPlaying ? ' playing' : ''}`}>
      {paragraphs.map((para, pi) => (
        <p key={pi}>
          {para.map((w, wi) => {
            // Find the global index of this word in timestamps
            let globalIdx = 0;
            for (let p = 0; p < pi; p++) globalIdx += paragraphs[p].length;
            globalIdx += wi;

            let className = 'karaoke-word';
            if (activeWordIndex >= 0 && globalIdx <= activeWordIndex) className += ' spoken';
            if (globalIdx === activeWordIndex) className += ' active';

            return <span key={wi} className={className}>{w.word} </span>;
          })}
        </p>
      ))}
    </div>
  );
}
