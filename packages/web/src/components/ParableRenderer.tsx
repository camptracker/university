/**
 * ParableRenderer — renders parable markdown with character tooltips
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState, useRef, useEffect } from 'react';
import type { Character } from '../lib/api.js';

interface Props {
  text: string;
  answeringQuestion?: string | null;
  followUpQuestion?: string;
  characters?: Character[];
}

export default function ParableRenderer({ text, answeringQuestion, followUpQuestion, characters = [] }: Props) {
  const [openTooltip, setOpenTooltip] = useState<{ name: string; element: HTMLElement } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle clicks on strong elements
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Check if clicked element is a strong tag
      if (target.tagName === 'STRONG') {
        const text = target.textContent?.trim() || '';
        // Normalize the name (remove possessive 's if present)
        const normalizedName = text.replace(/'s$/, '');
        const character = characters.find(c => c.name === normalizedName || c.name === text);
        
        if (character) {
          e.stopPropagation();
          setOpenTooltip(prev => 
            prev && prev.name === character.name ? null : { name: character.name, element: target }
          );
        }
      } else {
        // Close tooltip if clicking outside
        setOpenTooltip(null);
      }
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [characters]);

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!openTooltip) return { display: 'none' };
    
    const rect = openTooltip.element.getBoundingClientRect();
    return {
      position: 'fixed',
      top: `${rect.bottom + 8}px`,
      left: `${rect.left + rect.width / 2}px`,
      transform: 'translateX(-50%)',
      padding: '1rem',
      backgroundColor: 'rgba(20, 20, 30, 0.95)',
      border: '1px solid var(--gold)',
      borderRadius: '8px',
      minWidth: '280px',
      maxWidth: '400px',
      zIndex: 1000,
      fontSize: '0.875rem',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    };
  };

  const activeCharacter = openTooltip ? characters.find(c => c.name === openTooltip.name) : null;

  return (
    <>
      <div className="lesson-content parable" ref={containerRef}>
        {answeringQuestion && (
          <div className="parable-context">
            <p className="parable-context-label">Today's Question:</p>
            <p className="parable-context-question">{answeringQuestion}</p>
          </div>
        )}
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {text}
        </ReactMarkdown>
        {followUpQuestion && (
          <div className="parable-tomorrow">
            <p className="parable-tomorrow-label">Tomorrow's Question:</p>
            <p className="parable-tomorrow-question">{followUpQuestion}</p>
          </div>
        )}
      </div>

      {/* Character tooltip */}
      {activeCharacter && (
        <div style={getTooltipStyle()} onClick={(e) => e.stopPropagation()}>
          <div style={{ marginBottom: '0.75rem' }}>
            <strong style={{ color: 'var(--gold)', fontSize: '1rem' }}>{activeCharacter.name}</strong>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.25rem' }}>
              {activeCharacter.pronoun}{activeCharacter.role ? ` • ${activeCharacter.role}` : ''}
            </div>
          </div>

          {activeCharacter.personality && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ color: 'var(--gold)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Personality</div>
              <div style={{ color: 'rgba(255,255,255,0.8)' }}>{activeCharacter.personality}</div>
            </div>
          )}

          {activeCharacter.values && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ color: 'var(--gold)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Values</div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem' }}>{activeCharacter.values}</div>
            </div>
          )}

          {activeCharacter.memories && activeCharacter.memories.length > 0 && (
            <div>
              <div style={{ color: 'var(--gold)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                Core Memories ({activeCharacter.memories.length})
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {activeCharacter.memories.map((m, i) => (
                  <div 
                    key={i} 
                    style={{ 
                      marginBottom: '0.75rem',
                      paddingBottom: '0.75rem',
                      borderBottom: i < activeCharacter.memories!.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none'
                    }}
                  >
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Lesson {m.lessonNumber}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                      {m.event}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                      "{m.perspective}"
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setOpenTooltip(null)}
            style={{
              marginTop: '0.75rem',
              padding: '0.25rem 0.75rem',
              backgroundColor: 'transparent',
              border: '1px solid var(--gold)',
              borderRadius: '4px',
              color: 'var(--gold)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            Close
          </button>
        </div>
      )}
    </>
  );
}
