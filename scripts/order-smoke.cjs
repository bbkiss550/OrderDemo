// Runs against localhost. Creates QA-only fixtures and removes only those fixtures.
// UI checks use jsdom: npm install --prefix .runtime/calendar-test --no-save --package-lock=false jsdom@26.1.0
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),env=Object.fromEntries(fs.readFileSync(path.join(root,'.env'),'utf8').trim().split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).replace(/^\uFEFF/,''),l.slice(i+1)];}));
const base='http://localhost:'+(env.APP_PORT||8088),prefix='qa_order_'+Date.now(),password=crypto.randomBytes(18).toString('hex');
const uuid=()=>crypto.randomUUID();
function sql(statement){const result=spawnSync('C:/Program Files/PostgreSQL/17/bin/psql.exe',['-h','localhost','-p','5432','-U',env.DB_USERNAME||'postgres','-d','db_order_demo','-w','-X','-qAt','-v','ON_ERROR_STOP=1','-c',statement],{encoding:'utf8',env:{...process.env,PGPASSWORD:env.DB_PASSWORD,PGCLIENTENCODING:'UTF8'}});assert.equal(result.status,0,result.stderr);return result.stdout.trim();}
class Client{
 constructor(){this.cookie='';this.csrf='';}
 async fetch(url,opts={}){const response=await fetch(new URL(url,base),{...opts,redirect:'manual',headers:{...opts.headers,Cookie:this.cookie}});if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];return response;}
 async page(url){const response=await this.fetch(url);assert.equal(response.status,200,url);const html=await response.text();this.csrf=html.match(/name="_csrf"[^>]*content="([^"]+)"/)?.[1]||html.match(/name="_csrf"[^>]*value="([^"]+)"/)?.[1]||this.csrf;return html;}
 request(url,body,csrf=true){return this.fetch(url,{method:body===undefined?'GET':'POST',headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json',...(csrf?{'X-CSRF-TOKEN':this.csrf}:{})})},body:body===undefined?undefined:JSON.stringify(body)});}
 async json(url,body){const response=await this.request(url,body);assert.equal(response.status,200,url+' '+await (response.status===200?Promise.resolve(''):response.text()));return response.json();}
 async login(username,pass){await this.page('/login');const response=await this.fetch('/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username,password:pass,_csrf:this.csrf})});assert.equal(response.status,302);assert(!response.headers.get('location').includes('failed'));await this.page(response.headers.get('location'));}
}
async function waitFor(test,label){for(let i=0;i<300;i++){if(await test())return;await new Promise(resolve=>setTimeout(resolve,20));}throw Error('Timed out: '+label);}
async function uiChecks(admin,customer,token,menuId,billId,kitchen){
 const {JSDOM}=require('../.runtime/calendar-test/node_modules/jsdom');
 const before=Number(sql(`SELECT count(*) FROM order_rounds WHERE bill_id=${billId}`));
 let pending,drop=true;
 async function customerDom(draft){
  const html=await customer.page('/order/'+token),dom=new JSDOM(html,{url:base+'/order/'+token,runScripts:'outside-only',pretendToBeVisual:true});
  if(draft)dom.window.sessionStorage.setItem('foodflow-pending-'+token,draft);
  dom.window.fetch=async(url,opts={})=>{const response=await customer.fetch(url,opts);if(drop&&opts.method==='POST'&&String(url).endsWith('/rounds')){assert.equal(response.status,200);drop=false;throw Error('QA simulated response loss');}return response;};
  vm.runInContext(await (await customer.fetch('/js/customer.js')).text(),dom.getInternalVMContext());return dom;
 }
 let dom=await customerDom();
 try{
  let doc=dom.window.document;await waitFor(()=>doc.querySelector(`[data-qty="${menuId}"]`),'customer menus');
  assert(!doc.querySelector('#customerView script'), 'Names must be escaped');
  doc.querySelector(`[data-qty="${menuId}"][data-delta="1"]`).click();doc.querySelector('#customerCartBar button').click();doc.querySelector('[data-submit-order]').click();
  await waitFor(()=>doc.getElementById('customerNotice').textContent.includes('QA simulated'),'lost response UI');
  pending=dom.window.sessionStorage.getItem('foodflow-pending-'+token);assert(pending);assert(doc.querySelector('[data-qty]').disabled);
 }finally{dom.window.close();}
 dom=await customerDom(pending);
 try{
  const doc=dom.window.document;await waitFor(()=>doc.querySelector('[data-submit-order]'),'restored pending draft');
  doc.querySelector('[data-submit-order]').click();await waitFor(()=>doc.querySelector('.customer-round'),'retry round history');
  assert.equal(dom.window.sessionStorage.getItem('foodflow-pending-'+token),null);
  assert.equal(Number(sql(`SELECT count(*) FROM order_rounds WHERE bill_id=${billId}`)),before+1,'Lost response and reload must not duplicate order');
  const roundId=Number(sql(`SELECT max(id) FROM order_rounds WHERE bill_id=${billId}`));
  await admin.json('/api/admin/orders/'+roundId+'/status',{status:'COOKING',version:0});
  doc.dispatchEvent(new dom.window.Event('visibilitychange'));
  await waitFor(()=>doc.querySelector('.customer-round .customer-status.COOKING'),'customer refresh on return');
  await admin.json('/api/admin/orders/'+roundId+'/status',{status:'READY',version:1});
  await waitFor(()=>doc.querySelector('.customer-round .customer-status.READY'),'customer automatic status polling');
 }finally{dom.window.close();}
 for(const [route,viewer] of [['/admin/kds',admin],['/admin/orders',admin],['/admin/reception',admin],['/admin/orders',kitchen]]){
  const dom=new JSDOM(await viewer.page(route),{url:base+route,runScripts:'outside-only',pretendToBeVisual:true}),win=dom.window,doc=win.document;
  try{
   win.fetch=(url,opts={})=>viewer.fetch(url,opts);
   win.setInterval=()=>0;
   const scripts=[];for(const element of doc.querySelectorAll('script[src]'))scripts.push(await (await viewer.fetch(element.src)).text());
   // Start one explicitly awaited refresh, rather than leaving the initial async refresh running when closing the DOM.
   Object.defineProperty(doc,'readyState',{value:'loading',configurable:true});
   vm.runInContext(scripts.join('\n;\n'),dom.getInternalVMContext());
   Object.defineProperty(doc,'readyState',{value:'complete',configurable:true});
   await vm.runInContext('refresh()',dom.getInternalVMContext());
   if(route==='/admin/reception'){
    await vm.runInContext('showBill('+billId+')',dom.getInternalVMContext());
    doc.querySelector('[data-bill-orders]').click();
    await waitFor(()=>doc.querySelector('#modalBody [data-order-detail]'),'orders from reception bill');
    assert(doc.getElementById('modalTitle').textContent.includes(String(billId)));
    continue;
   }
   await waitFor(()=>doc.getElementById('orderQuery'),'admin order list');
   const query=doc.getElementById('orderQuery');query.value=prefix;query.dispatchEvent(new win.Event('input',{bubbles:true}));
   await waitFor(()=>!doc.querySelector('#ordersConnection.text-danger')&&vm.runInContext('foodOrders.query',dom.getInternalVMContext())===prefix,'filter search');
   await waitFor(()=>vm.runInContext('foodOrders.data.items.every(r=>r.table_name.startsWith("'+prefix+'"))',dom.getInternalVMContext()),'fixture-only rows');
   assert(!doc.querySelector('#content script'));
   if(route==='/admin/kds'){assert.equal(doc.querySelectorAll('.kds-column').length,3);assert(doc.querySelector('.order-card a.order-print-link').getAttribute('href').endsWith('/print'));}
   const detail=doc.querySelector('[data-order-detail]');assert(detail);const id=detail.dataset.orderDetail;detail.click();
   await waitFor(()=>doc.getElementById('modalBody').querySelector('[data-order-status]'),'order modal actions');
   assert(doc.getElementById('modalBody').textContent.includes('โต๊ะปัจจุบัน'));
   assert.equal(doc.querySelector('#modalBody a.order-print-link').getAttribute('href'),'/admin/orders/'+id+'/print');
   if(route==='/admin/kds'){
    const button=doc.querySelector('#modalBody [data-order-status]'),previous=Number(sql(`SELECT version FROM order_rounds WHERE id=${Number(id)}`));button.click();
    await waitFor(()=>Number(sql(`SELECT version FROM order_rounds WHERE id=${Number(id)}`))>previous,'KDS item update');
    await waitFor(()=>!vm.runInContext('foodOrders.mutating||foodOrders.loading',dom.getInternalVMContext()),'KDS refresh');
    const latest=await admin.json('/api/admin/orders/'+id),item=latest.items.find(i=>i.status!=='SERVED');
    if(item){
     const next={PENDING:'COOKING',COOKING:'READY',READY:'SERVED'}[item.status];
     const updated=await admin.json('/api/admin/orders/'+id+'/status',{status:next,version:latest.version,itemId:item.id});
     await vm.runInContext('pollOrders()',dom.getInternalVMContext());
     assert.equal(Number(doc.querySelector('#modalBody [data-order-version]')?.dataset.orderVersion||updated.version),updated.version);
    }
   }
  }finally{dom.window.close();}
 }
 console.log('PASS: actual customer/KDS/admin scripts with real API in jsdom; lost-response retry across reload, escaped names, queue, modal and item action.');
}
(async()=>{
 let fixtureReady=false;
 try{
  const admin=new Client();await admin.login(env.ADMIN_USERNAME||'admin',env.ADMIN_PASSWORD);
  fixtureReady=true;
  const category=(await admin.json('/api/admin/categories',{name:prefix,sortOrder:999,active:true,version:0})).id;
  const plan=(await admin.json('/api/admin/packages',{name:prefix,adultPrice:399,childPrice:199,active:true,version:0})).id;
  const otherPlan=(await admin.json('/api/admin/packages',{name:prefix+'_other',adultPrice:599,childPrice:399,active:true,version:0})).id;
  for(const role of ['KITCHEN','CASHIER'])await admin.json('/api/admin/staff',{username:prefix+'_'+role.toLowerCase(),displayName:prefix,role,active:true,version:0,password});
  const kitchen=new Client(),secondKitchen=new Client(),cashier=new Client();await kitchen.login(prefix+'_kitchen',password);await secondKitchen.login(prefix+'_kitchen',password);await cashier.login(prefix+'_cashier',password);
  const menus=[];
  for(let i=0;i<3;i++)menus.push((await admin.json('/api/admin/menu',{name:prefix+(i===0?' <script>safe</script>':' '+i),categoryId:category,description:'QA only',emoji:'🍲',sortOrder:i,active:true,version:0,packageIds:[i===2?otherPlan:plan],removeImage:false})).id);
  await admin.json('/api/admin/tables',{name:prefix+'_A',capacity:10,active:true});await admin.json('/api/admin/tables',{name:prefix+'_B',capacity:10,active:true});
  let state=await admin.json('/api/admin/state');const tables=state.tables.filter(t=>t.name.startsWith(prefix));assert.equal(tables.length,2);
  const bill=await admin.json('/api/admin/bills',{tableId:tables[0].id,durationMinutes:90,requestKey:uuid(),packageId:plan,adultQuantity:2,childQuantity:3}),token=bill.qr_token,billId=bill.id;
  const customer=new Client(),otherDevice=new Client();await customer.page('/order/'+token);await otherDevice.page('/order/'+token);
  const publicState=await customer.json('/order/'+token+'/state');assert.equal(publicState.menus.length,2);assert(!('qr_token' in publicState.bill));assert(!('request_key' in publicState.bill));assert(publicState.bill.can_order);
  assert.equal((await customer.request('/api/admin/orders')).status,302);assert.equal((await cashier.request('/admin/kds')).status,403);
  assert.equal((await customer.request('/order/'+token+'/rounds',{requestKey:uuid(),items:[{menuId:menus[0],quantity:1}]},false)).status,403);
  assert.equal((await customer.request('/order/'+'x'.repeat(43)+'/state')).status,404);
  for(const items of [[],[{menuId:menus[0],quantity:0}],[{menuId:menus[0],quantity:100}],[{menuId:menus[0],quantity:1},{menuId:menus[0],quantity:2}],[{menuId:menus[2],quantity:1}]])assert([400,409].includes((await customer.request('/order/'+token+'/rounds',{requestKey:uuid(),items})).status));
  const payload={requestKey:uuid(),items:[{menuId:menus[0],quantity:2},{menuId:menus[1],quantity:3}]};
  const [first,replay]=await Promise.all([customer.json('/order/'+token+'/rounds',payload),otherDevice.json('/order/'+token+'/rounds',payload)]);assert.equal(first.id,replay.id);assert.equal(first.round_no,1);assert.equal(first.quantity,5);
  // Print is read-only, including for kitchen/cashier accounts, with escaped snapshots and no financial/QR data.
  const printResponse=await kitchen.request('/admin/orders/'+first.id+'/print');assert.equal(printResponse.status,200);assert.equal(printResponse.headers.get('cache-control'),'no-store');
  const printHtml=await printResponse.text(),{JSDOM}=require('../.runtime/calendar-test/node_modules/jsdom');
  const ticketDom=new JSDOM(printHtml,{runScripts:'outside-only'});
  try{
   const win=ticketDom.window,doc=win.document;let printCalls=0;win.print=()=>printCalls++;
   assert(doc.querySelector('.order-ticket').textContent.includes(tables[0].name));assert(doc.querySelector('.order-ticket').textContent.includes('5 จาน'));assert(!doc.querySelector('tbody script'));
   assert(!printHtml.includes('qr_token'));assert(!printHtml.includes('paid_total'));assert(!printHtml.includes('ราคาผู้ใหญ่'));
   vm.runInContext(await (await kitchen.fetch('/js/order-ticket.js')).text(),ticketDom.getInternalVMContext());
   doc.querySelector('#printOrderTicket').click();assert.equal(printCalls,1);assert(doc.querySelector('#ticketCopyLabel').hidden);
   doc.querySelector('#ticketCopy').checked=true;doc.querySelector('#ticketCopy').dispatchEvent(new win.Event('change'));assert(!doc.querySelector('#ticketCopyLabel').hidden);
   win.dispatchEvent(new win.Event('beforeprint'));assert(doc.querySelector('#ticketPrintedAt').textContent);
  }finally{ticketDom.window.close();}
  assert.equal((await cashier.request('/admin/orders/'+first.id+'/print')).status,200);assert.equal((await customer.request('/admin/orders/'+first.id+'/print')).status,302);
  assert.equal((await kitchen.request('/admin/orders/9007199254740991/print')).status,404);
  const afterPrint=await kitchen.json('/api/admin/orders/'+first.id);assert.equal(afterPrint.version,0);assert.equal(afterPrint.status,'PENDING');
  assert.equal((await customer.request('/order/'+token+'/rounds',{...payload,items:[{menuId:menus[0],quantity:1}]})).status,409);
  const parallel=await Promise.all([customer,otherDevice,customer].map(client=>client.json('/order/'+token+'/rounds',{requestKey:uuid(),items:[{menuId:menus[0],quantity:1}]})));assert.deepEqual(parallel.map(r=>r.round_no).sort(),[2,3,4]);
  let round=await kitchen.json('/api/admin/orders/'+first.id);assert.equal((await cashier.request('/api/admin/orders/'+round.id+'/status',{status:'COOKING',version:round.version})).status,403);
  assert.equal((await kitchen.request('/api/admin/orders/'+round.id+'/status',{status:'READY',version:round.version})).status,409);
  const [itemA,itemB]=round.items;
  round=await kitchen.json('/api/admin/orders/'+round.id+'/status',{status:'COOKING',version:round.version,itemId:itemA.id});assert.equal(round.status,'PENDING');
  round=await kitchen.json('/api/admin/orders/'+round.id+'/status',{status:'READY',version:round.version,itemId:itemA.id});assert.equal(round.status,'PENDING');
  round=await kitchen.json('/api/admin/orders/'+round.id+'/status',{status:'COOKING',version:round.version});assert.equal(round.status,'COOKING');assert.equal(round.items.find(i=>i.id===itemA.id).status,'READY');
  round=await kitchen.json('/api/admin/orders/'+round.id+'/status',{status:'READY',version:round.version});assert.equal(round.status,'READY');
  round=await cashier.json('/api/admin/orders/'+round.id+'/status',{status:'SERVED',version:round.version,itemId:itemA.id});assert.equal(round.status,'READY');
  round=await cashier.json('/api/admin/orders/'+round.id+'/status',{status:'SERVED',version:round.version});assert.equal(round.status,'SERVED');assert(round.items.every(i=>i.served_at));
  assert.equal((await kitchen.request('/api/admin/orders/'+round.id+'/status',{status:'COOKING',version:round.version})).status,409);
  const raceId=parallel[0].id,race=await kitchen.json('/api/admin/orders/'+raceId);
  const racing=await Promise.all([kitchen,secondKitchen].map(client=>client.request('/api/admin/orders/'+raceId+'/status',{status:'COOKING',version:race.version})));assert.deepEqual(racing.map(r=>r.status).sort(),[200,409]);
  state=await admin.json('/api/admin/state');let menu=state.menus.find(m=>m.id===menus[0]);await kitchen.json('/api/admin/menu/'+menu.id+'/status',{active:false,version:menu.version});
  assert.equal((await customer.request('/order/'+token+'/rounds',{requestKey:uuid(),items:[{menuId:menus[0],quantity:1}]})).status,409);
  await kitchen.json('/api/admin/menu/'+menu.id+'/status',{active:true,version:menu.version+1});
  await admin.json('/api/admin/categories/'+category,{name:prefix,sortOrder:999,active:false,version:0});
  assert.equal((await customer.request('/order/'+token+'/rounds',{requestKey:uuid(),items:[{menuId:menus[0],quantity:1}]})).status,409);
  await admin.json('/api/admin/categories/'+category,{name:prefix,sortOrder:999,active:true,version:1});
  state=await admin.json('/api/admin/state');menu=state.menus.find(m=>m.id===menus[0]);await admin.json('/api/admin/menu/'+menu.id+'/packages/'+plan,{enabled:false,version:menu.version});
  assert.equal((await customer.request('/order/'+token+'/rounds',{requestKey:uuid(),items:[{menuId:menus[0],quantity:1}]})).status,409);
  await admin.json('/api/admin/menu/'+menu.id+'/packages/'+plan,{enabled:true,version:menu.version+1});
  // Snapshot survives catalog changes, without altering its previously accepted line.
  sql(`UPDATE food_menus SET name='${prefix} renamed' WHERE id=${menus[0]}`);assert((await customer.json('/order/'+token+'/state')).rounds.find(r=>r.id===first.id).items.some(i=>i.menu_name.includes('<script>safe</script>')));
  sql(`UPDATE food_menus SET name='${prefix} <script>safe</script>' WHERE id=${menus[0]}`);
  await uiChecks(admin,customer,token,menus[0],billId,kitchen);
  await admin.json('/api/admin/bills/'+billId+'/move',{fromTableId:tables[0].id,toTableId:tables[1].id,requestKey:uuid()});
  assert.equal((await customer.json('/order/'+token+'/state')).bill.table_name,tables[1].name);
  const moved=await kitchen.json('/api/admin/orders/'+first.id);assert.equal(moved.table_name,tables[1].name);assert.equal(moved.table_name_at_order,tables[0].name);
  const beforeExpire=Number(sql(`SELECT count(*) FROM order_rounds WHERE bill_id=${billId}`));
  sql(`UPDATE bills SET opened_at=clock_timestamp()-interval '10 minutes',ends_at=clock_timestamp()-interval '1 minute' WHERE id=${billId}`);
  assert(!(await customer.json('/order/'+token+'/state')).bill.can_order);
  assert.equal((await customer.request('/order/'+token+'/rounds',{requestKey:uuid(),items:[{menuId:menus[0],quantity:1}]})).status,409);
  assert.equal((await customer.json('/order/'+token+'/rounds',payload)).id,first.id);assert.equal(Number(sql(`SELECT count(*) FROM order_rounds WHERE bill_id=${billId}`)),beforeExpire);
  sql(`UPDATE bills SET ends_at=clock_timestamp()+interval '90 minutes' WHERE id=${billId}`);
  for(let i=0;i<19;i++)await customer.json('/order/'+token+'/rounds',{requestKey:uuid(),items:[{menuId:menus[0],quantity:1}]});
  const page0=await customer.json('/order/'+token+'/state'),page1=await customer.json('/order/'+token+'/state?page=1');assert(page0.total>20);assert.equal(page0.rounds.length,20);assert(page1.rounds.length>0);assert(!page0.rounds.some(r=>page1.rounds.some(s=>s.id===r.id)));
  const adminHistory=await admin.json('/api/admin/orders?status=ALL&billId='+billId+'&size=20&page=1');assert.equal(adminHistory.total,page0.total);assert.equal(adminHistory.page,1);
  const audit=await admin.json('/api/admin/audit?type=ORDER&size=100');assert(audit.items.some(e=>e.actor==='ลูกค้า QR'));assert(audit.items.some(e=>e.actor===prefix+'_kitchen'));
  assert(!JSON.stringify(audit.items.filter(e=>e.entity_type==='ORDER')).includes('qr_token'));
  const checkoutAndOrder=await Promise.all([admin.request('/api/admin/bills/'+billId+'/checkout',{applyPenalty:false,paymentMethod:'CASH'}),otherDevice.request('/order/'+token+'/rounds',{requestKey:uuid(),items:[{menuId:menus[0],quantity:1}]})]);assert.equal(checkoutAndOrder[0].status,200);assert([200,409].includes(checkoutAndOrder[1].status));
  assert(!(await customer.json('/order/'+token+'/state')).bill.can_order);assert.equal((await customer.request('/order/'+token+'/rounds',{requestKey:uuid(),items:[{menuId:menus[0],quantity:1}]})).status,409);
  assert.equal((await customer.json('/order/'+token+'/rounds',payload)).id,first.id);
  const nextBill=await admin.json('/api/admin/bills',{tableId:tables[1].id,durationMinutes:90,requestKey:uuid(),packageId:plan,adultQuantity:1,childQuantity:0});assert.notEqual(nextBill.qr_token,token);await otherDevice.page('/order/'+nextBill.qr_token);assert.equal((await otherDevice.json('/order/'+nextBill.qr_token+'/state')).total,0);
  console.log('PASS: QR/package/category/menu guards, CSRF/roles, concurrent multi-device submit/replay, item and round workflow, stale KDS versions, snapshots, moves, expiry/checkout races, pagination, QR isolation and audits.');
 }finally{
  if(fixtureReady)sql(`BEGIN;
   DELETE FROM audit_events WHERE starts_with(actor,'${prefix}') OR (entity_type='ORDER' AND entity_id IN (SELECT r.id FROM order_rounds r JOIN bills b ON b.id=r.bill_id JOIN dining_tables t ON t.id=b.table_id WHERE starts_with(t.name,'${prefix}'))) OR (entity_type='BILL' AND entity_id IN (SELECT b.id FROM bills b JOIN dining_tables t ON t.id=b.table_id WHERE starts_with(t.name,'${prefix}'))) OR (entity_type='MENU' AND entity_id IN (SELECT id FROM food_menus WHERE starts_with(name,'${prefix}'))) OR (entity_type='CATEGORY' AND entity_id IN (SELECT id FROM food_categories WHERE starts_with(name,'${prefix}'))) OR (entity_type='PACKAGE' AND entity_id IN (SELECT id FROM buffet_packages WHERE starts_with(name,'${prefix}'))) OR (entity_type='STAFF' AND entity_id IN (SELECT id FROM staff_users WHERE starts_with(username,'${prefix}')));
   DELETE FROM order_items WHERE round_id IN (SELECT r.id FROM order_rounds r JOIN bills b ON b.id=r.bill_id JOIN dining_tables t ON t.id=b.table_id WHERE starts_with(t.name,'${prefix}'));
   DELETE FROM order_rounds WHERE bill_id IN (SELECT b.id FROM bills b JOIN dining_tables t ON t.id=b.table_id WHERE starts_with(t.name,'${prefix}'));
   DELETE FROM bill_table_moves WHERE bill_id IN (SELECT b.id FROM bills b JOIN dining_tables t ON t.id=b.table_id WHERE starts_with(t.name,'${prefix}'));
   DELETE FROM bill_lines WHERE bill_id IN (SELECT b.id FROM bills b JOIN dining_tables t ON t.id=b.table_id WHERE starts_with(t.name,'${prefix}'));
   DELETE FROM bills WHERE table_id IN (SELECT id FROM dining_tables WHERE starts_with(name,'${prefix}'));
   DELETE FROM dining_tables WHERE starts_with(name,'${prefix}');
   DELETE FROM menu_packages WHERE menu_id IN (SELECT id FROM food_menus WHERE starts_with(name,'${prefix}'));
   DELETE FROM food_menus WHERE starts_with(name,'${prefix}');DELETE FROM food_categories WHERE starts_with(name,'${prefix}');DELETE FROM buffet_packages WHERE starts_with(name,'${prefix}');DELETE FROM staff_users WHERE starts_with(username,'${prefix}');COMMIT;`);
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
