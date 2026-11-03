import { OAuth2Client } from 'google-auth-library';

// Read configuration when authentication is requested, after dotenv has loaded.
function getGoogleClient(): { client: OAuth2Client; clientId: string } | null {
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  return clientId ? { client: new OAuth2Client(clientId), clientId } : null;
}

export interface VerifiedGoogleUser {
  email: string;
  emailVerified: boolean;
  fullName: string;
  picture?: string;
  googleId: string;
}

export function isGoogleAuthConfigured(): boolean {
  return getGoogleClient() !== null;
}

export async function verifyGoogleCredential(credential: string): Promise<VerifiedGoogleUser> {
  const configured = getGoogleClient();
  if (!configured) throw new Error('Google Sign-In is not configured.');
  if (!credential || typeof credential !== 'string') throw new Error('Invalid credential.');

  const ticket = await configured.client.verifyIdToken({
    idToken: credential,
    audience: configured.clientId,
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
