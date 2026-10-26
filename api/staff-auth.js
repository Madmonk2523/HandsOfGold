'use strict';
const crypto=require('crypto');
const {token,setCookie,clearCookie}=require('./lib/staff-auth-lib');
const security=require('./lib/request-security');
function clean(v){return String(v||'').trim();}
function same(a,b){const A=Buffer.from(String(a)),B=Buffer.from(String(b));return A.length===B.length&&crypto.timingSafeEqual(A,B)}
module.exports=async function(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  if(['POST','DELETE'].includes(req.method)&&!security.sameOrigin(req))return res.status(403).json({success:false,error:'Open staff sign-in on this website.'});
  if(req.method==='DELETE'){clearCookie(res);return res.status(200).json({success:true});}
  if(req.method!=='POST'){res.setHeader('Allow','POST, DELETE');return res.status(405).json({success:false,error:'Method not allowed'});}
  let body;try{body=security.body(req);if(!await security.rate(req,'staff-login',10,900))return res.status(429).json({success:false,error:'Too many sign-in attempts. Try again in 15 minutes.'});}catch(_){return res.status(503).json({success:false,error:'Sign-in temporarily unavailable.'});}
  const expectedEmail=clean(process.env.STAFF_EMAIL||'HandsOfGold@handsofgold.org').toLowerCase();
  const expectedCode=clean(process.env.STAFF_ACCESS_CODE);
  const email=clean(body.email).toLowerCase(), code=clean(body.accessCode);
  if(!expectedCode) return res.status(503).json({success:false,error:'Staff access code is not configured.'});
  if(!same(email,expectedEmail)||!same(code,expectedCode)) return res.status(401).json({success:false,error:'Email or access code is incorrect.'});
  setCookie(res,token()); return res.status(200).json({success:true});
};
