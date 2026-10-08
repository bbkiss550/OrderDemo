const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),env=Object.fromEntries(fs.readFileSync(path.join(root,'.env'),'utf8').trim().split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).replace(/^\uFEFF/,''),l.slice(i+1)];}));
const base=`http://localhost:${env.APP_PORT||8088}`;let cookie='',csrf='',categoryId,menuId;
function sql(text){const r=spawnSync('C:/Program Files/PostgreSQL/17/bin/psql.exe',['-h','localhost','-U','postgres','-d','db_order_demo','-w','-v','ON_ERROR_STOP=1','-c',text],{encoding:'utf8',env:{...process.env,PGPASSWORD:env.DB_PASSWORD}});if(r.status!==0)throw Error(r.stderr);}
async function request(url,body,{anonymous=false,noCsrf=false}={}){const headers=anonymous?{}:{Cookie:cookie};if(body!==undefined){headers['Content-Type']='application/json';if(!noCsrf)headers['X-CSRF-TOKEN']=csrf;}const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});if(!anonymous&&r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return r;}
async function json(url,body){const r=await request(url,body),text=await r.text();assert.equal(r.status,200,`${url}: ${text}`);return JSON.parse(text);}
async function error(url,body,status,options){const r=await request(url,body,options);assert.equal(r.status,status,await r.text());}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
(async()=>{try{
 const h=await (await request('/login')).text();csrf=h.match(/name="_csrf"[^>]*value="([^"]+)"/)[1];
 const signed=await fetch(base+'/login',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:env.ADMIN_USERNAME,password:env.ADMIN_PASSWORD,_csrf:csrf}),redirect:'manual'});assert.equal(signed.status,302);cookie=signed.headers.get('set-cookie').split(';')[0];
 const html=await (await request('/admin/menu')).text();csrf=html.match(/name="_csrf" content="([^"]+)"/)[1];assert(html.includes('/admin/categories'));
 const state=await json('/api/admin/state'),adult=state.packages[0],child=state.packages[1];assert(adult&&child);
 const prefix='QA-MENU-'+Date.now(),category={name:prefix,sortOrder:99,active:true,version:0};
 categoryId=(await json('/api/admin/categories',category)).id;
 await error('/api/admin/categories',category,409);
 await error('/api/admin/categories',{...category,name:'   '},400);
 const input={name:prefix+' dish',categoryId,description:'เฉพาะ Standard',emoji:'🥩',sortOrder:1,active:true,version:0,packageIds:[adult.id],imageData:'data:image/png;base64,'+png.toString('base64'),removeImage:false};
 await error('/api/admin/menu',input,403,{noCsrf:true});
 await error('/api/admin/menu',{...input,packageIds:null},400);
 await error('/api/admin/menu',{...input,packageIds:[adult.id,adult.id]},409);
 await error('/api/admin/menu',{...input,packageIds:[999999999]},409);
 await error('/api/admin/menu',{...input,imageData:'data:image/png;base64,'+Buffer.from('<svg/>').toString('base64')},400);
 await error('/api/admin/menu',{...input,imageData:'data:image/svg+xml;base64,'+Buffer.from('<svg/>').toString('base64')},400);
 await error('/api/admin/menu',{...input,removeImage:true},400);
 await error('/api/admin/menu',{...input,imageData:'data:image/png;base64,'+Buffer.alloc(2097153).toString('base64')},400);
 assert.equal((await json('/api/admin/state')).menus.filter(m=>m.name===input.name).length,0,'failed inserts roll back');
 menuId=(await json('/api/admin/menu',input)).id;
 const get=async()=> (await json('/api/admin/state')).menus.find(m=>m.id===menuId);
 let m=await get();assert.deepEqual(m.package_ids,[adult.id]);assert.equal(m.has_image,true);assert.equal(m.available,true);
 const image=await request('/media/menu/'+menuId,undefined,{anonymous:true});assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');assert.equal(image.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await image.arrayBuffer()),png);
 await json('/api/admin/menu/'+menuId,{...input,description:'เฉพาะ Deluxe',packageIds:[child.id],imageData:null,version:m.version});m=await get();assert.deepEqual(m.package_ids,[child.id]);assert.equal(m.has_image,true,'metadata edit retains uploaded image');
 await error('/api/admin/menu/'+menuId,{...input,version:0},409);assert.deepEqual((await get()).package_ids,[child.id]);
 await json(`/api/admin/menu/${menuId}/status`,{active:false,version:m.version});m=await get();assert.equal(m.available,false);
 await error(`/api/admin/menu/${menuId}/status`,{active:true,version:m.version-1},409);
 await json('/api/admin/categories/'+categoryId,{...category,active:false});
 await error('/api/admin/categories/'+categoryId,{...category,active:true},409);
 await json(`/api/admin/menu/${menuId}/status`,{active:true,version:m.version});m=await get();assert.equal(m.active,true);assert.equal(m.available,false);assert.equal(m.category_active,false);
 await json('/api/admin/categories/'+categoryId,{...category,version:1,active:true});m=await get();assert.equal(m.available,true);
 await json('/api/admin/menu/'+menuId,{...input,version:m.version,packageIds:[adult.id,child.id],imageData:null,removeImage:true});m=await get();assert.deepEqual(m.package_ids,[adult.id,child.id].sort((a,b)=>a-b));assert.equal(m.has_image,false);
 assert.equal((await request('/media/menu/'+menuId,undefined,{anonymous:true})).status,404);
 await error('/api/admin/menu/99999999',{...input,imageData:null},404);
 console.log('PASS: menu/category CRUD, package restrictions/shared dishes, atomic validation, CSRF, stale edit/status versions, category availability, image validation/upload/persistence/removal, safe public image response');
 }finally{if(categoryId)sql(`BEGIN; DELETE FROM menu_packages WHERE menu_id IN (SELECT id FROM food_menus WHERE category_id=${categoryId}); DELETE FROM food_menus WHERE category_id=${categoryId}; DELETE FROM food_categories WHERE id=${categoryId}; COMMIT;`);}})().catch(e=>{console.error(e.message);process.exitCode=1;});
