/**
 * Run theme generation on Railway
 */
import { generateDailyThemes } from './packages/api/dist/services/themeGenerator.js';
import mongoose from 'mongoose';

async function main() {
  try {
    // Connect to MongoDB using Railway env var
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const themes = await generateDailyThemes();
    console.log('Generated themes:', themes);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();
