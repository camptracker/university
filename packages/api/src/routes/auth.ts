/**
 * Authentication routes — mounted at /auth
 *
 * Configures Google OAuth 2.0 strategy via passport-google-oauth20.
 * Admin role is assigned if the Google profile email is in ADMIN_EMAILS env var.
 *
 * Routes:
 * - GET  /auth/google           — redirect to Google consent page
 * - GET  /auth/google/callback  — OAuth callback; issues JWT pair; sets httpOnly refresh cookie;
 *   redirects to CLIENT_URL/auth/callback?token=<accessToken>
 * - POST /auth/refresh          — reads 'refreshToken' cookie; rotates tokens; returns {accessToken, user}
 * - POST /auth/logout           — clears refresh cookie; removes token from User doc
 *
 * Token details: accessToken expires 15min, refreshToken expires 30d (httpOnly, path=/auth).
 * Refresh tokens are validated against the stored value in User.refreshToken (rotation).
 *
 * Dependencies: generateTokens, verifyRefreshToken (auth middleware), User model, passport
 */
import { Router, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { User } from '../models/User.js';
import { generateTokens, verifyRefreshToken } from '../middleware/auth.js';

const router = Router();

// Configure Google Strategy
passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: process.env.NODE_ENV === 'production'
      ? `${process.env.API_URL}/auth/google/callback`
      : 'http://localhost:3001/auth/google/callback',
  },
  async (_accessToken, _refreshToken, profile: Profile, done) => {
    try {
      const email = profile.emails?.[0]?.value || '';
      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
      const role = adminEmails.includes(email) ? 'admin' : 'user';

      let user = await User.findOne({ googleId: profile.id });
      if (user) {
        user.name = profile.displayName;
        user.picture = profile.photos?.[0]?.value;
        if (role === 'admin') user.role = 'admin';
        await user.save();
      } else {
        user = await User.create({
          googleId: profile.id,
          email,
          name: profile.displayName,
          picture: profile.photos?.[0]?.value,
          role,
        });
      }
      return done(null, user as unknown as Express.User);
    } catch (err) {
      return done(err as Error);
    }
  }
));

router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false,
}));

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login-failed' }),
  async (req: Request, res: Response) => {
    const dbUser = req.user as unknown as { _id: unknown; email: string; role: string };
    if (!dbUser) {
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=auth_failed`);
      return;
    }

    const { accessToken, refreshToken } = generateTokens(
      String(dbUser._id),
      dbUser.email,
      dbUser.role
    );

    // Save refresh token to user
    await User.findByIdAndUpdate(dbUser._id, { refreshToken });

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/auth',
    });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/auth/callback?token=${accessToken}`);
  }
);

router.post('/refresh', async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }

  const result = await verifyRefreshToken(token);
  if (!result) {
    res.status(401).json({ error: 'Invalid refresh token' });
    return;
  }

  const user = await User.findById(result.userId);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  const { accessToken, refreshToken } = generateTokens(
    String(user._id),
    user.email,
    user.role
  );

  await User.findByIdAndUpdate(user._id, { refreshToken });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/auth',
  });

  res.json({ accessToken, user: { id: user._id, email: user.email, name: user.name, picture: user.picture, role: user.role } });
});

router.post('/logout', async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    await User.updateOne({ refreshToken: token }, { $unset: { refreshToken: 1 } });
  }
  res.clearCookie('refreshToken', { path: '/auth' });
  res.json({ ok: true });
});

export default router;
