/**
 * ParableRenderer — renders parable markdown with character colors
 *
 * Backend format: *"dialogue"* **Character** said.
 * Strategy: Preprocess text to map dialogue→character, then color both during render
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMemo } from 'react';
import type { Components } from 'react-markdown';

interface Props {
  text: string;
  characters?: { name: string; color?: string }[];
  answeringQuestion?: string | null;
}

// Default character color mapping
const DEFAULT_COLORS: Record<string, string> = {
  kael: '#4a9eff',      // Blue
  sable: '#b8922e',     // Gold
  tobren: '#8fbc8f',    // Green
  lila: '#e97ba8',      // Pink
  maren: '#9b59b6',     // Purple
};

export default function ParableRenderer({ text, characters = [], answeringQuestion }: Props) {
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

  // Preprocess: find patterns like *"dialogue"* **Character** and map dialogue→color
  const dialogueColorMap = useMemo(() => {
    const map = new Map<string, string>();
    
    // Pattern: *"..."* followed by **Name**
    // Match: *"text"* **Character**
    const pattern = /\*"([^"]+)"\*\s*\*\*(\w+)\*\*/g;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      const dialogue = match[1]; // the quote content
      const charName = match[2].toLowerCase();
      const color = charColors.get(charName) || '#d4a843';
      map.set(dialogue, color);
    }
    
    return map;
  }, [text, charColors]);

  // Custom markdown components
  const components: Components = useMemo(() => ({
    // Handle bold text (character names)
    strong: ({ children }) => {
      const text = String(children);
      const lowerText = text.toLowerCase();
      
      // Check if this is a character name
      const color = charColors.get(lowerText);
      if (color) {
        return <strong style={{ color }}>{children}</strong>;
      }
      
      return <strong>{children}</strong>;
    },

    // Handle emphasis (dialogue)
    em: ({ children }) => {
      const text = String(children);
      
      // If it's dialogue, look up the color from our map
      if (text.startsWith('"') || text.startsWith('"')) {
        const dialogue = text.replace(/^[""]|[""]$/g, ''); // strip quotes
        const color = dialogueColorMap.get(dialogue);
        if (color) {
          return <em style={{ color }}>{children}</em>;
        }
      }
      
      return <em>{children}</em>;
    },
  }), [charColors, dialogueColorMap]);

  return (
    <div className="lesson-content parable">
      {answeringQuestion && (
        <div className="parable-context">
          <p className="parable-context-label">Today's Question:</p>
          <p className="parable-context-question">{answeringQuestion}</p>
        </div>
      )}
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
