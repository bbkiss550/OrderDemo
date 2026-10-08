const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),env=Object.fromEntries(fs.readFileSync(path.join(root,'.env'),'utf8').trim().split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).replace(/^\uFEFF/,''),l.slice(i+1)];}));
const base=`http://localhost:${env.APP_PORT||8088}`;let cookie='',csrf='',tableId,categoryId;const planIds=[];
function sql(text){const r=spawnSync('C:/Program Files/PostgreSQL/17/bin/psql.exe',['-h','localhost','-U','postgres','-d','db_order_demo','-w','-v','ON_ERROR_STOP=1','-c',text],{encoding:'utf8',env:{...process.env,PGPASSWORD:env.DB_PASSWORD}});if(r.status!==0)throw Error(r.stderr);}
async function request(url,body,{noCsrf=false}={}){const headers={Cookie:cookie};if(body!==undefined){headers['Content-Type']='application/json';if(!noCsrf)headers['X-CSRF-TOKEN']=csrf;}const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return r;}
async function json(url,body){const r=await request(url,body),text=await r.text();assert.equal(r.status,200,`${url}: ${text}`);return JSON.parse(text);}
async function error(url,body,status,options){const r=await request(url,body,options);assert.equal(r.status,status,await r.text());}
(async()=>{try{
 const h=await (await request('/login')).text();csrf=h.match(/name="_csrf"[^>]*value="([^"]+)"/)[1];
 const signed=await fetch(base+'/login',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:env.ADMIN_USERNAME,password:env.ADMIN_PASSWORD,_csrf:csrf}),redirect:'manual'});assert.equal(signed.status,302);cookie=signed.headers.get('set-cookie').split(';')[0];
 const html=await (await request('/admin/packages')).text();csrf=html.match(/name="_csrf" content="([^"]+)"/)[1];
 const prefix='QA-PKG-'+Date.now();const a={name:prefix+'A',adultPrice:399,childPrice:199,active:true,version:0},b={...a,name:prefix+'B',adultPrice:599,childPrice:399};
 const p1=(await json('/api/admin/packages',a)).id;planIds.push(p1);const p2=(await json('/api/admin/packages',b)).id;planIds.push(p2);
 await error('/api/admin/packages',a,409);await error('/api/admin/packages',{...a,name:prefix+'invalid',adultPrice:-1},400);
 await json('/api/admin/tables',{name:prefix,capacity:8,active:true});let state=await json('/api/admin/state');tableId=state.tables.find(t=>t.name===prefix).id;
 const opening={tableId,packageId:p1,adultQuantity:2,childQuantity:3,durationMinutes:90,requestKey:crypto.randomUUID()};
 await error('/api/admin/bills',{...opening,adultQuantity:0,childQuantity:0},409);
 await error('/api/admin/bills',{...opening,adultQuantity:-1},400);
 await error('/api/admin/bills',{...opening,childQuantity:101},400);
 await error('/api/admin/bills',{...opening,adultQuantity:9,childQuantity:0},409);
 await error('/api/admin/bills',{...opening,packageId:[p1,p2]},400);
 await error('/api/admin/bills',{...opening,packageIds:[p1,p2]},400);
 await error('/api/admin/bills',{...opening,lines:[{packageId:p1,quantity:2},{packageId:p2,quantity:3}]},400);
 await json('/api/admin/packages/'+p2,{...b,active:false});await error('/api/admin/bills',{...opening,packageId:p2},409);
 const bill=await json('/api/admin/bills',opening);assert.equal(bill.package_id,p1);assert.equal(bill.package_name,a.name);assert.equal(bill.bill_format,'SINGLE_PACKAGE');assert.equal(bill.lines.length,2);
 assert.deepEqual(bill.lines.map(l=>[l.package_id,l.audience,Number(l.price),l.quantity]),[[p1,'ADULT',399,2],[p1,'CHILD',199,3]]);
 const expected=state.settings.vat_included?1395:Math.round(1395*(1+Number(state.settings.vat_rate)/100)*100)/100;assert.equal(Number(bill.total),expected);
 assert.equal((await json('/api/admin/bills',opening)).id,bill.id);
 await json('/api/admin/packages/'+p1,{...a,name:prefix+'Renamed',adultPrice:499,childPrice:299});
 await error('/api/admin/packages/'+p1,a,409);
 const snapshot=await json('/api/admin/bills/'+bill.id);assert.equal(snapshot.package_name,a.name);assert.equal(Number(snapshot.total),expected);assert.deepEqual(snapshot.lines,bill.lines);
 const receipt=await request(`/admin/bills/${bill.id}/receipt`);assert.equal(receipt.status,200);const receiptText=await receipt.text();assert(receiptText.includes(a.name));assert(receiptText.includes('ผู้ใหญ่'));assert(receiptText.includes('เด็ก'));
 await json(`/api/admin/bills/${bill.id}/checkout`,{applyPenalty:false,paymentMethod:'CASH'});
 const childOnly=await json('/api/admin/bills',{...opening,adultQuantity:0,childQuantity:3,requestKey:crypto.randomUUID()});assert.equal(childOnly.lines.length,1);assert.equal(childOnly.lines[0].audience,'CHILD');assert.equal(Number(childOnly.lines[0].price),299);await json(`/api/admin/bills/${childOnly.id}/checkout`,{applyPenalty:false,paymentMethod:'CASH'});
 const adultOnly=await json('/api/admin/bills',{...opening,adultQuantity:2,childQuantity:0,requestKey:crypto.randomUUID()});assert.equal(adultOnly.lines.length,1);assert.equal(adultOnly.lines[0].audience,'ADULT');await json(`/api/admin/bills/${adultOnly.id}/checkout`,{applyPenalty:false,paymentMethod:'CASH'});
 categoryId=(await json('/api/admin/categories',{name:prefix,sortOrder:0,active:true,version:0})).id;
 const menuId=(await json('/api/admin/menu',{name:prefix+'Dish',categoryId,description:'',emoji:'🍲',sortOrder:0,active:true,version:0,packageIds:[],imageData:null,removeImage:false})).id;
 const getMenu=async()=> (await json('/api/admin/state')).menus.find(m=>m.id===menuId);
 let m=await getMenu();assert.equal(m.available,false);assert.equal(m.active,true);
 const access=(p)=>`/api/admin/menu/${menuId}/packages/${p}`;
 await error(access(p1),{enabled:true,version:m.version},403,{noCsrf:true});
 await json(access(p1),{enabled:true,version:m.version});m=await getMenu();assert.deepEqual(m.package_ids,[p1]);assert.equal(m.available,true);
 await json(access(p2),{enabled:true,version:m.version});m=await getMenu();assert.deepEqual(m.package_ids,[p1,p2].sort((x,y)=>x-y));
 await error(access(p1),{enabled:false,version:0},409);assert.deepEqual((await getMenu()).package_ids,m.package_ids);
 await json(access(p1),{enabled:false,version:m.version});m=await getMenu();assert.deepEqual(m.package_ids,[p2]);assert.equal(m.available,false,'disabled package is not sellable');
 await json('/api/admin/packages/'+p2,{...b,version:1,active:true});m=await getMenu();assert.equal(m.available,true);
 await json(access(p2),{enabled:false,version:m.version});m=await getMenu();assert.deepEqual(m.package_ids,[]);assert.equal(m.available,false);
 await error(access(99999999),{enabled:true,version:m.version},404);
 console.log('PASS: unified adult/child prices, single-package DTO/DB enforcement, mixed counts, zero/negative/over-capacity validation, disabled package, adult-only/child-only, price/name snapshots, receipt, stale edits, per-package independent switches, zero access, active gating and CSRF');
 }finally{if(categoryId)sql(`BEGIN; DELETE FROM menu_packages WHERE menu_id IN (SELECT id FROM food_menus WHERE category_id=${categoryId}); DELETE FROM food_menus WHERE category_id=${categoryId}; DELETE FROM food_categories WHERE id=${categoryId}; COMMIT;`);if(tableId)sql(`BEGIN; DELETE FROM bill_lines WHERE bill_id IN (SELECT id FROM bills WHERE opening_table_id=${tableId}); DELETE FROM bills WHERE opening_table_id=${tableId}; DELETE FROM dining_tables WHERE id=${tableId}; COMMIT;`);if(planIds.length)sql(`DELETE FROM buffet_packages WHERE id IN (${planIds.join(',')});`);}})().catch(e=>{console.error(e.message);process.exitCode=1;});
