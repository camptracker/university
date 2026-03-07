/**
 * StreamingText — renders markdown with word-by-word fade-in.
 *
 * Buffers incoming text and reveals one word every 20ms.
 * Uses custom ReactMarkdown components to wrap each newly-revealed
 * word in a <span> with a CSS fade animation.
 */
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  text: string;
  className?: string;
}

export default function StreamingText({ text, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleText, setVisibleText] = useState('');
  const bufferRef = useRef('');
  const revealedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { bufferRef.current = text; }, [text]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      const allTokens = bufferRef.current.split(/(\s+)/);
      const revealed = revealedRef.current;
      if (revealed < allTokens.length) {
        revealedRef.current = revealed + 1;
        setVisibleText(allTokens.slice(0, revealed + 1).join(''));
      }
    }, 30);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [visibleText]);

  return (
    <div ref={containerRef} className={`streaming lesson-content ${className || ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{visibleText}</ReactMarkdown>
    </div>
  );
}
