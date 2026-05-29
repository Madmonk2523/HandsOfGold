const nodemailer = require('nodemailer');

const configuredEmail = 'handsofgold@handsofgold.org';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sanitize = (value) => String(value || '').replace(/[\r\n\t]/g, ' ').trim();
const normalizeAppPassword = (value) => String(value || '').replace(/[\s_-]+/g, '').trim();
const readEnv = (...keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (value) {
      return value;
    }
  }

  return '';
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
    formStart,
    website,
    utmSource,
    purity,
    weight,
    estimatedOffer,
    photoName,
    photoDataUrl,
    photoType,
    leadType,
  } = req.body || {};

  const safeName = sanitize(name);
  const safeEmail = sanitize(email);
  const safePhone = sanitize(phone);
  const safePageUrl = sanitize(pageUrl);
  const safeWebsite = sanitize(website);
  const safeUtmSource = sanitize(utmSource);
  const safePurity = sanitize(purity);
  const safeWeight = sanitize(weight);
  const safeEstimatedOffer = sanitize(estimatedOffer);
  const safePhotoName = sanitize(photoName);
  const safePhotoType = sanitize(photoType);
  const safeLeadType = sanitize(leadType) || 'Website Lead';
  const rawPhotoDataUrl = String(photoDataUrl || '').trim();
  const formStartTime = Number(formStart);
  const fillMs = Number.isFinite(formStartTime) ? Date.now() - formStartTime : null;
  const fillSeconds = fillMs === null ? null : Math.max(0, fillMs / 1000);

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

  const isGoldBuyingLead = safeLeadType.toLowerCase().includes('gold');
  const senderEmail = isGoldBuyingLead
    ? sanitize(readEnv('GOLD_EMAIL_USER', 'GOLD_SENDER_EMAIL', 'GOLD_EMAIL_ADDRESS')) || configuredEmail
    : configuredEmail;
  const receiverEmail = isGoldBuyingLead
    ? sanitize(readEnv('GOLD_TO_EMAIL', 'GOLD_RECEIVER_EMAIL', 'GOLD_INBOX_EMAIL')) || senderEmail
    : configuredEmail;
  const emailPass = isGoldBuyingLead
    ? normalizeAppPassword(readEnv('GOLD_EMAIL_PASS', 'GOLD_GMAIL_APP_PASSWORD', 'EMAIL_PASS', 'GMAIL_APP_PASSWORD'))
    : normalizeAppPassword(readEnv('EMAIL_PASS', 'GMAIL_APP_PASSWORD'));

  if (!emailPass) {
    return res.status(500).json({
      error: isGoldBuyingLead
        ? 'Missing GOLD_EMAIL_PASS (or GOLD_GMAIL_APP_PASSWORD) environment variable.'
        : 'Missing EMAIL_PASS (or GMAIL_APP_PASSWORD) environment variable.',
    });
  }

  if (emailPass.length !== 16) {
    return res.status(500).json({
      error: isGoldBuyingLead
        ? 'GOLD_EMAIL_PASS must be a valid 16-character Gmail app password.'
        : 'EMAIL_PASS must be a valid 16-character Gmail app password.',
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: senderEmail,
        pass: emailPass,
      },
    });

    await transporter.verify();

    const timestamp = new Date().toISOString();
    const subjectLine = isGoldBuyingLead ? 'New Gold Buying Offer - Hands Of Gold NY' : 'New Lead - Hands Of Gold NY';

    const textLines = [
      `Lead Type: ${safeLeadType}`,
      `Name: ${safeName}`,
      `Email: ${safeEmail}`,
      `Phone: ${safePhone}`,
      `Time: ${timestamp}`,
      `Page: ${safePageUrl || 'Unknown'}`,
      `UTM Source: ${safeUtmSource || 'direct'}`,
      `Fill Time (seconds): ${fillSeconds === null ? 'Unknown' : fillSeconds.toFixed(1)}`,
    ];

    if (safePurity) {
      textLines.push(`Purity: ${safePurity}`);
    }

    if (safeWeight) {
      textLines.push(`Weight: ${safeWeight}`);
    }

    if (safeEstimatedOffer) {
      textLines.push(`Estimated Offer: ${safeEstimatedOffer}`);
    }

    const attachments = [];
    if (rawPhotoDataUrl) {
      const photoMatch = rawPhotoDataUrl.match(/^data:(.+);base64,(.+)$/);
      if (photoMatch) {
        attachments.push({
          filename: safePhotoName || 'gold-item-photo',
          content: photoMatch[2],
          encoding: 'base64',
          contentType: safePhotoType || photoMatch[1],
        });
        textLines.push(`Photo Attached: ${safePhotoName || 'Yes'}`);
      }
    }

    const textBody = textLines.join('\n');

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;max-width:620px;">
        <h2 style="margin:0 0 14px;">${subjectLine}</h2>
        <p style="margin:0 0 10px;"><strong>Lead Type:</strong> ${safeLeadType}</p>
        <p style="margin:0 0 10px;"><strong>Name:</strong> ${safeName}</p>
        <p style="margin:0 0 10px;"><strong>Email:</strong> ${safeEmail}</p>
        <p style="margin:0 0 10px;"><strong>Phone:</strong> ${safePhone}</p>
        <p style="margin:0 0 10px;"><strong>Time:</strong> ${timestamp}</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:16px 0;" />
        <p style="margin:0 0 8px;"><strong>Page:</strong> ${safePageUrl || 'Unknown'}</p>
        <p style="margin:0 0 8px;"><strong>UTM Source:</strong> ${safeUtmSource || 'direct'}</p>
        <p style="margin:0 0 8px;"><strong>Fill Time (seconds):</strong> ${fillSeconds === null ? 'Unknown' : fillSeconds.toFixed(1)}</p>
        ${safePurity ? `<p style="margin:0 0 8px;"><strong>Purity:</strong> ${safePurity}</p>` : ''}
        ${safeWeight ? `<p style="margin:0 0 8px;"><strong>Weight:</strong> ${safeWeight}</p>` : ''}
        ${safeEstimatedOffer ? `<p style="margin:0 0 8px;"><strong>Estimated Offer:</strong> ${safeEstimatedOffer}</p>` : ''}
        ${attachments.length ? `<p style="margin:0 0 8px;"><strong>Photo Attached:</strong> ${safePhotoName || 'Yes'}</p>` : ''}
      </div>
    `;

    await transporter.sendMail({
      from: senderEmail,
      to: receiverEmail,
      subject: subjectLine,
      text: textBody,
      html: htmlBody,
      replyTo: safeEmail,
      attachments,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Lead email send failed:', error);

    if (error && typeof error === 'object' && error.code === 'EAUTH') {
      return res.status(500).json({
        error: isGoldBuyingLead
          ? `Email authentication failed. Confirm the app password matches ${senderEmail}.`
          : `Email authentication failed. Confirm EMAIL_PASS matches the app password for ${senderEmail}.`,
      });
    }

    if (error && typeof error === 'object' && (error.code === 'ESOCKET' || error.code === 'ETIMEDOUT')) {
      return res.status(500).json({ error: 'Email server connection timed out. Please try again in a moment.' });
    }

    return res.status(500).json({ error: 'Failed to send lead. Verify server email configuration and try again.' });
  }
};
