/**
 * ParableRenderer — renders parable markdown with character tooltips
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState } from 'react';
import type { Character } from '../lib/api.js';

interface Props {
  text: string;
  answeringQuestion?: string | null;
  followUpQuestion?: string;
  characters?: Character[];
}

export default function ParableRenderer({ text, answeringQuestion, followUpQuestion, characters = [] }: Props) {
  const [openTooltip, setOpenTooltip] = useState<string | null>(null);

  // Custom renderer for strong (bold) elements to detect character names
  const components = {
    strong: ({ children }: { children: React.ReactNode }) => {
      const childText = typeof children === 'string' ? children : 
                       (Array.isArray(children) ? children.join('') : String(children));
      
      const character = characters.find(c => c.name === childText);
      
      if (character) {
        const isOpen = openTooltip === character.name;
        
        return (
          <span style={{ position: 'relative', display: 'inline-block' }}>
            <strong 
              onClick={() => setOpenTooltip(isOpen ? null : character.name)}
              style={{ 
                cursor: 'pointer',
                textDecoration: isOpen ? 'underline' : 'none',
                color: isOpen ? 'var(--gold)' : 'inherit',
              }}
            >
              {children}
            </strong>
            {isOpen && (
              <div 
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginTop: '0.5rem',
                  padding: '1rem',
                  backgroundColor: 'rgba(20, 20, 30, 0.95)',
                  border: '1px solid var(--gold)',
                  borderRadius: '8px',
                  minWidth: '280px',
                  maxWidth: '400px',
                  zIndex: 1000,
                  fontSize: '0.875rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ marginBottom: '0.75rem' }}>
                  <strong style={{ color: 'var(--gold)', fontSize: '1rem' }}>{character.name}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.25rem' }}>
                    {character.pronoun}{character.role ? ` • ${character.role}` : ''}
                  </div>
                </div>

                {character.personality && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ color: 'var(--gold)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Personality</div>
                    <div style={{ color: 'rgba(255,255,255,0.8)' }}>{character.personality}</div>
                  </div>
                )}

                {character.values && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ color: 'var(--gold)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Values</div>
                    <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem' }}>{character.values}</div>
                  </div>
                )}

                {character.memories && character.memories.length > 0 && (
                  <div>
                    <div style={{ color: 'var(--gold)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                      Core Memories ({character.memories.length})
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {character.memories.map((m, i) => (
                        <div 
                          key={i} 
                          style={{ 
                            marginBottom: '0.75rem',
                            paddingBottom: '0.75rem',
                            borderBottom: i < character.memories!.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none'
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
          </span>
        );
      }
      
      return <strong>{children}</strong>;
    },
  };

  return (
    <div className="lesson-content parable">
      {answeringQuestion && (
        <div className="parable-context">
          <p className="parable-context-label">Today's Question:</p>
          <p className="parable-context-question">{answeringQuestion}</p>
        </div>
      )}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
      {followUpQuestion && (
        <div className="parable-tomorrow">
          <p className="parable-tomorrow-label">Tomorrow's Question:</p>
          <p className="parable-tomorrow-question">{followUpQuestion}</p>
        </div>
      )}
    </div>
  );
}
