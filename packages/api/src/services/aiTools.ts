/**
 * Anthropic Claude AI tool-use wrappers for lesson content generation.
 *
 * Uses a single system-prompt-driven call to generate all lesson content at once:
 * standard lesson, parable, sonnet, and DALL-E prompt — in one Claude request.
 *
 * Exported functions:
 * - `createSeriesDetails(topic)` → SeriesDetails — series metadata from a topic string
 * - `generateFullLesson(opts)` → FullLessonOutput — all content in one call
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
  emoji: string;
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
        emoji: { type: 'string', description: 'Single representative emoji' },
        theme: { type: 'string', description: 'The overarching theme of this series (e.g. "Building wealth through patience and discipline")' },
      },
      required: ['title', 'key', 'description', 'anchor', 'emoji', 'theme'],
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
  seriesEmoji: string;
  parableCharacters: string; // e.g. "Kael (village boy), Sable (elder)"
  newDay: number;
  tomorrowQuestion?: string; // previous lesson's followUpQuestion (null for day 1)
  prevLessons: { title: string; followUpQuestion: string }[];
  existingCharacters: { name: string; pronoun: string; age?: string; personality?: string; role?: string }[];
}

export async function generateFullLesson(opts: GenerateFullLessonOpts): Promise<FullLessonOutput> {
  const {
    seriesName, seriesTheme, seriesEmoji, parableCharacters,
    newDay, tomorrowQuestion, prevLessons, existingCharacters,
  } = opts;

  const wisdomLabel = 'Real-World Wisdom';

  // Build history block
  const historyBlock = prevLessons.length > 0
    ? `Previously covered lessons (DO NOT repeat topics or questions):\n${prevLessons.map((l, i) => `- Day ${i + 1}: "${l.title}" (Q: ${l.followUpQuestion})`).join('\n')}`
    : '';

  const systemPrompt = `You are a lesson generator for the "${seriesName}" series.
Theme: ${seriesTheme}
Emoji: ${seriesEmoji}
Parable Characters: ${parableCharacters}
${historyBlock}

Generate a lesson in JSON format with these exact keys: standard, parable, sonnet, dallePrompt

The "standard" must follow this format exactly:

${seriesEmoji} Day ${newDay}: [Title]

${tomorrowQuestion ? `[IMPORTANT: The previous lesson ended with this question: "${tomorrowQuestion}" — You MUST open the lesson by directly answering this question in 2-3 sentences before moving on. This creates continuity between lessons.]` : `[Brief intro to the topic if Day 1]`}

🧱 The Concept
[1-2 sentences]

❓ Why It Matters
[2-3 sentences]

⚙️ How It Works
[3-5 sentences with concrete examples]

🎯 ${wisdomLabel}
[1-2 sentences]

❓ Tomorrow's Question
— Use the Socratic method: ask a thought-provoking question that challenges assumptions, invites deeper thinking, and naturally leads to the next concept. Don't ask a simple factual question — ask one that makes the reader wrestle with an idea.
IMPORTANT: Do NOT repeat or rephrase any previous question listed above.

Use ** for bold markdown on section headers and key terms.

The "parable" must continue the story using ${parableCharacters}, teaching the EXACT same concept as the standard. End with a moral and a teaser for tomorrow. Use rich, literary prose.

The "sonnet" must be a 14-line Shakespearean sonnet (ABAB CDCD EFEF GG), titled "🪶 Sonnet [Roman numeral for day ${newDay}]: [Title]". Wrap the title in bold. The final couplet must be italicized with *. The sonnet should capture the lesson's essence poetically.

The "dallePrompt" should describe a classical oil painting scene inspired by the sonnet's imagery. Do NOT include this boilerplate in dallePrompt — just describe the scene. I will add the style instructions.

Return ONLY valid JSON. No markdown code fences. No explanation.`;

  return callTool<FullLessonOutput>('generate_full_lesson', {
    name: 'generate_full_lesson',
    description: 'Generate a complete lesson with standard content, parable, sonnet, and DALL-E prompt',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Short lesson title (3-6 words)' },
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
