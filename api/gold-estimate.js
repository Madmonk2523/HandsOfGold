// Preserve the existing gold estimate and checkout routes.
import redis from "./lib/redis.js";
import estimate from "./_lib/gold-estimate-core.js";
import checkout from "./_lib/checkout.js";
import leadService from "./leads.js";
import { createHash } from "node:crypto";

function unpack(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (_) { return value; }
}

async function notifyWeight(leadId, contact, values, amount) {
  const grams = Number((Number(values.weight) * (values.unit === 'dwt' ? 1.55517384 : 1)).toFixed(4));
  const karat = Number(values.karat);
  const fingerprint = createHash('sha256').update(`${leadId}:${karat}:${grams}`).digest('hex').slice(0,24);
  const key = 'hog:gold-estimate-alert:' + fingerprint;
  let record = unpack(await redis.command('GET', key));
  if (record?.emailSent && record?.smsSent) return true;
  const lock = await redis.command('SET', key + ':lock', '1', 'NX', 'EX', 30);
  if (!lock) return false;
  try {
    record = unpack(await redis.command('GET', key)) || {id:'HOG-GOLD-' + fingerprint,emailSent:false,smsSent:false};
    if (!record.stored) {
      const count = await redis.command('INCR','hog:gold-estimate-count:' + leadId);
      if (Number(count) === 1) await redis.command('EXPIRE','hog:gold-estimate-count:' + leadId,1800);
      if (Number(count) > 10) return false;
    }
    const fields = {
      leadType:'gold_calculator_estimate',name:contact.name,phone:contact.phone,
      registration_id:leadId,gold_grams:String(grams),gold_karat:String(karat),
      entered_weight:String(values.weight),entered_unit:values.unit === 'dwt' ? 'dwt' : 'grams',
      estimate_usd:Number(amount).toFixed(2),
      message:'Customer used the gold buying calculator. Estimate only; final offer after testing and weighing in store.'
    };
    if (!record.stored) {
      await redis.command('LPUSH','hog:leads',JSON.stringify({id:record.id,lead_type:fields.leadType,name:contact.name,phone:contact.phone,email:'',status:'new',created_at:new Date().toISOString(),payload:fields}));
      await redis.command('LTRIM','hog:leads','0','1999');
      record.stored = true;
      await redis.command('SET',key,JSON.stringify(record),'EX',1800);
    }
    if (!record.smsSent) {
      record.smsSent = await leadService.notifyGoldSms(fields,record.id);
      await redis.command('SET',key,JSON.stringify(record),'EX',1800);
    }
    if (!record.emailSent) {
      record.emailSent = await leadService.notifyStaff({leadId:record.id,leadType:fields.leadType,subject:'Gold Calculator Weight & Estimate — HandsOfGoldNY.com',fields});
      await redis.command('SET',key,JSON.stringify(record),'EX',1800);
    }
    return record.emailSent && record.smsSent;
  } finally {
    await redis.command('DEL',key + ':lock');
  }
}

export default async function handler(request, response) {
  if (request.query?.op === 'checkout') return checkout(request,response);
  if (request.query?.op !== 'hero') return estimate(request,response);
  response.setHeader('Cache-Control','private, no-store, max-age=0');
  if (!['GET','POST'].includes(request.method)) {
    response.setHeader('Allow','GET, POST');
    return response.status(405).json({error:'Method not allowed.'});
  }
  let values = request.query;
  if (request.method === 'POST') {
    try { values = typeof request.body === 'string' ? JSON.parse(request.body) : request.body; }
    catch (_) { return response.status(400).json({error:'Invalid calculator input.'}); }
  }
  const token = String(values?.token || '');
  if (!/^[a-f0-9]{48}$/.test(token)) return response.status(403).json({error:'Please register before using the calculator.'});
  try {
    if (!redis.configured()) throw Error('Storage unavailable');
    const leadId = await redis.command('GET','hog:gold-calculator:' + token);
    if (!leadId) return response.status(403).json({error:'Your calculator session expired. Please register again.'});
    let contact = unpack(await redis.command('GET','hog:gold-contact:' + leadId));
    // Retain access for sessions registered before this update.
    if (!contact) {
      const leads = await redis.command('LRANGE','hog:leads','0','1999');
      contact = (leads || []).map(unpack).find(lead => lead?.id === leadId);
    }
    if (!contact?.name || !contact?.phone) return response.status(403).json({error:'Please register again to send your gold details to the store.'});
    let code = 200, result;
    const capture = {
      setHeader:(name,value) => response.setHeader(name,value),
      status:value => { code = value; return capture; },
      json:value => { result = value; }
    };
    await estimate({...request,method:'GET',query:values},capture);
    if (code !== 200 || !Number.isFinite(result?.estimate)) return response.status(code).json(result);
    let alertSent = false;
    try { alertSent = await notifyWeight(leadId,contact,values,result.estimate); }
    catch (_) { console.error('[hog-gold-weight-alert] notification unavailable'); }
    return response.status(200).json({...result,alertSent});
  } catch (_) {
    return response.status(503).json({error:'Calculator unavailable. Please call (631) 264-6610.'});
  }
}
