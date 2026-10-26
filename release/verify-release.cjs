'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
function verify(root,minimum){
  const read=name=>fs.readFileSync(path.join(root,name),'utf8');
  const release=JSON.parse(read('release/approved.json'));
  assert.equal(release.project,'prj_L5BnbdLML6hkLfPXyBZR2bABA425','Wrong website release');
  assert(Number.isSafeInteger(release.revision)&&release.revision>=minimum,'Outdated release: start from the current approved source');
  const home=read('index.html'),watches=read('watches.html'),catalog=read('api/catalog.js'),client=read('assets/js/supplier-catalog.js');
  assert.equal((home.match(/class="jc-category-video"/g)||[]).length,5,'Preserve five category videos');
  for(const marker of ['We Buy Gold','/watches.html','quick-gold-estimate','assets/js/home-refinements.js','assets/css/home-refinements.css'])assert(home.includes(marker),'Missing current homepage feature: '+marker);
  assert.equal((home.match(/class="review-card review-card-long"/g)||[]).length,6,'Preserve six reviews');
  assert(catalog.includes('const limit=home?20:24'),'Preserve 20 homepage products');
  assert(client.includes('p.brand||'),'Preserve watch brand labels');
  for(const marker of ['Richard Mille RM 030','Richard Mille RM 017','AP Royal Oak','Iced-out &amp; diamond Rolex'])assert(watches.includes(marker),'Missing watch section: '+marker);
  assert(read('design-studio.html').includes('hog-style-pick'),'Preserve the newer creator style selector');
  if(release.revision>=2026102202){assert(home.includes('/made-to-order.html'),'Preserve Made to Order discovery');assert(read('made-to-order.html').includes('mto-request'),'Preserve made-to-order requests');assert(read('assets/js/made-to-order-core.js').includes('costsConfirmed'),'Preserve confirmed-cost pricing checks');}
  if(release.revision>=2026102204){assert(home.includes('/style-lab.html#set'),'Preserve Style Lab discovery');assert(read('style-lab.html').includes('sl-request'),'Preserve set request flow');assert(read('assets/js/style-lab.js').includes('getUserMedia'),'Preserve camera preview');}
  if(release.revision>=2026102205){assert(read('style-lab.html').includes('sl-photo-browse'),'Preserve catalog-photo try-on');assert(read('assets/js/style-lab-photos.js').includes('crossOrigin'),'Preserve browser-local photo processing');}
  if(release.revision>=2026102207){assert(read('style-lab.html').includes('sl-placement'),'Preserve automatic-fit controls');assert(read('assets/js/style-lab-auto.js').includes('getItem'),'Preserve automatic neck and ring-finger placement');}
  assert(read('service-worker.js').includes(release.cacheVersion),'Cache version must match this release');
  const config=JSON.parse(read('vercel.json'));
  assert(!Object.hasOwn(config,'buildCommand'),'Do not override the project release guard');
  console.log('Hands of Gold release '+release.revision+': layout, videos, watches, creator and cache checks passed.');
  return release;
}
module.exports={verify};
if(require.main===module){try{const args=process.argv.slice(2),value=name=>args[args.indexOf(name)+1];verify(args.includes('--root')?path.resolve(value('--root')):path.resolve(__dirname,'..'),Number(args.includes('--minimum')?value('--minimum'):2026102201));}catch(error){console.error('PUBLICATION BLOCKED: '+error.message);process.exitCode=1;}}
