/**
 * Anthropic Claude AI tool-use wrappers for lesson content generation.
 *
 * Uses a single system-prompt-driven call to generate all lesson content at once:
 * standard lesson, parable, sonnet, and DALL-E prompt — in one Claude request.
 *
 * Exported functions:
 * - `createSeriesDetails(topic)` → SeriesDetails — series metadata from a topic string
 * - `generateFullLesson(opts)` → FullLessonOutput — all content in one call
 * - `streamLesson(opts, callbacks)` → {parable, standard} — single call, streams parable first then standard
 * - `generateLessonMeta(opts)` → metadata — title, sonnet, dallePrompt, followUpQuestion, characters
 *
 * Exported interfaces: SeriesDetails, FullLessonOutput
 * Internal: callTool<T> — generic wrapper around anthropic.messages.create
 */
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function callTool<T>(toolName: string, toolDef: Anthropic.Tool, messages: Anthropic.MessageParam[], system?: string): Promise<T> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    tools: [toolDef],
    tool_choice: { type: 'tool', name: toolName },
    ...(system ? { system } : {}),
    messages,
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!toolUse) throw new Error(`No tool use found in response for ${toolName}`);
  return toolUse.input as T;
}

// ─── Series Details ───────────────────────────────────────────────────────────

export interface SeriesDetails {
  title: string;
  key: string;
  description: string;
  anchor: string;
  theme: string;
}

export async function createSeriesDetails(topic: string): Promise<SeriesDetails> {
  return callTool<SeriesDetails>('create_series_details', {
    name: 'create_series_details',
    description: 'Generate series metadata from a topic',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Series title' },
        key: { type: 'string', description: 'URL-safe unique slug (kebab-case, max 40 chars)' },
        description: { type: 'string', description: 'Short description (1-2 sentences)' },
        anchor: { type: 'string', description: 'A Socratic starter question (why/what/how) that kicks off the learning journey for this theme' },
        theme: { type: 'string', description: 'The overarching theme of this series (e.g. "Building wealth through patience and discipline")' },
      },
      required: ['title', 'key', 'description', 'anchor', 'theme'],
    },
  }, [{ role: 'user', content: `Create series metadata for a University series about: ${topic}` }]);
}

// ─── Full Lesson Generation (single call) ─────────────────────────────────────

export interface FullLessonOutput {
  title: string;
  standard: string;
  parable: string;
  sonnet: string;
  dallePrompt: string;
  followUpQuestion: string;
  characters: { name: string; pronoun: string; age?: string; personality?: string; role?: string }[];
}

export interface GenerateFullLessonOpts {
  seriesName: string;
  seriesTheme: string;
  parableCharacters: string; // e.g. "Kael (village boy), Sable (elder)"
  newDay: number;
  tomorrowQuestion?: string; // previous lesson's followUpQuestion (null for day 1)
  prevLessons: { title: string; followUpQuestion: string }[];
  existingCharacters: { name: string; pronoun: string; age?: string; personality?: string; role?: string }[];
}

export async function generateFullLesson(opts: GenerateFullLessonOpts): Promise<FullLessonOutput> {
  const {
    seriesName, seriesTheme, parableCharacters,
    newDay, tomorrowQuestion, prevLessons, existingCharacters,
  } = opts;

  const wisdomLabel = 'Real-World Wisdom';

  // Build history block
  const historyBlock = prevLessons.length > 0
    ? `Previously covered lessons (DO NOT repeat topics or questions):\n${prevLessons.map((l, i) => `- Day ${i + 1}: "${l.title}" (Q: ${l.followUpQuestion})`).join('\n')}`
    : '';

  const systemPrompt = `You are a lesson generator for the "${seriesName}" series.
Theme: ${seriesTheme}
Parable Characters: ${parableCharacters}
${historyBlock}

Generate a lesson in JSON format with these exact keys: standard, parable, sonnet, dallePrompt

The "standard" must follow this format exactly:

Day ${newDay}: [Title]

${tomorrowQuestion ? `[IMPORTANT: The previous lesson ended with this question: "${tomorrowQuestion}" — You MUST open the lesson by directly answering this question in 2-3 sentences before moving on. This creates continuity between lessons.]` : `[Brief intro to the topic if Day 1]`}

The Concept
[1-2 sentences]

Why It Matters
[2-3 sentences]

How It Works
[3-5 sentences with concrete examples]

${wisdomLabel}
[1-2 sentences]

Tomorrow's Question
— Ask a simple, direct question that naturally leads to the next concept. Keep it clear and accessible — one straightforward question that makes the reader curious about what's next.
IMPORTANT: Do NOT repeat or rephrase any previous question listed above.

Use ** for bold markdown on section headers and key terms.

The "parable" must continue the story using ${parableCharacters}, teaching the EXACT same concept as the standard. End with a moral and a teaser for tomorrow. Use rich, literary prose.
Parable formatting: **Bold** all character names every time they appear. Wrap all spoken dialogue in *italics* (e.g. *"The seed does not rush,"* **Sable** whispered). Use --- between major scene transitions.

The "sonnet" must be a 14-line Shakespearean sonnet (ABAB CDCD EFEF GG), titled "Sonnet [Roman numeral for day ${newDay}]: [Title]". Wrap the title in bold. The final couplet must be italicized with *. The sonnet should capture the lesson's essence poetically.

The "dallePrompt" should describe a classical oil painting scene inspired by the sonnet's imagery. Do NOT include this boilerplate in dallePrompt — just describe the scene. I will add the style instructions.

Return ONLY valid JSON. No markdown code fences. No explanation.`;

  return callTool<FullLessonOutput>('generate_full_lesson', {
    name: 'generate_full_lesson',
    description: 'Generate a complete lesson with standard content, parable, sonnet, and DALL-E prompt',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Short lesson title (3-6 words). Plain text only, no markdown formatting.' },
        standard: { type: 'string', description: 'The full standard lesson in markdown, following the exact format from the system prompt' },
        parable: { type: 'string', description: 'The parable story continuing the series narrative, in markdown' },
        sonnet: { type: 'string', description: 'A 14-line Shakespearean sonnet (ABAB CDCD EFEF GG) with bold title and italicized couplet' },
        dallePrompt: { type: 'string', description: 'Classical oil painting scene description inspired by the sonnet imagery' },
        followUpQuestion: { type: 'string', description: 'The Tomorrow\'s Question from the standard lesson — a Socratic question for the next lesson' },
        characters: {
          type: 'array',
          description: 'Full character list including any new characters introduced in the parable',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              pronoun: { type: 'string' },
              age: { type: 'string' },
              personality: { type: 'string' },
              role: { type: 'string' },
            },
            required: ['name', 'pronoun'],
          },
        },
      },
      required: ['title', 'standard', 'parable', 'sonnet', 'dallePrompt', 'followUpQuestion', 'characters'],
    },
  }, [
    { role: 'user', content: `Generate Day ${newDay} lesson for the "${seriesName}" series.` },
  ], systemPrompt);
}

// ─── Streaming Functions ──────────────────────────────────────────────────────

const STREAM_MODEL = 'claude-haiku-4-5';
const TITLE_DELIMITER = '---TITLE_BREAK---';
const SECTION_DELIMITER = '---LESSON_SECTION_BREAK---';

export interface CharacterContext {
  name: string;
  pronoun: string;
  role?: string;
  values?: string;
  memories?: { event: string; perspective: string; lessonNumber: number }[];
}

export interface StreamLessonOpts {
  seriesName: string;
  seriesTheme: string;
  parableCharacters: string;
  newDay: number;
  tomorrowQuestion?: string;
  prevLessons: { title: string; followUpQuestion: string }[];
  characterContext?: CharacterContext[];
}

export interface StreamCallbacks {
  onTitleDelta: (text: string) => void;
  onParableDelta: (text: string) => void;
  onStandardDelta: (text: string) => void;
  onSectionSwitch: (toSection: 'parable' | 'standard') => void;
}

export async function streamLesson(
  opts: StreamLessonOpts,
  callbacks: StreamCallbacks
): Promise<{ title: string; parable: string; standard: string; inputTokens: number; outputTokens: number }> {
  const { seriesName, seriesTheme, parableCharacters, newDay, tomorrowQuestion, prevLessons, characterContext } = opts;
  const wisdomLabel = 'Real-World Wisdom';

  const historyBlock = prevLessons.length > 0
    ? `Previously covered lessons (DO NOT repeat topics or questions):\n${prevLessons.map((l, i) => `- Day ${i + 1}: "${l.title}" (Q: ${l.followUpQuestion})`).join('\n')}`
    : '';

  const characterContextBlock = characterContext && characterContext.length > 0
    ? `\n\nCharacter Context (use this to maintain continuity):\n${characterContext.map(c => {
        let block = `${c.name} (${c.pronoun}, ${c.role || 'character'})`;
        if (c.values) block += `\n  Values: ${c.values}`;
        if (c.memories && c.memories.length > 0) {
          block += `\n  Core Memories:`;
          c.memories.forEach(m => {
            block += `\n    - Lesson ${m.lessonNumber}: ${m.event} (Perspective: ${m.perspective})`;
          });
        }
        return block;
      }).join('\n\n')}`
    : '';

  const system = `You are a lesson generator for the "${seriesName}" series.
Theme: ${seriesTheme}
Parable Characters: ${parableCharacters}
${historyBlock}${characterContextBlock}

You will write THREE sections in order:
1. TITLE (3-6 words)
2. PARABLE (short story)
3. STANDARD LESSON (structured content)

SECTION 1 — TITLE (write this first):
Output a SHORT lesson title (3-6 words) that captures the essence of the concept.
IMPORTANT: Output PLAIN TEXT ONLY — no markdown formatting, no asterisks, no bold. Just the title text.
Then output exactly this line: ${TITLE_DELIMITER}

SECTION 2 — PARABLE:
Write a CONCISE parable story in markdown using the characters above (${parableCharacters}).
**Target length: 250-400 words maximum** — keep it tight and impactful.
The parable must teach the concept for Day ${newDay}.
${tomorrowQuestion ? `The previous lesson ended with: "${tomorrowQuestion}" — the parable should explore this theme.` : 'This is the first lesson — introduce the characters and the series theme.'}
End with a moral. Use rich, literary prose but stay brief.

Formatting rules:
- **Bold** all character names every time they appear (e.g. **Kael**, **Sable**)
- Wrap all spoken dialogue in *italics* (e.g. *"The seed does not rush,"* **Sable** whispered.)
- Use --- horizontal rules between major scene transitions (sparingly)
- Keep dialogue short and impactful

Then output exactly: ${SECTION_DELIMITER}

SECTION 3 — STANDARD LESSON (write this last):
Follow this format exactly:

Day ${newDay}: [Title]

${tomorrowQuestion ? `[IMPORTANT: The previous lesson ended with this question: "${tomorrowQuestion}" — You MUST open by directly answering this question in 2-3 sentences before moving on.]` : `[Brief intro to the topic if Day 1]`}

The Concept
[1-2 sentences]

Why It Matters
[2-3 sentences]

How It Works
[3-5 sentences with concrete examples]

${wisdomLabel}
[1-2 sentences]

Tomorrow's Question
— Ask a simple, direct question that naturally leads to the next concept. Keep it clear and accessible — one straightforward question that makes the reader curious about what's next.
IMPORTANT: Do NOT repeat or rephrase any previous question listed above.

Use ** for bold markdown on section headers and key terms.
The standard lesson MUST teach the EXACT same concept as the parable above.`;

  let accumulated = '';
  let currentSection: 'title' | 'parable' | 'standard' = 'title';
  let titleText = '';
  let parableText = '';
  let standardText = '';
  let inputTokens = 0;
  let outputTokens = 0;

  const stream = anthropic.messages.stream({
    model: STREAM_MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: `Write Day ${newDay}: title, parable, then standard lesson.` }],
  });

  for await (const event of stream) {
    // Capture token usage when available
    if (event.type === 'message_start' && event.message.usage) {
      inputTokens = event.message.usage.input_tokens;
    }
    if (event.type === 'message_delta' && event.usage) {
      outputTokens = event.usage.output_tokens;
    }
    
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      const chunk = event.delta.text;
      accumulated += chunk;

      if (currentSection === 'title') {
        // Check if title delimiter appears
        const titleDelimIdx = accumulated.indexOf(TITLE_DELIMITER);
        if (titleDelimIdx !== -1) {
          // Extract title
          const beforeTitleDelim = accumulated.slice(0, titleDelimIdx).trim();
          const afterTitleDelim = accumulated.slice(titleDelimIdx + TITLE_DELIMITER.length);

          // Emit any remaining title text
          const remainingTitle = beforeTitleDelim.slice(titleText.length);
          if (remainingTitle) {
            titleText = beforeTitleDelim;
            callbacks.onTitleDelta(remainingTitle);
          }

          currentSection = 'parable';
          callbacks.onSectionSwitch('parable');
          
          // Start emitting parable if there's text already
          const trimmedParable = afterTitleDelim.replace(/^\n+/, '');
          accumulated = trimmedParable; // Set accumulated to trimmed version to keep indices aligned
          if (trimmedParable) {
            parableText = trimmedParable;
            callbacks.onParableDelta(trimmedParable);
          }
        } else {
          // Still in title — emit delta but keep buffer to avoid emitting partial delimiter
          // Check if accumulated might start containing the delimiter
          const bufferSize = TITLE_DELIMITER.length; // Keep full delimiter length as buffer
          const safeLen = Math.max(0, accumulated.length - bufferSize);
          const safeText = accumulated.slice(0, safeLen);
          const newTitle = safeText.slice(titleText.length);
          if (newTitle) {
            titleText = safeText;
            callbacks.onTitleDelta(newTitle);
          }
        }
      } else if (currentSection === 'parable') {
        // Check if parable→standard delimiter appears
        const delimIdx = accumulated.indexOf(SECTION_DELIMITER);
        if (delimIdx !== -1) {
          // Split: everything before delimiter is parable, after is standard
          const beforeDelim = accumulated.slice(0, delimIdx);
          const afterDelim = accumulated.slice(delimIdx + SECTION_DELIMITER.length);

          // Emit any remaining parable text
          const remainingParable = beforeDelim.slice(parableText.length);
          if (remainingParable) {
            parableText = beforeDelim;
            callbacks.onParableDelta(remainingParable);
          }

          currentSection = 'standard';
          callbacks.onSectionSwitch('standard');

          // Emit any standard text that came in this chunk
          const trimmedStandard = afterDelim.replace(/^\n+/, '');
          if (trimmedStandard) {
            standardText = trimmedStandard;
            callbacks.onStandardDelta(trimmedStandard);
          }
          // Note: No need to reset accumulated here since standard section emits chunks directly
        } else {
          // Still in parable — emit delta but keep buffer to avoid emitting partial delimiter
          const bufferSize = SECTION_DELIMITER.length; // Keep full delimiter length as buffer
          const safeLen = Math.max(0, accumulated.length - bufferSize);
          const safeText = accumulated.slice(0, safeLen);
          const newParable = safeText.slice(parableText.length);
          if (newParable) {
            parableText = safeText;
            callbacks.onParableDelta(newParable);
          }
        }
      } else {
        // In standard section — emit directly
        standardText += chunk;
        callbacks.onStandardDelta(chunk);
      }
    }
  }

  // Flush any remaining buffered text
  if (currentSection === 'title') {
    const remaining = accumulated.slice(titleText.length);
    if (remaining) {
      titleText += remaining;
      callbacks.onTitleDelta(remaining);
    }
  } else if (currentSection === 'parable') {
    const remaining = accumulated.slice(parableText.length);
    if (remaining) {
      parableText += remaining;
      callbacks.onParableDelta(remaining);
    }
  }

  // Strip markdown formatting from title (**, *, etc.)
  const cleanTitle = titleText.trim()
    .replace(/^\*\*(.+?)\*\*$/g, '$1')  // Remove surrounding **bold**
    .replace(/^\*(.+?)\*$/g, '$1')      // Remove surrounding *italic*
    .replace(/\*\*/g, '')               // Remove any remaining **
    .replace(/\*/g, '');                // Remove any remaining *

  return { 
    title: cleanTitle, 
    parable: parableText.trim(), 
    standard: standardText.trim(),
    inputTokens,
    outputTokens
  };
}

export interface CharacterUpdate {
  name: string;
  values: string;
  memories: { event: string; perspective: string }[];
}

export interface LessonMeta {
  title: string;
  sonnet: string;
  dallePrompt: string;
  followUpQuestion: string;
  characters: { name: string; pronoun: string; age?: string; personality?: string; role?: string }[];
  characterUpdates: CharacterUpdate[];
}

export async function generateLessonMeta(
  opts: { 
    standardContent: string; 
    parableContent: string; 
    seriesName: string; 
    newDay: number; 
    existingCharacters: { 
      name: string; 
      pronoun: string; 
      age?: string; 
      personality?: string; 
      role?: string;
      values?: string;
      memories?: { event: string; perspective: string; lessonNumber: number }[];
    }[] 
  }
): Promise<LessonMeta> {
  const { standardContent, parableContent, seriesName, newDay, existingCharacters } = opts;

  const charsDesc = existingCharacters.length > 0
    ? `Existing characters:\n${existingCharacters.map(c => {
        let desc = `- ${c.name} (${c.pronoun}, ${c.role || 'character'})`;
        if (c.values) desc += `\n  Current Values: ${c.values}`;
        if (c.memories && c.memories.length > 0) {
          desc += `\n  Current Memories (${c.memories.length}):`;
          c.memories.forEach(m => {
            desc += `\n    • Lesson ${m.lessonNumber}: ${m.event}`;
          });
        }
        return desc;
      }).join('\n')}`
    : '';

  return callTool<LessonMeta>('extract_lesson_meta', {
    name: 'extract_lesson_meta',
    description: 'Extract metadata from a generated lesson',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Short lesson title (3-6 words) extracted from the standard content. Plain text only, no markdown formatting.' },
        sonnet: { type: 'string', description: `A 14-line Shakespearean sonnet (ABAB CDCD EFEF GG), titled "Sonnet [Roman numeral for day ${newDay}]: [Title]". Bold title. Final couplet italicized with *.` },
        dallePrompt: { type: 'string', description: 'Classical oil painting scene description inspired by the lesson imagery. Just the scene, no style boilerplate.' },
        followUpQuestion: { type: 'string', description: "The Tomorrow's Question from the standard lesson" },
        characters: {
          type: 'array',
          description: 'Full character list including any new characters from the parable',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              pronoun: { type: 'string' },
              age: { type: 'string' },
              personality: { type: 'string' },
              role: { type: 'string' },
            },
            required: ['name', 'pronoun'],
          },
        },
        characterUpdates: {
          type: 'array',
          description: `For each character in this lesson's parable, extract their updated values and new memories from this lesson. Values: max 5 sentences describing beliefs, desires, understanding of the world (keep same if no change). Memories: key events from THIS lesson and character's perspective (2-3 new memories per lesson).`,
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Character name' },
              values: { type: 'string', description: 'Character values (max 5 sentences). Rewrite only if changed through consequences/growth. Keep previous values if no change.' },
              memories: {
                type: 'array',
                description: 'New memories from this lesson (2-3 key events)',
                items: {
                  type: 'object',
                  properties: {
                    event: { type: 'string', description: 'What happened in this lesson' },
                    perspective: { type: 'string', description: 'How the character perceived/felt about this event' },
                  },
                  required: ['event', 'perspective'],
                },
              },
            },
            required: ['name', 'values', 'memories'],
          },
        },
      },
      required: ['title', 'sonnet', 'dallePrompt', 'followUpQuestion', 'characters', 'characterUpdates'],
    },
  }, [{
    role: 'user',
    content: `Extract metadata from this lesson for the "${seriesName}" series (Day ${newDay}).

${charsDesc}

Standard lesson:
${standardContent}

Parable:
${parableContent}

Extract the title, write a sonnet, create a DALL-E prompt, identify the follow-up question, and list all characters.`,
  }]);
}

// ─── Memory Ranking ───────────────────────────────────────────────────────────

interface RankedMemory {
  event: string;
  perspective: string;
  lessonNumber: number;
  alignmentScore: number;
}

export async function rankMemoriesByValues(
  characterName: string,
  currentValues: string,
  memories: { event: string; perspective: string; lessonNumber: number }[]
): Promise<{ event: string; perspective: string; lessonNumber: number }[]> {
  if (memories.length <= 10) return memories; // No need to rank if under threshold

  const memoriesDesc = memories.map((m, i) => 
    `${i}. Lesson ${m.lessonNumber}: ${m.event} (Perspective: ${m.perspective})`
  ).join('\n');

  const result = await callTool<{ rankedIndices: number[] }>('rank_memories', {
    name: 'rank_memories',
    description: 'Rank character memories by alignment with current values',
    input_schema: {
      type: 'object' as const,
      properties: {
        rankedIndices: {
          type: 'array',
          description: 'Array of memory indices (0-based) ranked from most to least aligned with current values. Return top 10 only.',
          items: { type: 'number' },
        },
      },
      required: ['rankedIndices'],
    },
  }, [{
    role: 'user',
    content: `Rank these memories for ${characterName} based on alignment with their current values.

Current Values:
${currentValues}

Memories:
${memoriesDesc}

Return the indices (0-${memories.length - 1}) of the top 10 memories that best align with and support their current values. Prioritize memories that:
1. Shaped or reinforced their current beliefs
2. Led to growth/perspective shifts reflected in current values
3. Are most relevant to who they are now`,
  }]);

  // Return top 10 memories in ranked order
  return result.rankedIndices.slice(0, 10).map(i => memories[i]);
}
