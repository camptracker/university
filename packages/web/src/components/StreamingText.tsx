/**
 * StreamingText — renders markdown with word-by-word fade-in.
 *
 * Buffers incoming text and reveals one word every 20ms.
 * Uses custom ReactMarkdown components to wrap each newly-revealed
 * word in a <span> with a CSS fade animation.
 */
import { useState, useEffect, useRef, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  text: string;
  className?: string;
}

export default function StreamingText({ text, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleText, setVisibleText] = useState('');
  const [visibleWordCount, setVisibleWordCount] = useState(0);
  const prevWordCountRef = useRef(0);
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
        const newText = allTokens.slice(0, revealed + 1).join('');
        setVisibleText(newText);
        // Count actual words (non-whitespace tokens)
        setVisibleWordCount(newText.split(/\s+/).filter(Boolean).length);
      }
    }, 30);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [visibleText]);

  // Track previous word count for fade-in detection
  const prevCount = prevWordCountRef.current;
  useEffect(() => {
    prevWordCountRef.current = visibleWordCount;
  }, [visibleWordCount]);

  // Word counter — mutable ref reset each render
  const counterRef = useRef(0);
  counterRef.current = 0;

  function splitTextIntoWordSpans(text: string): ReactNode[] {
    return text.split(/(\s+)/).map((token, i) => {
      if (/^\s+$/.test(token)) return token;
      const idx = counterRef.current++;
      const isNew = idx >= prevCount;
      return (
        <span
          key={`${idx}-${i}`}
          className={isNew ? 'stream-word' : undefined}
        >{token}</span>
      );
    });
  }

  function processChildren(children: ReactNode): ReactNode {
    if (typeof children === 'string') return splitTextIntoWordSpans(children);
    if (Array.isArray(children)) return children.map((child, i) => (
      <span key={i}>{processChildren(child)}</span>
    ));
    return children;
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const components: Record<string, React.FC<any>> = {
    p: ({ children, ...props }: any) => <p {...props}>{processChildren(children)}</p>,
    li: ({ children, ...props }: any) => <li {...props}>{processChildren(children)}</li>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{processChildren(children)}</h1>,
    h2: ({ children, ...props }: any) => <h2 {...props}>{processChildren(children)}</h2>,
    h3: ({ children, ...props }: any) => <h3 {...props}>{processChildren(children)}</h3>,
    h4: ({ children, ...props }: any) => <h4 {...props}>{processChildren(children)}</h4>,
    em: ({ children, ...props }: any) => <em {...props}>{processChildren(children)}</em>,
    strong: ({ children, ...props }: any) => <strong {...props}>{processChildren(children)}</strong>,
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <div ref={containerRef} className={`lesson-content ${className || ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {visibleText}
      </ReactMarkdown>
    </div>
  );
}
