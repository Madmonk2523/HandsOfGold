const Stripe = require('stripe');

const readRawBody = async (req) => {
  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (typeof req.body === 'string') {
    return Buffer.from(req.body);
  }

  if (req.body && typeof req.body === 'object') {
    return Buffer.from(JSON.stringify(req.body));
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
};

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
  const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();

  if (!secretKey) {
    return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY environment variable.' });
  }

  if (!webhookSecret) {
    return res.status(500).json({ error: 'Missing STRIPE_WEBHOOK_SECRET environment variable.' });
  }

  const signature = String(req.headers['stripe-signature'] || '').trim();
  if (!signature) {
    return res.status(400).json({ error: 'Missing Stripe signature header.' });
  }

  try {
    const stripe = new Stripe(secretKey);
    const rawBody = await readRawBody(req);
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      console.log('Stripe checkout completed:', {
        sessionId: session.id,
        amountTotal: session.amount_total,
        currency: session.currency,
        customerEmail: session.customer_details?.email || null,
      });
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Stripe webhook handling failed:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Invalid webhook event.',
    });
  }
};
