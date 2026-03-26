const nodemailer = require('nodemailer');

const senderEmail = 'chasemallor@gmail.com';
const receiverEmail = 'chasemallor@gmail.com';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sanitize = (value) => String(value || '').replace(/[\r\n\t]/g, ' ').trim();

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }

  return req.socket?.remoteAddress || 'unknown';
};

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    name,
    email,
    phone,
    pageUrl,
    utmSource,
    formStart,
    website,
  } = req.body || {};

  const safeName = sanitize(name);
  const safeEmail = sanitize(email);
  const safePhone = sanitize(phone);
  const safePageUrl = sanitize(pageUrl);
  const safeUtmSource = sanitize(utmSource) || 'direct';
  const safeWebsite = sanitize(website);
  const formStartTime = Number(formStart);
  const fillMs = Number.isFinite(formStartTime) ? Date.now() - formStartTime : null;

  if (!safeName || !safeEmail || !safePhone) {
    return res.status(400).json({ error: 'Name, email, and phone are required.' });
  }

  if (!emailPattern.test(safeEmail)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  const phoneDigits = safePhone.replace(/\D/g, '');
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    return res.status(400).json({ error: 'Invalid phone number.' });
  }

  if (safeWebsite) {
    return res.status(200).json({ ok: true });
  }

  if (fillMs !== null && fillMs < 1200) {
    return res.status(429).json({ error: 'Please slow down and try again.' });
  }

  if (!process.env.EMAIL_PASS) {
    return res.status(500).json({ error: 'Missing EMAIL_PASS environment variable.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: senderEmail,
        pass: process.env.EMAIL_PASS,
      },
    });

    const timestamp = new Date().toISOString();
    const clientIp = getClientIp(req);
    const userAgent = sanitize(req.headers['user-agent']);

    const textBody = [
      `Name: ${safeName}`,
      `Email: ${safeEmail}`,
      `Phone: ${safePhone}`,
      `Time: ${timestamp}`,
      `Page: ${safePageUrl || 'Unknown'}`,
      `UTM Source: ${safeUtmSource}`,
      `Fill Time (ms): ${fillMs === null ? 'Unknown' : fillMs}`,
      `IP: ${clientIp}`,
      `User Agent: ${userAgent || 'Unknown'}`,
    ].join('\n');

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;max-width:620px;">
        <h2 style="margin:0 0 14px;">New Lead - Hands Of Gold NY</h2>
        <p style="margin:0 0 10px;"><strong>Name:</strong> ${safeName}</p>
        <p style="margin:0 0 10px;"><strong>Email:</strong> ${safeEmail}</p>
        <p style="margin:0 0 10px;"><strong>Phone:</strong> ${safePhone}</p>
        <p style="margin:0 0 10px;"><strong>Time:</strong> ${timestamp}</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:16px 0;" />
        <p style="margin:0 0 8px;"><strong>Page:</strong> ${safePageUrl || 'Unknown'}</p>
        <p style="margin:0 0 8px;"><strong>UTM Source:</strong> ${safeUtmSource}</p>
        <p style="margin:0 0 8px;"><strong>Fill Time (ms):</strong> ${fillMs === null ? 'Unknown' : fillMs}</p>
        <p style="margin:0 0 8px;"><strong>IP:</strong> ${clientIp}</p>
        <p style="margin:0 0 8px;"><strong>User Agent:</strong> ${userAgent || 'Unknown'}</p>
      </div>
    `;

    await transporter.sendMail({
      from: senderEmail,
      to: receiverEmail,
      subject: 'New Lead - Hands Of Gold NY',
      text: textBody,
      html: htmlBody,
      replyTo: safeEmail,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Lead email send failed:', error);
    return res.status(500).json({ error: 'Failed to send lead.' });
  }
};
