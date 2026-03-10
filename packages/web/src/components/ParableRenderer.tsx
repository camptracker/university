/**
 * ParableRenderer — renders parable markdown with character colors
 *
 * - Detects **character names** and wraps them in colored spans
 * - Detects *dialogue* near character names and applies the same color
 * - Works by preprocessing markdown to inject color spans
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useMemo } from 'react';

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

  // Process text to color character names and dialogue
  const processedText = useMemo(() => {
    let result = text;

    // For each character, replace **Name** with colored version
    charColors.forEach((color, name) => {
      const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
      
      // Replace **Character** with <span style="color: #xxx">**Character**</span>
      const boldPattern = new RegExp(`\\*\\*${capitalizedName}\\*\\*`, 'gi');
      result = result.replace(boldPattern, `<span style="color: ${color}">**${capitalizedName}**</span>`);
      
      // For dialogue: find *"..."* that appears after a character name
      // Pattern: **Character** word word *"dialogue"*
      // We'll look for *"..."* and if preceded by character name within ~50 chars, color it
      const dialoguePattern = /\*"[^"]+"\*/g;
      const matches = [...result.matchAll(dialoguePattern)];
      
      matches.forEach(match => {
        const matchIndex = match.index!;
        const matchText = match[0];
        const precedingText = result.slice(Math.max(0, matchIndex - 80), matchIndex);
        
        // Check if character name appears in preceding text
        if (precedingText.toLowerCase().includes(capitalizedName.toLowerCase())) {
          const coloredDialogue = `<span style="color: ${color}">${matchText}</span>`;
          result = result.slice(0, matchIndex) + coloredDialogue + result.slice(matchIndex + matchText.length);
        }
      });
    });

    return result;
  }, [text, charColors]);

  return (
    <div className="lesson-content parable">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  );
}
