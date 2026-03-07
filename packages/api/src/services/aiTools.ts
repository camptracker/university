/**
 * Anthropic Claude AI tool-use wrappers for lesson content generation.
 *
 * All functions use forced tool use (tool_choice: {type: "tool", name: ...}) with
 * claude-opus-4-6 to guarantee structured JSON output. Each function maps to one
 * Claude tool with a defined input_schema.
 *
 * Exported functions:
 * - `createSeriesDetails(topic)` → SeriesDetails — series metadata from a topic string
 * - `generateLesson(seriesContext, previousQuestion, prevLessons)` → LessonOutput — lesson content (markdown)
 *   For lesson 1, pass previousQuestion as null (uses series anchor). Includes followUpQuestion.
 * - `generateParable(lesson, existingCharacters)` → ParableOutput — narrative story + character list
 *   Creates new characters on first lesson; reuses/extends them on subsequent lessons
 * - `generatePoem(lessonOutput)` → PoemOutput — haiku (5-7-5)
 * - `generateImagePrompt(poem)` → {prompt} — classical oil painting DALL-E prompt
 *
 * Exported interfaces: SeriesDetails, LessonOutput, ParableOutput, PoemOutput
 * Internal: callTool<T> — generic wrapper around anthropic.messages.create
 */
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function callTool<T>(toolName: string, toolDef: Anthropic.Tool, messages: Anthropic.MessageParam[]): Promise<T> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    tools: [toolDef],
    tool_choice: { type: 'tool', name: toolName },
    messages,
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!toolUse) throw new Error(`No tool use found in response for ${toolName}`);
  return toolUse.input as T;
}

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

export interface LessonOutput {
  title: string;
  content: string; // markdown
  followUpQuestion: string;
}

export async function generateLesson(
  seriesContext: { title: string; anchor: string; description: string; theme: string },
  previousQuestion: string | null,
  prevLessons: { title: string; followUpQuestion: string }[]
): Promise<LessonOutput> {
  const question = previousQuestion ?? seriesContext.anchor;
  const isFirst = previousQuestion === null;

  const prevSection = prevLessons.length > 0
    ? `\nPreviously covered titles (DO NOT repeat):\n${prevLessons.map(l => `- "${l.title}"`).join('\n')}\n\nPreviously asked follow-up questions (DO NOT repeat):\n${prevLessons.map(l => `- ${l.followUpQuestion}`).join('\n')}\n`
    : '';

  return callTool<LessonOutput>('generate_lesson', {
    name: 'generate_lesson',
    description: 'Generate a lesson that answers a Socratic question with markdown content',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Lesson title — short and simple, 3-6 words max, no fancy vocabulary' },
        content: {
          type: 'string',
          description: 'Markdown lesson content. Explain like I am 5 years old — use simple words, short sentences, and relatable everyday analogies. Must include: answer to the question, key concepts, why it matters, how it works, and a wisdom quote with attribution. Be brief — aim for 150-250 words total.',
        },
        followUpQuestion: {
          type: 'string',
          description: 'A Socratic follow-up question (why/what/how) that arises naturally from the lesson content and provokes deeper thinking',
        },
      },
      required: ['title', 'content', 'followUpQuestion'],
    },
  }, [{
    role: 'user',
    content: `Generate a lesson for a University series.

Series: ${seriesContext.title}
Theme: ${seriesContext.theme}
Description: ${seriesContext.description}

${isFirst ? 'Opening question (series anchor)' : 'Question to answer in this lesson'}: "${question}"
${prevSection}
Write a markdown lesson that:
- Explains like I'm 5 years old — simple words, short sentences, everyday analogies
- Directly answers the question above
- Defines key concepts in plain language (no jargon)
- Explains why it matters and how it works using relatable examples
- Includes a relevant wisdom quote with its source
- Aim for 150-250 words total — be punchy, not wordy
- Use short headers and 1-2 sentence paragraphs max

The followUpQuestion should be a simple, curious question that a child might ask after hearing this — Socratic but accessible.`,
  }]);
}

export interface ParableOutput {
  content: string;
  characters: { name: string; pronoun: string; age?: string; personality?: string; role?: string }[];
}

export async function generateParable(
  lesson: LessonOutput,
  existingCharacters: { name: string; pronoun: string; age?: string; personality?: string; role?: string }[]
): Promise<ParableOutput> {
  const charsDesc = existingCharacters.length > 0
    ? `Existing characters:\n${existingCharacters.map(c => `- ${c.name} (${c.pronoun}, ${c.role || 'character'})`).join('\n')}`
    : 'No existing characters — create a cast for this series.';

  return callTool<ParableOutput>('generate_parable', {
    name: 'generate_parable',
    description: 'Generate a parable story illustrating the lesson concept',
    input_schema: {
      type: 'object' as const,
      properties: {
        content: { type: 'string', description: 'The full parable story in markdown format' },
        characters: {
          type: 'array',
          description: 'Full character list including any new characters introduced',
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
      required: ['content', 'characters'],
    },
  }, [{
    role: 'user',
    content: `Write a parable story illustrating this lesson:

Title: ${lesson.title}
Content: ${lesson.content}

${charsDesc}

Write a short, vivid story (2-3 paragraphs in markdown) that shows the concept in action through the characters. Keep the language simple and the story easy to follow — like a fable or bedtime story. Include or introduce characters as needed.`,
  }]);
}

export interface PoemOutput {
  title: string;
  content: string; // haiku (5-7-5)
}

export async function generatePoem(lessonOutput: LessonOutput): Promise<PoemOutput> {
  return callTool<PoemOutput>('generate_poem', {
    name: 'generate_poem',
    description: 'Generate a haiku about the lesson',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Title of the haiku' },
        content: { type: 'string', description: 'Three lines: 5 syllables, 7 syllables, 5 syllables' },
      },
      required: ['title', 'content'],
    },
  }, [{
    role: 'user',
    content: `Write a haiku that captures the essence of this lesson:
Title: ${lessonOutput.title}
Content: ${lessonOutput.content}

Generate a haiku (three lines: 5 syllables, 7 syllables, 5 syllables).`,
  }]);
}

export async function generateImagePrompt(poem: PoemOutput): Promise<{ prompt: string }> {
  return callTool<{ prompt: string }>('generate_image_prompt', {
    name: 'generate_image_prompt',
    description: 'Generate a DALL-E image prompt for the lesson',
    input_schema: {
      type: 'object' as const,
      properties: {
        prompt: { type: 'string', description: 'Classical oil painting prompt, Rembrandt lighting style, no text or words' },
      },
      required: ['prompt'],
    },
  }, [{
    role: 'user',
    content: `Create a DALL-E 3 image prompt for this haiku:
Title: ${poem.title}
Content: ${poem.content}

Requirements: Classical oil painting style, Rembrandt dramatic lighting, rich colors, no text or words in image, suitable for a literary educational app.`,
  }]);
}
