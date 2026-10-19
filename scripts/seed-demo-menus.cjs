// Add sample menus through the admin API. Default: preview; --apply: create missing items.
// Existing menus, categories and package switches are preserved.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/demo-menu-catalog.json'),'utf8'));
const env=Object.fromEntries(fs.readFileSync(path.join(root,'.env'),'utf8').trim().split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).replace(/^\uFEFF/,''),l.slice(i+1)];}));
const base=`http://localhost:${env.APP_PORT||8088}`,apply=process.argv.includes('--apply');
let cookie='',csrf='';
const normalize=name=>name.normalize('NFC').trim().toLowerCase();
async function request(url,body){
 const headers={Cookie:cookie,Accept:'application/json'};
 if(body!==undefined){headers['Content-Type']='application/json';headers['X-CSRF-TOKEN']=csrf;}
 const response=await fetch(base+url,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});
 if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
 return response;
}
async function api(url,body){const response=await request(url,body);if(response.status!==200)throw Error(`${url}: ${response.status} ${await response.text()}`);return response.json();}
(async()=>{
 const login=await request('/login');csrf=(await login.text()).match(/name="_csrf"[^>]*value="([^"]+)"/)[1];
 const signed=await fetch(base+'/login',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:env.ADMIN_USERNAME||'admin',password:env.ADMIN_PASSWORD,_csrf:csrf}),redirect:'manual'});
 assert.equal(signed.status,302,'Admin sign-in failed');assert(signed.headers.get('set-cookie'),'No admin session');cookie=signed.headers.get('set-cookie').split(';')[0];
 const admin=await request('/admin/menu');csrf=(await admin.text()).match(/name="_csrf" content="([^"]+)"/)[1];
 const before=await api('/api/admin/state'),categories=new Map(before.categories.map(c=>[normalize(c.name),c])),packages=new Map(before.packages.map(p=>[normalize(p.name),p]));
 // Validate the entire input before creating anything.
 const plan=[],seen=new Set(),existing=new Map(before.menus.map(m=>[`${m.category_id}:${normalize(m.name)}`,m]));
 for(const group of catalog.groups){
  const category=categories.get(normalize(group.category));assert(category,`Missing category: ${group.category}`);
  let sortOrder=Math.max(0,...before.menus.filter(m=>m.category_id===category.id).map(m=>m.sort_order));
  for(const item of group.items){
   const tier=catalog.packageTiers.indexOf(item.tier);assert(tier>=0,`Invalid tier: ${item.name}`);
   assert(item.name.trim()&&item.name.length<=120&&item.description.length<=250,`Invalid menu: ${item.name}`);
   const packageIds=catalog.packageTiers.slice(tier).map(name=>{const p=packages.get(normalize(name));assert(p,`Missing package: ${name}`);return p.id;});
   const key=`${category.id}:${normalize(item.name)}`;assert(!seen.has(key),`Duplicate sample menu: ${item.name}`);seen.add(key);
   plan.push({existing:existing.get(key),category:group.category,body:{name:item.name,categoryId:category.id,description:item.description,emoji:group.emoji,sortOrder:sortOrder+=10,active:true,version:0,packageIds,removeImage:false}});
  }
 }
 const missing=plan.filter(p=>!p.existing);
 console.log(JSON.stringify({mode:apply?'apply':'preview',catalogItems:plan.length,existing:plan.length-missing.length,toCreate:missing.length,categories:catalog.groups.map(g=>({name:g.category,items:g.items.length}))},null,2));
 if(!apply)return;
 const created=[];
 for(const item of missing){const result=await api('/api/admin/menu',item.body);created.push({id:result.id,name:item.body.name,category:item.category});}
 const after=await api('/api/admin/state');
 for(const item of plan){const found=after.menus.find(m=>m.category_id===item.body.categoryId&&normalize(m.name)===normalize(item.body.name));assert(found,`Menu not found after seeding: ${item.body.name}`);if(!item.existing){assert.equal(found.active,true);assert.deepEqual([...found.package_ids].sort((a,b)=>a-b),[...item.body.packageIds].sort((a,b)=>a-b));}}
 for(const previous of before.menus)assert.deepEqual(after.menus.find(m=>m.id===previous.id),previous,'Existing menu changed');
 fs.mkdirSync(path.join(root,'.runtime'),{recursive:true});fs.writeFileSync(path.join(root,'.runtime/menu-seed-last-result.json'),JSON.stringify({created,preserved:before.menus.length,verifiedAt:new Date().toISOString()},null,2));
 console.log(JSON.stringify({created:created.length,preserved:before.menus.length,totalMenus:after.menus.length,categories:after.categories.map(c=>({name:c.name,menus:c.menu_count})),packageMenus:after.packages.map(p=>({name:p.name,menus:after.menus.filter(m=>m.package_ids.includes(p.id)).length}))},null,2));
})().catch(error=>{console.error(error.message);console.error('If interrupted, run again to add only missing menus.');process.exitCode=1;});
