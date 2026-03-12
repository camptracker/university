/**
 * Theme Generator Service
 * 
 * Generates daily timeless themes that reflect current events, transformations,
 * values, and beliefs happening today. Uses Claude to research best practices
 * and create quality themes with credible sources.
 */
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CACHE_PATH = path.join(process.cwd(), 'data', 'daily-themes.json');

interface DailyTheme {
  emoji: string;
  title: string;
  topic: string;
}

interface CachedThemes {
  themes: DailyTheme[];
  generatedAt: string;
}

export async function generateDailyThemes(): Promise<DailyTheme[]> {
  const systemPrompt = `You are a theme generation expert who creates timeless, compelling learning topics that reflect current events, cultural transformations, evolving values, and shifting beliefs in society.

Your task is to generate 8 high-quality educational themes that:
1. Are timeless yet reflect what's happening in the world today
2. Draw from credible sources and real trends
3. Appeal to curious, growth-minded learners
4. Balance immediate relevance with long-term value
5. Cover diverse areas: technology, culture, psychology, economics, health, relationships, philosophy, skills

Best practices for theme creation:
- Be specific but not narrow (e.g., "The Psychology of Remote Work" not just "Remote Work")
- Include a perspective or angle (e.g., "How Social Media Rewired Social Connection")
- Make it actionable and learnable
- Avoid jargon; use clear, compelling language
- Think about what people are genuinely curious about right now

Today's date: ${new Date().toISOString().split('T')[0]}

Generate 8 themes that someone would want to learn about today.`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2048,
    tools: [{
      name: 'generate_themes',
      description: 'Generate 8 daily educational themes',
      input_schema: {
        type: 'object',
        properties: {
          themes: {
            type: 'array',
            description: 'Array of 8 theme objects',
            items: {
              type: 'object',
              properties: {
                emoji: {
                  type: 'string',
                  description: 'Single emoji that represents the theme'
                },
                title: {
                  type: 'string',
                  description: 'Concise title (2-4 words)'
                },
                topic: {
                  type: 'string',
                  description: 'Detailed topic description for series generation (1-2 sentences, specific and actionable)'
                }
              },
              required: ['emoji', 'title', 'topic']
            }
          }
        },
        required: ['themes']
      }
    }],
    tool_choice: { type: 'tool', name: 'generate_themes' },
    messages: [{ role: 'user', content: 'Generate 8 timeless themes that reflect what\'s happening in the world today. Focus on truth, credible trends, and what people genuinely want to learn.' }],
    system: systemPrompt,
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!toolUse) throw new Error('No tool use found in response');

  const result = toolUse.input as { themes: DailyTheme[] };
  
  // Cache the themes
  const cached: CachedThemes = {
    themes: result.themes,
    generatedAt: new Date().toISOString(),
  };

  // Ensure data directory exists
  await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await fs.writeFile(CACHE_PATH, JSON.stringify(cached, null, 2));

  console.log(`Generated ${result.themes.length} daily themes at ${cached.generatedAt}`);
  
  return result.themes;
}
