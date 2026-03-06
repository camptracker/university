/**
 * User model — a Google OAuth authenticated user.
 *
 * Fields:
 * - googleId: String (required, unique) — Google profile ID
 * - email: String (required, unique)
 * - name: String (required) — Google display name
 * - picture: String? — Google profile photo URL
 * - role: 'user' | 'admin' (default 'user')
 *   Admin role is auto-assigned if email is in ADMIN_EMAILS env var at login.
 * - refreshToken: String? — current valid refresh token (rotated on each refresh)
 * - createdAt: Date
 *
 * Security: refreshToken and googleId are excluded from most API responses.
 */
import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  role: 'user' | 'admin';
  refreshToken?: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  googleId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  picture: String,
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  refreshToken: String,
  createdAt: { type: Date, default: Date.now },
});

export const User = mongoose.model<IUser>('User', UserSchema);
