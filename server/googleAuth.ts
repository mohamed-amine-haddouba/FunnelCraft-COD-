import { OAuth2Client } from 'google-auth-library';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

export interface VerifiedGoogleUser {
  email: string;
  emailVerified: boolean;
  fullName: string;
  picture?: string;
  googleId: string;
}

export function isGoogleAuthConfigured(): boolean {
  return client !== null;
}

export async function verifyGoogleCredential(credential: string): Promise<VerifiedGoogleUser> {
  if (!client) throw new Error('Google Sign-In is not configured.');
  if (!credential || typeof credential !== 'string') throw new Error('Invalid credential.');

  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID!,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) throw new Error('Token missing email.');
  if (!payload.email_verified) throw new Error('Email not verified.');

  return {
    email: payload.email.toLowerCase().trim(),
    emailVerified: true,
    fullName: payload.name || 'Google User',
    picture: payload.picture,
    googleId: payload.sub,
  };
}
