/**
 * Anthropic Claude AI tool-use wrappers for lesson content generation.
 *
 * All functions use forced tool use (tool_choice: {type: "tool", name: ...}) with
 * claude-opus-4-6 to guarantee structured JSON output. Each function maps to one
 * Claude tool with a defined input_schema.
 *
 * Exported functions:
 * - `createSeriesDetails(topic)` → SeriesDetails — series metadata from a topic string
 * - `generateFirstStandard(anchor, title, description)` → StandardOutput — lesson 1 content
 * - `generateStandard(seriesContext, prevFollowUpQuestion, prevLessons)` → StandardOutput — subsequent lessons
 *   Includes a 'review' field; uses previous titles/questions to avoid repetition
 * - `generateParable(standard, existingCharacters)` → ParableOutput — narrative story + character list
 *   Creates new characters on first lesson; reuses/extends them on subsequent lessons
 * - `generateSonnet(standard)` → SonnetOutput — 14-line Shakespearean sonnet (ABAB CDCD EFEF GG)
 * - `generateImagePrompt(sonnet)` → {prompt} — classical oil painting DALL-E prompt
 *
 * Exported interfaces: SeriesDetails, StandardOutput, ParableOutput, SonnetOutput
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
  wisdomLabel: string;
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
        anchor: { type: 'string', description: 'Core concept or theme that anchors the series' },
        emoji: { type: 'string', description: 'Single representative emoji' },
        wisdomLabel: { type: 'string', description: 'Label for the wisdom section (e.g. "The Principle", "The Lesson")' },
      },
      required: ['title', 'key', 'description', 'anchor', 'emoji', 'wisdomLabel'],
    },
  }, [{ role: 'user', content: `Create series metadata for a Parable series about: ${topic}` }]);
}

export interface StandardOutput {
  title: string;
  review?: string;
  concept: string;
  whyItMatters: string;
  howItWorks: string;
  definitions: { term: string; definition: string }[];
  wisdom: string;
  followUpQuestion: string;
}

export async function generateFirstStandard(anchor: string, title: string, description: string): Promise<StandardOutput> {
  return callTool<StandardOutput>('generate_first_standard', {
    name: 'generate_first_standard',
    description: 'Generate the first lesson standard for a series',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string' },
        concept: { type: 'string' },
        whyItMatters: { type: 'string' },
        howItWorks: { type: 'string' },
        definitions: {
          type: 'array',
          items: {
            type: 'object',
            properties: { term: { type: 'string' }, definition: { type: 'string' } },
            required: ['term', 'definition'],
          },
        },
        wisdom: { type: 'string' },
        followUpQuestion: { type: 'string' },
      },
      required: ['title', 'concept', 'whyItMatters', 'howItWorks', 'definitions', 'wisdom', 'followUpQuestion'],
    },
  }, [{
    role: 'user',
    content: `Generate the first lesson for a Parable series.
Series anchor: ${anchor}
Series title: ${title}
Description: ${description}

Create an educational lesson that introduces the core concept.`,
  }]);
}

export async function generateStandard(
  seriesContext: { title: string; anchor: string; description: string },
  prevFollowUpQuestion: string,
  prevLessons: { title: string; followUpQuestion: string }[]
): Promise<StandardOutput> {
  const prevTitles = prevLessons.map(l => `- "${l.title}"`).join('\n');
  const prevQuestions = prevLessons.map(l => `- ${l.followUpQuestion}`).join('\n');

  return callTool<StandardOutput>('generate_standard', {
    name: 'generate_standard',
    description: 'Generate the next lesson standard, building on previous lessons',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string' },
        review: { type: 'string', description: 'Brief review of previous lesson concept (1-2 sentences)' },
        concept: { type: 'string' },
        whyItMatters: { type: 'string' },
        howItWorks: { type: 'string' },
        definitions: {
          type: 'array',
          items: {
            type: 'object',
            properties: { term: { type: 'string' }, definition: { type: 'string' } },
            required: ['term', 'definition'],
          },
        },
        wisdom: { type: 'string' },
        followUpQuestion: { type: 'string' },
      },
      required: ['title', 'concept', 'whyItMatters', 'howItWorks', 'definitions', 'wisdom', 'followUpQuestion'],
    },
  }, [{
    role: 'user',
    content: `Generate the next lesson for a Parable series.

Series: ${seriesContext.title}
Anchor: ${seriesContext.anchor}
Description: ${seriesContext.description}

Previous lesson's follow-up question: "${prevFollowUpQuestion}"

Previously covered titles (DO NOT repeat):
${prevTitles}

Previously asked follow-up questions (DO NOT repeat):
${prevQuestions}

Create a new lesson that answers the previous follow-up question and introduces a new, distinct concept.`,
  }]);
}

export interface ParableOutput {
  content: string;
  characters: { name: string; pronoun: string; age?: string; personality?: string; role?: string }[];
}

export async function generateParable(
  standard: StandardOutput,
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

Title: ${standard.title}
Concept: ${standard.concept}
Why it matters: ${standard.whyItMatters}
How it works: ${standard.howItWorks}
Wisdom: ${standard.wisdom}

${charsDesc}

Write a compelling narrative story (2-4 paragraphs in markdown) that illustrates the concept through the characters' experiences. Include or introduce characters as needed.`,
  }]);
}

export interface SonnetOutput {
  title: string;
  content: string;
}

export async function generateSonnet(standard: StandardOutput): Promise<SonnetOutput> {
  return callTool<SonnetOutput>('generate_sonnet', {
    name: 'generate_sonnet',
    description: 'Generate a 14-line Shakespearean sonnet about the lesson',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string' },
        content: { type: 'string', description: '14-line Shakespearean sonnet (3 quatrains + couplet, ABAB CDCD EFEF GG)' },
      },
      required: ['title', 'content'],
    },
  }, [{
    role: 'user',
    content: `Write a Shakespearean sonnet about this lesson:
Title: ${standard.title}
Concept: ${standard.concept}
Wisdom: ${standard.wisdom}

Write exactly 14 lines in iambic pentameter with rhyme scheme ABAB CDCD EFEF GG.`,
  }]);
}

export async function generateImagePrompt(sonnet: SonnetOutput): Promise<{ prompt: string }> {
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
    content: `Create a DALL-E 3 image prompt for this sonnet:
Title: ${sonnet.title}
Content: ${sonnet.content}

Requirements: Classical oil painting style, Rembrandt dramatic lighting, rich colors, no text or words in image, suitable for a literary educational app.`,
  }]);
}
