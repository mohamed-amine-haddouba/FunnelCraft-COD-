import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { createUser, createSession, deleteUser, findUserById, getAllOrders, getPublishedPageBySlug, getUserByToken, publishPage, recordCodOrder, saveUserPage, setUserEmailVerifiedState, updateUserAccountStatus } from './db';
import { getPayment, savePayment, settlePayment } from './paypalLedger';
import { validateProductUrl, isPublicAddress } from './publicFetch';
import { generateStandaloneHtml } from '../src/utils/htmlExporter';
import { app, startServer } from '../server';

test('Tenant boundaries, payment verification and published offers through the API', async (t) => {
  process.env.BYPASS_CAPTCHA = 'true';
  const a = createUser(randomUUID() + '@example.org', 'Test!pass123', 'A', 'Same store');
  const b = createUser(randomUUID() + '@example.org', 'Test!pass123', 'B', 'Same store');
  setUserEmailVerifiedState(a.id, true); setUserEmailVerifiedState(b.id, true);
  const tokenA = createSession(a.id), tokenB = createSession(b.id);
  const page = saveUserPage(a.id, { title: 'Fixture', slug: 'fixture-' + randomUUID(), data: { blocks: [{ type: 'cod-form', currency:'MAD', shippingCost:20, bundles: [{id:'item-1', price:199, quantity:1}] }] } }).page;
  assert.equal(getPublishedPageBySlug(page.slug), null);
  publishPage(a.id, page.id, page.slug);
  await startServer();
  const server = createServer(app);
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(ok => server.close(() => ok())); deleteUser(a.id); deleteUser(b.id); });
  const addr = server.address() as { port: number };
  const request = async (route: string, body?: object, token?: string, method?: string) => {
    const response = await fetch('http://127.0.0.1:' + addr.port + route, {
      method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, json: await response.json().catch(() => ({})) };
  };
  const orderData = { pageSlug: page.slug, bundleId: 'item-1', phone:'0600000000', customerName:'Example', price:1, status:'paid', userId:b.id };
  const order = await request('/api/orders', orderData);
  assert.equal(order.status,200); assert.equal(order.json.total,219);
  const id = order.json.orderId;
  const stored = getAllOrders().find(o => o.id === id)!;
  assert.equal(stored.userId,a.id); assert.equal(stored.status,'pending');
  assert.equal((await request('/api/orders', undefined, tokenB)).json.orders.some((o: {id:string}) => o.id === id), false);
  assert.equal((await request('/api/orders/' + encodeURIComponent(id), {status:'delivered'}, tokenB, 'PATCH')).status,403);
  assert.equal((await request('/api/orders/' + encodeURIComponent(id), {status:'confirmed'}, tokenA, 'PATCH')).status,200);
  assert.equal((await request('/api/orders', {...orderData, paymentMethod:'paypal'})).status,400);
  assert.equal((await request('/api/orders/submit', {...orderData, pageSlug:'missing-page'})).status,400);
  assert.equal((await request('/api/billing/webhook', {type:'checkout.session.completed', data:{object:{client_reference_id:b.id}}})).status,400);
  assert.equal((await request('/api/billing/simulate-upgrade', {}, tokenB)).status,410);
  assert.equal((await request('/api/billing/create-checkout-session', {planId:'enterprise'}, tokenB)).status,503);
  assert.equal(findUserById(b.id)?.plan_id,'free');
  assert.equal((await request('/api/ai/generate', {productName:'Mug'})).status,401);
  assert.equal((await request('/api/ai/generate', {productName:'Mug'}, tokenB)).status,403);
  assert.equal((await request('/api/auth/send-otp', {userId:b.id})).status,401);
  assert.equal((await request('/api/pages/check-slug?slug=unused-test')).json.available,true);
  updateUserAccountStatus(b.id,'suspended');
  assert.equal(getUserByToken(tokenB),undefined);
  updateUserAccountStatus(b.id,'active');
  assert.equal((await request('/api/orders',undefined,tokenB)).status,401);
  process.env.STRIPE_SECRET_KEY = 'sk_test_fixture';
  process.env.STRIPE_WEBHOOK_SECRET = 'fixture-signing-secret';
  const payload = JSON.stringify({ id: 'evt_fixture', type: 'customer.created', data: {object: {object:'customer'}} });
  const signature = Stripe.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_WEBHOOK_SECRET});
  const webhook = async (body:string) => (await fetch('http://127.0.0.1:' + addr.port + '/api/billing/webhook', { method:'POST', headers:{'content-type':'application/json','stripe-signature':signature},body })).status;
  assert.equal(await webhook(payload),200);
  assert.equal(await webhook(payload + ' '),400);
});

test('Persistent PayPal checkout accepts only the quoted capture and grants the purchased plan once', () => {
  const user = createUser(randomUUID() + '@example.org','Test!pass123','Buyer');
  const id = 'fixture-' + randomUUID();
  savePayment(id, { userId:user.id, sourceType:'plan', planId:'starter', identifier:'plan:starter:monthly', billingCycle:'monthly', expectedAmount:'10.00',expectedCurrency:'USD',priceMAD:99,originalPriceMAD:99,discountAmountMAD:0,createdAt:Date.now() });
  const capture = {id:'capture-1',status:'COMPLETED',amount:'10.00',currency:'USD',time:new Date().toISOString()};
  assert.throws(() => settlePayment(id,{...capture,amount:'1.00'}));
  assert.throws(() => settlePayment(id,{...capture,currency:'MAD'}));
  assert.equal(findUserById(user.id)?.plan_id,'free');
  const first = settlePayment(id,capture)!;
  assert.equal(first.plan_id,'starter');
  const retry = settlePayment(id,{...capture,time:new Date(Date.now()+86400000).toISOString()})!;
  assert.equal(retry.current_period_end,first.current_period_end);
  assert.equal(getPayment(id)?.captureId,capture.id);
  deleteUser(user.id);
});

test('More than 500 persisted orders keep the oldest record', () => {
  const first = recordCodOrder({phone:'0000',customerName:'Retention fixture',price:1});
  for(let i=0;i<500;i++) recordCodOrder({phone:'0000',customerName:'Retention fixture',price:1});
  assert.ok(getAllOrders().some(o=>o.id===first.id));
});

test('Non-public URL forms and unsafe HTML values cannot pass their respective boundaries', () => {
  for (const url of ['http://127.0.0.2/', 'http://0x7f000001/', 'http://[::1]/', 'http://[fd00::1]/', 'http://[::ffff:127.0.0.1]/', 'file:///etc/passwd', 'https://user:pass@example.org/'])
    assert.equal(validateProductUrl(url).isValid, false, url);
  assert.equal(isPublicAddress('10.20.30.40'),false); assert.equal(isPublicAddress('93.184.216.34'),true);
  const marker = '</script><script>window.marker=true</script>';
  const html = generateStandaloneHtml({title:'Fixture',theme:{primaryColor:marker},blocks:[],language:'en'} as never);
  assert.ok(!html.includes(marker));
});
