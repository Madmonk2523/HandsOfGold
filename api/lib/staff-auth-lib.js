'use strict';
const crypto = require('crypto');
const COOKIE = 'hog_staff_session';
const MAX_AGE = 60 * 60 * 10;
function secret(){ return process.env.STAFF_SESSION_SECRET || process.env.STAFF_ACCESS_CODE || ''; }
function sign(value){ return crypto.createHmac('sha256', secret()).update(value).digest('base64url'); }
function token(){ const payload = `${Date.now() + MAX_AGE*1000}`; return `${payload}.${sign(payload)}`; }
function verify(raw){
  if(!raw || !secret()) return false;
  const match=/^(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(String(raw));if(!match)return false;
  const [,exp,sig] = match;
  const expected=sign(exp); if(expected.length!==sig.length) return false;
  if(!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(sig))) return false;
  const now=Date.now();return Number(exp)>now && Number(exp)<=now+MAX_AGE*1000+1000;
}
function cookieFrom(req){
  const cookies=String(req.headers.cookie||'').split(';');
  for(const c of cookies){ const i=c.indexOf('='); if(i>0 && c.slice(0,i).trim()===COOKIE) {try{return decodeURIComponent(c.slice(i+1).trim());}catch(_){return '';}} }
  return '';
}
function isStaff(req){return verify(cookieFrom(req));}
function requireStaff(req,res){ if(!isStaff(req)){res.status(401).json({success:false,error:'Staff sign-in required.'});return false;} return true; }
function setCookie(res,value){res.setHeader('Set-Cookie',`${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`)}
function clearCookie(res){res.setHeader('Set-Cookie',`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`)}
module.exports={token,requireStaff,isStaff,setCookie,clearCookie};
