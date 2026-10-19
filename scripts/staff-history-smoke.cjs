// Creates only QA-prefixed accounts/catalog entries, then removes its own fixtures.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),env=Object.fromEntries(fs.readFileSync(path.join(root,'.env'),'utf8').trim().split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).replace(/^\uFEFF/,''),l.slice(i+1)];}));
const base=`http://localhost:${env.APP_PORT||8088}`,prefix='qa_ops_'+Date.now(),password=crypto.randomBytes(18).toString('hex'),staffIds=[];
let categoryId,menuId,packageId;
class Client{
 constructor(){this.cookie='';this.csrf='';}
 async request(url,body){const headers={Cookie:this.cookie,Accept:'application/json'};if(body!==undefined){headers['Content-Type']='application/json';headers['X-CSRF-TOKEN']=this.csrf;}const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});if(r.headers.get('set-cookie'))this.cookie=r.headers.get('set-cookie').split(';')[0];return r;}
 async json(url,body){const r=await this.request(url,body);const text=await r.text();assert.equal(r.status,200,`${url}: ${text}`);return JSON.parse(text);}
 async login(username,pass,landing){const login=await this.request('/login');const token=(await login.text()).match(/name="_csrf"[^>]*value="([^"]+)"/)[1];const r=await fetch(base+'/login',{method:'POST',headers:{Cookie:this.cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username,password:pass,_csrf:token}),redirect:'manual'});assert.equal(r.status,302);if(!landing){assert(r.headers.get('location').includes('/login/failed'));return;}assert(r.headers.get('location').endsWith(landing));this.cookie=r.headers.get('set-cookie').split(';')[0];const html=await (await this.request(landing)).text();this.csrf=html.match(/name="_csrf" content="([^"]+)"/)[1];return html;}
}
function sql(statement){const r=spawnSync('C:/Program Files/PostgreSQL/17/bin/psql.exe',['-h','localhost','-p','5432','-U',env.DB_USERNAME||'postgres','-d','db_order_demo','-w','-X','-qAt','-v','ON_ERROR_STOP=1','-c',statement],{encoding:'utf8',env:{...process.env,PGPASSWORD:env.DB_PASSWORD,PGCLIENTENCODING:'UTF8'}});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
(async()=>{try{
 const rootUser=new Client();await rootUser.login(env.ADMIN_USERNAME||'admin',env.ADMIN_PASSWORD,'/admin/reception');
 const initial=await rootUser.json('/api/admin/state');const self=initial.user;
 assert.equal((await rootUser.request(`/api/admin/staff/${self.id}`,{username:self.username,displayName:self.display_name,role:'CASHIER',active:true,version:self.version,password:null})).status,409);
 for(const role of ['ADMIN','CASHIER','KITCHEN']){staffIds.push((await rootUser.json('/api/admin/staff',{username:prefix+'_'+role.toLowerCase(),displayName:prefix+' '+role,role,active:true,version:0,password})).id);}
 const admin=new Client(),cashier=new Client(),kitchen=new Client();
 await admin.login(prefix+'_admin',password,'/admin/reception');
 const cashierHtml=await cashier.login(prefix+'_cashier',password,'/admin/reception');assert(!cashierHtml.includes('data-nav="/admin/staff"'));
 await kitchen.login(prefix+'_kitchen',password,'/admin/kds');
 for(const url of ['/api/admin/staff','/api/admin/audit','/api/admin/reports/sales','/admin/settings','/admin/floor-plan'])assert.equal((await cashier.request(url)).status,403,url);
 for(const url of ['/api/admin/bills','/admin/bills','/admin/reception','/api/admin/staff','/api/admin/reports/sales'])assert.equal((await kitchen.request(url)).status,403,url);
 const kitchenState=await kitchen.json('/api/admin/state');assert(!('bills' in kitchenState));assert(!('stats' in kitchenState));assert(!kitchenState.packages.some(p=>'adult_price' in p));
 categoryId=(await admin.json('/api/admin/categories',{name:prefix,sortOrder:999,active:true,version:0})).id;
 packageId=(await admin.json('/api/admin/packages',{name:prefix,adultPrice:100,childPrice:50,active:true,version:0})).id;
 menuId=(await admin.json('/api/admin/menu',{name:prefix,categoryId,description:'QA only',emoji:'🍲',sortOrder:0,active:true,version:0,packageIds:[packageId],removeImage:false})).id;
 assert.equal((await cashier.request(`/api/admin/menu/${menuId}/status`,{active:false,version:0})).status,403);
 await kitchen.json(`/api/admin/menu/${menuId}/status`,{active:false,version:0});
 await admin.json(`/api/admin/packages/${packageId}`,{name:prefix,adultPrice:120,childPrice:60,active:true,version:0});
 const events=(await rootUser.json('/api/admin/audit?q='+prefix+'&size=100')).items;
 const priceEvent=events.find(e=>e.entity_type==='PACKAGE'&&e.action==='UPDATE');assert.equal(JSON.parse(priceEvent.before_data).adult_price,100);assert.equal(JSON.parse(priceEvent.after_data).adult_price,120);
 assert(events.some(e=>e.actor===prefix+'_kitchen'&&e.action==='STATUS'));
 const staffList=await rootUser.json('/api/admin/staff');assert(!JSON.stringify(staffList).includes('password_hash'));
 const cashierAccount=staffList.find(u=>u.id===staffIds[1]);const nextPassword=crypto.randomBytes(18).toString('hex');
 await rootUser.json(`/api/admin/staff/${cashierAccount.id}/password`,{password:nextPassword,version:cashierAccount.version});
 assert.equal((await cashier.request('/api/admin/state')).status,302);
 await new Client().login(cashierAccount.username,password,null);
 const freshCashier=new Client();await freshCashier.login(cashierAccount.username,nextPassword,'/admin/reception');
 const freshList=await rootUser.json('/api/admin/staff'),toDisable=freshList.find(u=>u.id===cashierAccount.id);
 await rootUser.json(`/api/admin/staff/${toDisable.id}`,{username:toDisable.username,displayName:toDisable.display_name,role:toDisable.role,active:false,version:toDisable.version,password:null});
 assert.equal((await freshCashier.request('/api/admin/state')).status,302);
 const adminAccount=(await rootUser.json('/api/admin/staff')).find(u=>u.id===staffIds[0]);
 await rootUser.json(`/api/admin/staff/${adminAccount.id}`,{username:adminAccount.username,displayName:adminAccount.display_name,role:'CASHIER',active:true,version:adminAccount.version,password:null});
 assert.equal((await admin.request('/api/admin/state')).status,302);
 const history=await rootUser.json('/api/admin/bills?size=1&page=0');assert.equal(Number(history.total),Number(sql('SELECT count(*) FROM bills')));if(history.total>1){const second=await rootUser.json('/api/admin/bills?size=1&page=1');assert.notEqual(history.items[0].id,second.items[0].id);}
 assert.equal((await rootUser.request('/api/admin/bills?dateType=invalid')).status,400);
 assert.equal((await rootUser.request('/api/admin/bills?size=101')).status,400);
 const safe=(await rootUser.json('/api/admin/audit?type=STAFF&size=100')).items;assert(!JSON.stringify(safe).includes('password_hash'));assert(!JSON.stringify(safe).includes(password));
 console.log('PASS: role permissions, filtered kitchen data, staff CRUD, password and role/disable session revocation, audit before/after values, cashier history pagination and invalid filters.');
}finally{
 const ids=staffIds.filter(Number.isInteger).join(',');
 const catalog=(menuId?`DELETE FROM menu_packages WHERE menu_id=${menuId};DELETE FROM food_menus WHERE id=${menuId} AND name='${prefix}';`:'')+(categoryId?`DELETE FROM food_categories WHERE id=${categoryId} AND name='${prefix}';`:'')+(packageId?`DELETE FROM buffet_packages WHERE id=${packageId} AND name='${prefix}';`:'');
 sql(`BEGIN;${catalog}DELETE FROM audit_events WHERE actor LIKE '${prefix}%'${ids?` OR (entity_type='STAFF' AND entity_id IN (${ids}))`:''};${ids?`DELETE FROM staff_users WHERE id IN (${ids}) AND username LIKE '${prefix}%';`:''}COMMIT;`);
 console.log('QA accounts, catalog fixtures and their audit records cleaned up.');
}})().catch(error=>{console.error(error.stack);process.exitCode=1});
