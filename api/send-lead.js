const nodemailer = require('nodemailer');

const senderEmail = 'handsofgoldlongisland@gmail.com';
const receiverEmail = 'handsofgoldlongisland@gmail.com';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sanitize = (value) => String(value || '').replace(/[\r\n\t]/g, ' ').trim();

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
    const isGoldBuyingLead = safeLeadType.toLowerCase().includes('gold');
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
    return res.status(500).json({ error: 'Failed to send lead.' });
  }
};
