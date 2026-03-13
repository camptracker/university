#!/usr/bin/env node
/**
 * Manual trigger for daily theme generation via API key
 * Usage: node trigger-themes.mjs [--url https://your-app.up.railway.app]
 */

const BASE_URL = process.argv.includes('--url') 
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'https://accomplished-happiness-production-0647.up.railway.app';

const API_KEY = 'parable-theme-generator-2026';

async function triggerThemes() {
  try {
    console.log('🎨 Triggering theme generation...');
    
    const genRes = await fetch(`${BASE_URL}/api/themes/generate`, {
      method: 'POST',
      headers: {
        'X-Api-Key': API_KEY
      }
    });
    
    if (!genRes.ok) {
      const error = await genRes.text();
      throw new Error(`Theme generation failed: ${genRes.status} ${error}`);
    }
    
    const result = await genRes.json();
    console.log('\n✅ Theme generation successful!\n');
    console.log('Generated at:', result.generatedAt);
    console.log('\nNew themes:');
    result.themes.forEach((theme, i) => {
      console.log(`${i + 1}. ${theme}`);
    });
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

triggerThemes();
