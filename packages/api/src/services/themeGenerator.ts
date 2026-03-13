/**
 * Theme Generator Service
 * 
 * Generates daily timeless themes that reflect current events, transformations,
 * values, and beliefs happening today. Uses Claude to research best practices
 * and create quality themes with credible sources.
 * 
 * Themes are stored in MongoDB (DailyThemes collection) for persistence across deploys.
 */
import Anthropic from '@anthropic-ai/sdk';
import { DailyThemes } from '../models/DailyThemes.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface DailyTheme {
  emoji: string;
  title: string;
  topic: string;
}

export async function generateDailyThemes(): Promise<DailyTheme[]> {
  const systemPrompt = `You are a theme generation expert who creates timeless, compelling learning themes that follow the formula: [Topic] + [Insight about the topic].

A theme is the core message or truth about life that a story is trying to show. It's not the plot—it's the lesson or insight the reader walks away with.

THE FORMULA:
A strong theme = [Topic] + [Insight about the topic]

Examples of strong themes:
• Greed destroys relationships.
• Courage grows when people face fear.
• Money cannot replace genuine friendship.
• Forgiveness brings freedom.
• Hard work and perseverance create opportunity.
• Love requires sacrifice.
• Power corrupts those who seek control.
• Family loyalty can overcome hardship.
• Wealth without relationships leads to emptiness.

❌ WEAK (single words): Love, Power, Family
✅ STRONG (complete ideas): Love requires sacrifice. Power corrupts those who seek control. Family loyalty can overcome hardship.

Your themes should:
1. Be universal truths that apply to real life
2. Be clear and concise (usually 1 sentence)
3. Avoid instructions (not "You should help others" but "Helping others gives life meaning")
4. Reflect timeless wisdom yet feel relevant to today's world
5. Cover diverse areas: relationships, success, ethics, personal growth, society, work, health, meaning

Today's date: ${new Date().toISOString().split('T')[0]}

Generate 8 themes using the [Topic] + [Insight] formula.`;

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
                  description: 'Complete theme statement following [Topic] + [Insight] formula. Example: "Greed destroys relationships." This will be used as the series topic.'
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
    messages: [{ role: 'user', content: 'Generate 8 timeless themes using the [Topic] + [Insight] formula. Each theme should be a complete statement (e.g., "Courage grows when people face fear" not just "Courage"). Make them feel relevant to what people are experiencing today.' }],
    system: systemPrompt,
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!toolUse) throw new Error('No tool use found in response');

  const result = toolUse.input as { themes: DailyTheme[] };
  
  // Save to MongoDB (upsert to ensure only one document exists)
  await DailyThemes.findOneAndUpdate(
    {}, // Match any document
    { 
      themes: result.themes,
      generatedAt: new Date(),
    },
    { 
      upsert: true, 
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  console.log(`Generated and saved ${result.themes.length} daily themes to database`);
  
  return result.themes;
}
