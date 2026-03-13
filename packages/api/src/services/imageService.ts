/**
 * Image generation and upload service.
 *
 * Exports:
 * - `generateAndUploadImage(prompt, seriesKey, sortOrder)` → Cloudinary URL
 *   Generates a 1792x1024 image via DALL-E 3, then uploads to Cloudinary at
 *   path parable/{seriesKey}/day-{sortOrder}. Returns the secure_url.
 *
 * Dependencies: OpenAI (DALL-E 3), Cloudinary v2
 * Env vars: OPENAI_API_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */
import OpenAI from 'openai';
import { v2 as cloudinary } from 'cloudinary';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

export async function generateAndUploadImage(
  prompt: string,
  seriesKey: string,
  sortOrder: number
): Promise<string> {
  // Generate with DALL-E 3 (60 second timeout)
  const response = await withTimeout(
    openai.images.generate({
      model: 'dall-e-3',
      prompt,
      size: '1024x1024',
      quality: 'standard',
      n: 1,
    }),
    60000,
    'DALL-E image generation'
  );

  const imageUrl = response.data?.[0]?.url;
  if (!imageUrl) throw new Error('No image URL from DALL-E');

  // Upload to Cloudinary (30 second timeout)
  const uploadResult = await withTimeout(
    cloudinary.uploader.upload(imageUrl, {
      folder: `parable/${seriesKey}`,
      public_id: `day-${sortOrder}`,
      overwrite: true,
    }),
    30000,
    'Cloudinary upload'
  );

  return uploadResult.secure_url;
}
