import Stripe from 'stripe';
import type { Request, Response } from 'express';
import type { UserProfile } from '../src/types/user';
import { findUserById, updateUserSubscription } from './db';

const planTiers = { starter: 'starter_tier', pro: 'pro_monthly', enterprise: 'enterprise_tier' } as const;
type Plan = keyof typeof planTiers;
function isPlan(value: unknown): value is Plan {
  return typeof value === 'string' && Object.hasOwn(planTiers, value);
}

function getStripeConfig() {
  const mode = process.env.STRIPE_ENVIRONMENT?.trim() || 'test';
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if ((mode !== 'test' && mode !== 'live') || !key || !secret) return;
  if (!key.startsWith(`sk_${mode}_`) && !key.startsWith(`rk_${mode}_`)) return;
  return { key, secret, live: mode === 'live' };
}

export async function createStripeCheckout(req: Request & { user?: UserProfile }, res: Response) {
  const plan = req.body?.planId ?? 'pro';
  if (!isPlan(plan)) return res.status(400).json({ success: false, error: 'Unknown plan.' });
  const cycle = req.body?.billingCycle ?? 'monthly';
  if (cycle !== 'monthly' && cycle !== 'yearly') return res.status(400).json({ success: false, error: 'Unknown billing cycle.' });
  const price = process.env[`STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`];
  const config = getStripeConfig();
  const origin = process.env.APP_ORIGIN;
  if (!price || !config || !origin) {
    return res.status(503).json({ success: false, error: 'Card checkout is not configured.' });
  }
  try {
    const base = new URL(origin);
    if (process.env.NODE_ENV === 'production' && base.protocol !== 'https:') throw new Error('HTTPS required');
    const stripe = new Stripe(config.key);
    const user = req.user!;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription', line_items: [{ price, quantity: 1 }],
      customer_email: user.email, client_reference_id: user.id,
      subscription_data: { metadata: { app: 'funnelcraft', userId: user.id, plan, cycle } },
      success_url: base.origin + '/?billing=processing', cancel_url: base.origin + '/?billing=cancelled',
    });
    return res.json({ success: true, url: session.url, sessionId: session.id });
  } catch {
    return res.status(502).json({ success: false, error: 'Card checkout is unavailable.' });
  }
}

export async function stripeWebhook(req: Request, res: Response) {
  const signature = req.get('stripe-signature');
  if (!signature || !Buffer.isBuffer(req.body)) return res.sendStatus(400);
  const config = getStripeConfig();
  if (!config) return res.sendStatus(503);
  const stripe = new Stripe(config.key);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, config.secret);
  } catch { return res.sendStatus(400); }
  if (event.livemode !== config.live) return res.sendStatus(400);
  try {
    const object = event.data.object;
    let id: string | undefined;
    if (object.object === 'checkout.session' && event.type === 'checkout.session.completed') {
      if (object.mode === 'subscription' && typeof object.subscription === 'string') id = object.subscription;
    } else if (object.object === 'subscription' && event.type.startsWith('customer.subscription.')) {
      id = object.id;
    } else if (object.object === 'invoice' && event.type === 'invoice.paid') {
      const sub = object.parent?.subscription_details?.subscription;
      if (typeof sub === 'string') id = sub;
    }
    if (!id) return res.sendStatus(200);
    // Re-read provider state so redelivery cannot add a second subscription term.
    const sub = await stripe.subscriptions.retrieve(id, { expand: ['latest_invoice'] });
    const { app, userId, plan, cycle } = sub.metadata;
    if (app !== 'funnelcraft' || !isPlan(plan) || !userId || !['monthly','yearly'].includes(cycle)) return res.sendStatus(200);
    const user = findUserById(userId);
    const item = sub.items.data[0];
    if (!user || sub.items.data.length !== 1 || item.price.id !== process.env[`STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`]) return res.sendStatus(200);
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const invoice = sub.latest_invoice;
    if (sub.status === 'active' && invoice && typeof invoice !== 'string' && invoice.status === 'paid' && invoice.amount_paid > 0) {
      const end = new Date(item.current_period_end * 1000).toISOString();
      if (Date.parse(end) > Date.now()) updateUserSubscription(userId, 'active', planTiers[plan], customerId, id, end);
    } else if (user.stripe_subscription_id === id && ['canceled','unpaid','past_due','incomplete_expired','paused'].includes(sub.status)) {
      updateUserSubscription(userId, 'free', 'free_tier', customerId, id);
    }
    return res.sendStatus(200);
  } catch { return res.sendStatus(503); }
}
