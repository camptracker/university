/**
 * ParableRenderer — renders parable markdown with character colors
 *
 * Uses ReactMarkdown custom components to:
 * - Color **character names** in bold
 * - Color *dialogue* in italics with the last mentioned character's color
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMemo, useRef } from 'react';
import { Components } from 'react-markdown';

interface Props {
  text: string;
  characters?: { name: string; color?: string }[];
}

// Default character color mapping
const DEFAULT_COLORS: Record<string, string> = {
  kael: '#4a9eff',      // Blue
  sable: '#b8922e',     // Gold
  tobren: '#8fbc8f',    // Green
  lila: '#e97ba8',      // Pink
  maren: '#9b59b6',     // Purple
};

export default function ParableRenderer({ text, characters = [] }: Props) {
  const lastCharColor = useRef<string>('#d4a843');

  // Build character color map
  const charColors = useMemo(() => {
    const map = new Map<string, string>();
    characters.forEach(c => {
      const lowerName = c.name.toLowerCase();
      map.set(lowerName, c.color || DEFAULT_COLORS[lowerName] || '#d4a843');
    });

    // Also add default colors for known characters
    Object.entries(DEFAULT_COLORS).forEach(([name, color]) => {
      if (!map.has(name)) {
        map.set(name, color);
      }
    });

    return map;
  }, [characters]);

  // Custom markdown components
  const components: Components = useMemo(() => ({
    // Handle bold text (character names)
    strong: ({ children }) => {
      const text = String(children);
      const lowerText = text.toLowerCase();
      
      // Check if this is a character name
      for (const [name, color] of charColors.entries()) {
        if (lowerText === name) {
          lastCharColor.current = color;
          return <strong style={{ color }}>{children}</strong>;
        }
      }
      
      return <strong>{children}</strong>;
    },

    // Handle emphasis (dialogue)
    em: ({ children }) => {
      const text = String(children);
      
      // If it looks like dialogue (starts with quote), use last character's color
      if (text.startsWith('"') || text.startsWith('"')) {
        return <em style={{ color: lastCharColor.current }}>{children}</em>;
      }
      
      return <em>{children}</em>;
    },
  }), [charColors]);

  return (
    <div className="lesson-content parable">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
