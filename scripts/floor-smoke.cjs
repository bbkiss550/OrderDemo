// Integration checks create a separate floor and remove only their own data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),env=Object.fromEntries(fs.readFileSync(path.join(root,'.env'),'utf8').trim().split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).replace(/^\uFEFF/,''),l.slice(i+1)];}));
const base=`http://localhost:${env.APP_PORT||8088}`;let cookie='',csrf='',floorId;const tables=[],bills=[];
function sql(text){const r=spawnSync('C:/Program Files/PostgreSQL/17/bin/psql.exe',['-h','localhost','-U','postgres','-d','db_order_demo','-w','-v','ON_ERROR_STOP=1','-c',text],{encoding:'utf8',env:{...process.env,PGPASSWORD:env.DB_PASSWORD}});if(r.status!==0)throw Error(r.stderr);}
async function request(url,body,anonymous=false){const headers=anonymous?{}:{Cookie:cookie};if(body!==undefined){headers['Content-Type']='application/json';headers['X-CSRF-TOKEN']=csrf;}const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});if(!anonymous&&r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return r;}
async function json(url,body){const r=await request(url,body),text=await r.text();assert.equal(r.status,200,`${url}: ${text}`);return JSON.parse(text);}
async function conflict(url,body,status=409){const r=await request(url,body);assert.equal(r.status,status,await r.text());}
const placement=t=>({tableId:t.id,tableVersion:t.metadata_version,name:t.name,capacity:t.capacity,cells:t.cells});
(async()=>{try{
 const h=await (await request('/login')).text();csrf=h.match(/name="_csrf"[^>]*value="([^"]+)"/)[1];
 const login=await fetch(base+'/login',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:env.ADMIN_USERNAME,password:env.ADMIN_PASSWORD,_csrf:csrf}),redirect:'manual'});assert.equal(login.status,302);cookie=login.headers.get('set-cookie').split(';')[0];
 csrf=(await (await request('/admin/floor-plan')).text()).match(/name="_csrf" content="([^"]+)"/)[1];
 const state=await json('/api/admin/state'),pkg=state.packages.find(p=>p.active);const prefix='FP-'+Date.now();
 const f=await json('/api/admin/floors',{name:prefix,rows:6,columns:8,version:0});floorId=f.id;
 const endpoint=`/api/admin/floors/${floorId}/layout`;
 let layout=await json(endpoint,{version:0,tables:[{tableId:null,tableVersion:0,name:prefix+'A',capacity:2,cells:[{row:0,column:0}]},{tableId:null,tableVersion:0,name:prefix+'B',capacity:1,cells:[{row:0,column:2},{row:0,column:3},{row:1,column:3}]},{tableId:null,tableVersion:0,name:prefix+'C',capacity:6,cells:[{row:2,column:0},{row:2,column:1}]},{tableId:null,tableVersion:0,name:prefix+'D',capacity:6,cells:[{row:3,column:0}]},{tableId:null,tableVersion:0,name:prefix+'E',capacity:6,cells:[{row:4,column:0}]}]});
 tables.push(...layout.tables.map(t=>t.id));let [a,b,c,d,e]=layout.tables;
 assert.equal(a.cells.length,1);assert.equal(a.capacity,2);assert.equal(b.cells.length,3);assert.equal(b.capacity,1);
 await conflict(endpoint,{version:0,tables:layout.tables.map(placement)});
 const input=()=>({version:layout.floor.version,tables:layout.tables.map(placement)});
 let overlap=input();overlap.tables[1].cells=[{row:0,column:0}];await conflict(endpoint,overlap);
 let outside=input();outside.tables[1].cells=[{row:6,column:0}];await conflict(endpoint,outside);
 await conflict(`/api/admin/floors/${floorId}`,{name:prefix,rows:2,columns:8,version:layout.floor.version});
 await conflict(`/api/admin/floors/${floorId}/delete`,{version:layout.floor.version});
 assert.equal((await json(endpoint)).floor.version,layout.floor.version,'invalid edits roll back');
 await json(`/api/admin/tables/${c.id}/availability`,{active:false,reason:'ซ่อมโต๊ะ'});
 const opening={tableId:a.id,durationMinutes:90,requestKey:crypto.randomUUID(),packageId:pkg.id,adultQuantity:2,childQuantity:0};
 await conflict('/api/admin/bills',{...opening,tableId:c.id,requestKey:crypto.randomUUID()});
 let bill=await json('/api/admin/bills',opening);bills.push(bill.id);
 await conflict(`/api/admin/tables/${a.id}/availability`,{active:false,reason:'occupied'});
 await conflict(`/api/admin/bills/${bill.id}/move`,{fromTableId:a.id,toTableId:b.id,requestKey:crypto.randomUUID()});
 await conflict(`/api/admin/bills/${bill.id}/move`,{fromTableId:a.id,toTableId:c.id,requestKey:crypto.randomUUID()});
 layout=await json(endpoint);const editOccupied=input();editOccupied.tables.find(t=>t.tableId===a.id).capacity=9;await conflict(endpoint,editOccupied);
 const reposition=input();reposition.tables.find(t=>t.tableId===a.id).cells=[{row:1,column:0}];layout=await json(endpoint,reposition);assert.equal(layout.tables.find(t=>t.id===a.id).bill_id,bill.id);
 await json(`/api/admin/tables/${c.id}/availability`,{active:true});
 const move={fromTableId:a.id,toTableId:c.id,requestKey:crypto.randomUUID()};
 const qrBefore=Buffer.from(await (await request(`/admin/bills/${bill.id}/qr`)).arrayBuffer());
 const moved=await json(`/api/admin/bills/${bill.id}/move`,move);
 for(const key of ['id','qr_token','qr_url','opened_at','ends_at','duration_minutes','total','subtotal','vat','vat_rate','penalty_rate','opening_table_id','package_id','package_name'])assert.equal(moved[key],bill[key],`preserve ${key}`);
 assert.equal(moved.table_id,c.id);assert.equal(moved.moves.length,1);assert.equal(moved.moves[0].moved_by,env.ADMIN_USERNAME);
 assert.deepEqual(Buffer.from(await (await request(`/admin/bills/${bill.id}/qr`)).arrayBuffer()),qrBefore);
 assert.equal((await json(`/api/admin/bills/${bill.id}/move`,move)).moves.length,1);
 await conflict(`/api/admin/bills/${bill.id}/move`,{...move,toTableId:d.id});
 assert.equal((await json('/api/admin/bills',opening)).id,bill.id,'opening retry after transfer');
 assert((await (await request('/order/'+bill.qr_token,undefined,true)).text()).includes(c.name));
 assert((await (await request(`/admin/bills/${bill.id}/receipt`)).text()).includes(c.name));
 await json(`/api/admin/tables/${a.id}/availability`,{active:false,reason:'เสียชั่วคราว'});
 assert.equal((await json('/api/admin/state')).tables.find(t=>t.id===a.id).closure_reason,'เสียชั่วคราว');
 sql(`UPDATE bills SET opened_at=now()-interval '100 minutes',ends_at=now()-interval '10 minutes' WHERE id=${bill.id}`);
 const expired=await json(`/api/admin/bills/${bill.id}`);assert.equal(expired.expired,true);
 const second=await json('/api/admin/bills',{...opening,tableId:d.id,requestKey:crypto.randomUUID()});bills.push(second.id);
 await conflict(`/api/admin/bills/${bill.id}/move`,{fromTableId:c.id,toTableId:d.id,requestKey:crypto.randomUUID()});
 const race=await Promise.all([request(`/api/admin/bills/${bill.id}/move`,{fromTableId:c.id,toTableId:e.id,requestKey:crypto.randomUUID()}),request(`/api/admin/bills/${second.id}/move`,{fromTableId:d.id,toTableId:e.id,requestKey:crypto.randomUUID()})]);
 assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
 const latest=await json(`/api/admin/bills/${bill.id}`);assert.equal(latest.ends_at,expired.ends_at);assert.equal(latest.expired,true);
 await json(`/api/admin/bills/${bill.id}/checkout`,{applyPenalty:false,paymentMethod:'CASH'});
 await conflict(`/api/admin/bills/${bill.id}/move`,{fromTableId:latest.table_id,toTableId:b.id,requestKey:crypto.randomUUID()});
 // A stale editor must also detect table changes made from the separate table page.
 layout=await json(endpoint);const free=layout.tables.find(t=>t.id===b.id);await json(`/api/admin/tables/${b.id}`,{name:b.name,capacity:3,active:true});await conflict(endpoint,input());
 console.log('PASS: independent seats/area, irregular cells, overlap/bounds rollback, floor versions/cropping, occupied layout edits, repair closure, transfer validation, unchanged QR/prices/time, audit/idempotency, opening retry, customer/receipt table, expiry, concurrent transfers, paid transfer blocked, stale table metadata');
 }finally{if(floorId){const ids=tables.join(',')||'0';sql(`BEGIN; DELETE FROM bill_table_moves WHERE bill_id IN (SELECT id FROM bills WHERE opening_table_id IN (${ids})); DELETE FROM bill_lines WHERE bill_id IN (SELECT id FROM bills WHERE opening_table_id IN (${ids})); DELETE FROM bills WHERE opening_table_id IN (${ids}); DELETE FROM table_layouts WHERE floor_id=${floorId}; DELETE FROM dining_tables WHERE id IN (${ids}); DELETE FROM restaurant_floors WHERE id=${floorId}; COMMIT;`);}}})().catch(e=>{console.error(e.message);process.exitCode=1;});
