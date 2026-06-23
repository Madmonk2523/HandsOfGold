module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const publishableKey = String(process.env.STRIPE_PUBLISHABLE_KEY || '').trim();
  if (!publishableKey) {
    return res.status(500).json({ error: 'Missing STRIPE_PUBLISHABLE_KEY environment variable.' });
  }

  return res.status(200).json({
    ok: true,
    publishableKey,
  });
};
