// Integration checks against the local demo. Creates and removes only its own test table/bills.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const env=Object.fromEntries(fs.readFileSync(path.join(root,'.env'),'utf8').trim().split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).replace(/^\uFEFF/,''),l.slice(i+1)];}));
const base=`http://localhost:${env.APP_PORT||8088}`;
let cookie='',csrf='',tableId,originalSettings;
const billIds=[];
function sql(statement){const result=spawnSync('C:/Program Files/PostgreSQL/17/bin/psql.exe',['-h','localhost','-p','5432','-U','postgres','-d','db_order_demo','-w','-v','ON_ERROR_STOP=1','-c',statement],{env:{...process.env,PGPASSWORD:env.DB_PASSWORD},encoding:'utf8'});if(result.status!==0)throw new Error(result.stderr);}
async function request(url,body,{noCsrf=false,anonymous=false}={}){
 const headers={};if(!anonymous)headers.Cookie=cookie;
 if(body!==undefined){headers['Content-Type']='application/json';if(!noCsrf)headers['X-CSRF-TOKEN']=csrf;}
 const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});
 if(!anonymous&&r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];
 return r;
}
async function json(url,body){const r=await request(url,body);const text=await r.text();assert.equal(r.status,200,`${url}: ${text}`);return JSON.parse(text);}
function settingsInput(s){return {name:s.name,vatIncluded:s.vat_included,vatRate:Number(s.vat_rate),penalty:Number(s.penalty),durationMinutes:s.duration_minutes,paperWidth:Number(s.paper_width),paperMargin:Number(s.paper_margin),publicBaseUrl:s.public_base_url};}
(async()=>{
 try{
  const unauth=await request('/api/admin/state',undefined,{anonymous:true});assert.equal(unauth.status,302);
  const login=await request('/login');const html=await login.text();csrf=html.match(/name="_csrf"[^>]*value="([^"]+)"/)[1];
  const signed=await fetch(base+'/login',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:env.ADMIN_USERNAME||'admin',password:env.ADMIN_PASSWORD,_csrf:csrf}),redirect:'manual'});
  assert.equal(signed.status,302);assert.equal(signed.headers.get('location'),base+'/admin');cookie=signed.headers.get('set-cookie').split(';')[0];
  const admin=await request('/admin');const adminHtml=await admin.text();csrf=adminHtml.match(/name="_csrf" content="([^"]+)"/)[1];
  if(process.argv.includes('--auth-only')){assert.equal(admin.status,200);await json('/api/admin/state');console.log('PASS: configured admin credentials, login session and protected admin API');return;}
  let state=await json('/api/admin/state');originalSettings=settingsInput(state.settings);
  const blocked=await request('/api/admin/tables',{name:'forbidden',capacity:6,active:true},{noCsrf:true});assert.equal(blocked.status,403);
  const invalid=await request('/api/admin/packages',{name:'',adultPrice:-1,childPrice:0,active:true,version:0});assert.equal(invalid.status,400);
  const badPaper=await request('/api/admin/settings',{...originalSettings,paperWidth:80,paperMargin:40});assert.equal(badPaper.status,409);
  const name='QA-'+Date.now();await json('/api/admin/tables',{name,capacity:6,active:true});state=await json('/api/admin/state');tableId=state.tables.find(t=>t.name===name).id;
  const standard=state.packages.find(p=>p.active&&p.adult_price!=null&&p.child_price!=null),adult={...standard,price:standard.adult_price},child={...standard,price:standard.child_price};assert(standard,'An active package with both prices required');
  await json('/api/admin/settings',{...originalSettings,vatIncluded:true,vatRate:7});
  const input={tableId,durationMinutes:90,requestKey:crypto.randomUUID(),packageId:standard.id,adultQuantity:2,childQuantity:3};
  const b=await json('/api/admin/bills',input);billIds.push(b.id);
  assert.equal(Number(b.total),Number(adult.price)*2+Number(child.price)*3);assert.equal(b.lines.length,2);
  assert.equal((new Date(b.ends_at)-new Date(b.opened_at))/60000,90);assert.equal(b.expired,false);
  const repeated=await json('/api/admin/bills',input);assert.equal(repeated.id,b.id);
  const busy=await request('/api/admin/bills',{...input,requestKey:crypto.randomUUID()});assert.equal(busy.status,409);
  const editBusy=await request('/api/admin/tables/'+tableId,{name,capacity:6,active:true});assert.equal(editBusy.status,409);
  const qr=await request(`/admin/bills/${b.id}/qr`);assert.equal(qr.status,200);const bytes=Buffer.from(await qr.arrayBuffer());assert.equal(bytes.subarray(1,4).toString(),'PNG');
  const receipt=await request(`/admin/bills/${b.id}/receipt`);assert.equal(receipt.status,200);assert((await receipt.text()).includes('ใบเปิดบิล'));
  const customer=await request('/order/'+b.qr_token,undefined,{anonymous:true});assert.equal(customer.status,200);assert((await customer.text()).includes('ยินดีต้อนรับ'));
  await json('/api/admin/settings',{...originalSettings,vatIncluded:false,vatRate:10});const unchanged=await json('/api/admin/bills/'+b.id);assert.equal(Number(unchanged.total),Number(b.total));assert.equal(Number(unchanged.vat_rate),7);
  sql(`UPDATE bills SET opened_at=now()-interval '100 minutes',ends_at=now()-interval '10 minutes' WHERE id=${b.id};`);
  const expired=await json('/api/admin/bills/'+b.id);assert.equal(expired.expired,true);assert.equal(expired.status,'OPEN');
  const expiredPage=await request('/order/'+b.qr_token,undefined,{anonymous:true});assert((await expiredPage.text()).includes('หมดเวลาสั่งอาหารแล้ว'));
  const paid=await json(`/api/admin/bills/${b.id}/checkout`,{applyPenalty:false,paymentMethod:'CASH'});assert.equal(paid.status,'PAID');assert.equal(Number(paid.paid_total),Number(b.total));
  const doublePay=await request(`/api/admin/bills/${b.id}/checkout`,{applyPenalty:true,paymentMethod:'CASH'});assert.equal(doublePay.status,409);
  const closedPage=await request('/order/'+b.qr_token,undefined,{anonymous:true});assert((await closedPage.text()).includes('บิลนี้สิ้นสุดแล้ว'));
  const b2=await json('/api/admin/bills',{...input,requestKey:crypto.randomUUID()});billIds.push(b2.id);assert.notEqual(b2.qr_token,b.qr_token);
  assert.equal(Number(b2.total),Math.round((Number(adult.price)*2+Number(child.price)*3)*1.1*100)/100);
  const paid2=await json(`/api/admin/bills/${b2.id}/checkout`,{applyPenalty:true,paymentMethod:'TRANSFER'});assert.equal(Number(paid2.paid_total),Number(b2.total)+Number(b2.penalty_rate));
  const race=await Promise.all([request('/api/admin/bills',{...input,requestKey:crypto.randomUUID()}),request('/api/admin/bills',{...input,requestKey:crypto.randomUUID()})]);
  assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);for(const r of race)if(r.status===200)billIds.push((await r.json()).id);
  console.log('PASS: auth, CSRF, validation, VAT modes, snapshots, one package with adult/child prices, idempotency, concurrent opening, QR, receipt, expiry, penalty waiver, payment, new QR after close');
 }finally{
  if(originalSettings&&csrf)await json('/api/admin/settings',originalSettings);
  if(tableId){sql(`BEGIN; DELETE FROM bill_lines WHERE bill_id IN (SELECT id FROM bills WHERE table_id=${tableId}); DELETE FROM bills WHERE table_id=${tableId}; DELETE FROM dining_tables WHERE id=${tableId}; COMMIT;`);}
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
