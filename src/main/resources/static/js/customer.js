'use strict';
(() => {
 const $=s=>document.querySelector(s), esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const labels={PENDING:'รอรับออเดอร์',COOKING:'กำลังทำ',READY:'พร้อมเสิร์ฟ',SERVED:'เสิร์ฟแล้ว'};
 const token=document.body.dataset.token,base='/order/'+encodeURIComponent(token),storageKey='foodflow-pending-'+token;
 const app={data:null,cart:new Map(),view:'menu',category:'',query:'',page:0,pending:null,sending:false,loading:false,connected:false,request:0,offset:0,snapshot:'',expiredRendered:false};
 const uuid=()=>{const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;};
 const count=()=>Array.from(app.cart.values()).reduce((sum,item)=>sum+item.quantity,0);
 const remaining=()=>app.data?Math.max(0,Math.ceil((Date.parse(app.data.bill.ends_at)-Date.now()-app.offset)/1000)):0;
 const canOrder=()=>app.connected&&app.data?.bill.can_order&&remaining()>0;
 const status=value=>`<span class="customer-status ${value}">${labels[value]||esc(value)}</span>`;
 const time=value=>new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(new Date(value));
 function notice(text,error=false){$('#customerNotice').textContent=text;$('#customerNotice').classList.toggle('error',error);$('#customerNotice').hidden=!text;}
 function persist(){try{if(app.pending)sessionStorage.setItem(storageKey,JSON.stringify(app.pending));else sessionStorage.removeItem(storageKey);}catch{/* Keep the in-memory retry key if session storage is unavailable. */}}
 try{const pending=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(pending&&typeof pending.requestKey==='string'&&Array.isArray(pending.items)&&pending.items.length<=50){app.pending=pending;for(const item of pending.items)app.cart.set(Number(item.menuId),{id:Number(item.menuId),name:String(item.name||'รายการอาหาร'),emoji:String(item.emoji||'🍲'),quantity:Number(item.quantity)});app.view='cart';}}catch{/* An unreadable draft does not affect server order history. */}
 async function load(){
  const request=++app.request;app.loading=true;
  try{
   const response=await fetch(base+'/state?page='+app.page,{headers:{Accept:'application/json'},cache:'no-store'});
   const data=await response.json();if(!response.ok)throw Error(data.message||'ไม่สามารถโหลดข้อมูลโต๊ะได้');
   if(request!==app.request)return;
   const reconnect=!app.connected;app.connected=true;app.data=data;app.page=data.page;app.offset=Date.parse(data.server_time)-Date.now();
   const snapshot=JSON.stringify([data.bill,data.menus,data.rounds,data.total,data.page]);
   if(snapshot!==app.snapshot||reconnect){app.snapshot=snapshot;render();}else updateTime();
   if($('#customerNotice').dataset.network==='true'){notice('');delete $('#customerNotice').dataset.network;}
  }catch(error){if(request===app.request){app.connected=false;notice(error.message+' · ระบบจะลองเชื่อมต่อใหม่',true);$('#customerNotice').dataset.network='true';render();}}
  finally{if(request===app.request)app.loading=false;}
 }
 function controls(id,quantity){const disabled=app.sending||!!app.pending||!canOrder();return `<div class="quantity-controls">${quantity?`<button type="button" data-qty="${id}" data-delta="-1" aria-label="ลดจำนวน" ${app.sending||app.pending?'disabled':''}>−</button><output aria-live="polite">${quantity}</output>`:''}<button type="button" class="${quantity?'':'add-food'}" data-qty="${id}" data-delta="1" aria-label="เพิ่มจำนวน" ${disabled||quantity>=99?'disabled':''}>+</button></div>`;}
 function menu(){
  const categories=[...new Map(app.data.menus.map(m=>[String(m.category_id),m.category_name])).entries()];
  if(app.category&&!categories.some(([id])=>id===app.category))app.category='';
  const query=app.query.toLocaleLowerCase(),menus=app.data.menus.filter(m=>(!app.category||String(m.category_id)===app.category)&&[m.name,m.description,m.category_name].some(text=>text.toLocaleLowerCase().includes(query)));
  return `<div class="customer-search"><input id="foodSearch" type="search" placeholder="ค้นหาเมนูอาหาร…" aria-label="ค้นหาเมนูอาหาร" maxlength="100" value="${esc(app.query)}"><button type="button" data-clear-search aria-label="ล้างคำค้น">×</button></div><div class="category-tabs" aria-label="หมวดหมู่อาหาร">${[['','ทั้งหมด'],...categories].map(([id,name])=>`<button type="button" data-category="${id}" class="${id===app.category?'active':''}">${esc(name)}</button>`).join('')}</div><div class="customer-heading"><div><h1>เลือกอาหารได้เลย</h1><p class="customer-hint">กด + เพิ่มอาหาร แล้วส่งเข้าครัวพร้อมกัน</p></div><small>${menus.length} เมนู</small></div>${!app.data.bill.can_order?`<div class="customer-note">${app.data.bill.status==='PAID'?'บิลนี้ชำระเงินแล้ว QR นี้ใช้สั่งต่อไม่ได้':'หมดเวลาสั่งอาหารแล้ว ท่านยังทานต่อได้ กรุณาติดต่อพนักงานเมื่อต้องการเช็คบิล'}</div>`:''}<div class="food-grid">${menus.map(m=>`<article class="food-card"><div class="food-picture">${m.has_image?`<img src="/media/menu/${Number(m.id)}" alt="${esc(m.name)}" loading="lazy">`:esc(m.emoji)}</div><div class="food-body"><h2>${esc(m.name)}</h2><p>${esc(m.description)}</p><div class="food-actions"><span>รวมในบุฟเฟต์</span>${controls(m.id,app.cart.get(m.id)?.quantity||0)}</div></div></article>`).join('')}</div>${!menus.length?'<div class="customer-empty">ไม่พบอาหารที่สั่งได้ในขณะนี้</div>':''}`;
 }
 function cart(){
  const available=new Set(app.data.menus.map(m=>m.id)),unavailable=Array.from(app.cart.keys()).some(id=>!available.has(id));
  return `<div class="customer-heading"><div><h1>ตรวจสอบรายการ</h1><p class="customer-hint">ยืนยันครั้งเดียว ส่งเข้าครัวทันที</p></div><strong>${count()} จาน</strong></div>${Array.from(app.cart.values()).map(item=>`<article class="cart-line"><div><span class="cart-emoji">${esc(item.emoji)}</span> <strong>${esc(item.name)}</strong>${!available.has(item.id)&&canOrder()?'<small class="cart-warning">รายการนี้ไม่พร้อมขาย กรุณานำออกจากตะกร้า</small>':''}</div>${controls(item.id,item.quantity)}</article>`).join('')}${!count()?'<div class="customer-empty">ยังไม่มีอาหารในตะกร้า</div>':''}${app.pending?'<div class="customer-note">กำลังตรวจผลการส่งครั้งก่อน กดส่งรายการเดิมอีกครั้งได้ ระบบจะไม่สร้างออเดอร์ซ้ำ</div>':'<div class="customer-note">อาหารรวมในแพ็กเกจบุฟเฟต์ ไม่มีค่าบริการเพิ่มรายจาน</div>'}<button class="customer-primary" type="button" data-submit-order ${app.sending||!count()||(!app.pending&&(!canOrder()||unavailable))?'disabled':''}>${app.sending?'กำลังส่ง…':app.pending?'ตรวจผล / ส่งรายการเดิมอีกครั้ง':`ยืนยันส่งเข้าครัว · ${count()} จาน`}</button><button type="button" class="customer-secondary" data-customer-view="menu">เลือกอาหารเพิ่ม</button>`;
 }
 function orders(){return `<div class="customer-heading"><div><h1>ออเดอร์ของโต๊ะ ${esc(app.data.bill.table_name)}</h1><p class="customer-hint">รวมอาหารที่สั่งจากทุกเครื่องในบิลนี้</p></div><strong>${app.data.total} รอบ</strong></div>${app.data.rounds.map(round=>`<article class="customer-round"><header><div><h2>รอบที่ ${round.round_no}</h2><small>#${round.id} · ${time(round.created_at)}</small></div>${status(round.status)}</header><ul>${round.items.map(item=>`<li><span>${esc(item.emoji)} ${esc(item.menu_name)} ×${item.quantity}</span>${status(item.status)}</li>`).join('')}</ul></article>`).join('')}${!app.data.total?'<div class="customer-empty">ยังไม่มีออเดอร์ที่ส่งเข้าครัว</div>':''}${app.data.total>20?`<div class="customer-pagination"><button type="button" data-order-page="${app.page-1}" ${app.page===0?'disabled':''}>ก่อนหน้า</button><span>${app.page+1} / ${Math.ceil(app.data.total/20)}</span><button type="button" data-order-page="${app.page+1}" ${(app.page+1)*20>=app.data.total?'disabled':''}>ถัดไป</button></div>`:''}<button type="button" class="customer-primary" data-customer-view="menu" ${canOrder()?'':'disabled'}>+ สั่งอาหารเพิ่ม</button>`;}
 function info(){const b=app.data.bill;return `<div class="customer-heading"><h1>ข้อมูลการใช้บริการ</h1></div><article class="customer-info"><dl>${[['เลขที่บิล','#'+b.id],['โต๊ะ',b.table_name],['แพ็กเกจ',b.package_name],['จำนวนลูกค้า',b.guests+' คน'],['เวลาใช้บริการ',b.duration_minutes+' นาที'],['เริ่มบริการ',time(b.opened_at)],['สิ้นสุดบริการ',time(b.ends_at)],['สถานะ',b.status==='PAID'?'ชำระเงินแล้ว':remaining()?'กำลังใช้บริการ':'หมดเวลาสั่งอาหาร']].map(([key,value])=>`<div><dt>${key}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></article><div class="customer-note">เมื่อหมดเวลา ท่านยังทานต่อได้ แต่สั่งเพิ่มไม่ได้ กรุณาติดต่อพนักงานเมื่อต้องการเช็คบิล</div>`;}
 function updateTime(){
  if(!app.data)return;const seconds=remaining(),b=app.data.bill;
  $('#customerTime').textContent=b.status==='PAID'?'ชำระเงินเรียบร้อยแล้ว':seconds?`เวลาสั่งอาหารเหลือ ${Math.floor(seconds/3600)?Math.floor(seconds/3600)+':':''}${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`:'หมดเวลาสั่งอาหารแล้ว';
  $('#customerTime').classList.toggle('time-expired',!seconds||b.status==='PAID');
  if(!seconds&&!app.expiredRendered){app.expiredRendered=true;render();}else if(seconds)app.expiredRendered=false;
 }
 function render(){
  if(!app.data)return;const active=document.activeElement,focusId=active?.id,selection=active?.selectionStart;
  $('#customerShop').textContent=app.data.bill.shop_name;$('#customerTable').textContent='โต๊ะ '+app.data.bill.table_name;$('#customerPackage').textContent=app.data.bill.package_name||'บุฟเฟต์';
  $('#customerView').innerHTML=app.view==='cart'?cart():app.view==='orders'?orders():app.view==='info'?info():menu();
  document.querySelectorAll('.customer-nav button').forEach(button=>button.classList.toggle('active',button.dataset.customerView===app.view||(app.view==='cart'&&button.dataset.customerView==='menu')));
  $('#customerCartBar').innerHTML=app.view!=='cart'&&count()?`<button type="button" class="customer-primary customer-cart-bar" data-customer-view="cart">${app.pending?'ตรวจผลออเดอร์ที่ส่งไว้':`ดูตะกร้า · ${count()} จาน　ส่งออเดอร์ →`}</button>`:'';
  if(focusId){const field=document.getElementById(focusId);if(field){field.focus({preventScroll:true});try{field.setSelectionRange(selection,selection);}catch{}}}
  updateTime();
 }
 async function submit(){
  if(app.sending||!count()||(!app.pending&&!canOrder()))return;
  if(!app.pending){app.pending={requestKey:uuid(),items:Array.from(app.cart.values()).map(item=>({menuId:item.id,quantity:item.quantity,name:item.name,emoji:item.emoji}))};persist();}
  app.sending=true;render();
  try{
   const payload={requestKey:app.pending.requestKey,items:app.pending.items.map(({menuId,quantity})=>({menuId,quantity}))};
   const response=await fetch(base+'/rounds',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',[$('meta[name="_csrf_header"]').content]:$('meta[name="_csrf"]').content},body:JSON.stringify(payload)});
   if(!(response.headers.get('Content-Type')||'').includes('application/json'))throw Error('กรุณารีเฟรชหน้านี้ แล้วตรวจผลรายการเดิมอีกครั้ง');
   const result=await response.json();
   if(!response.ok){if([400,404,409].includes(response.status)){app.pending=null;persist();await load();}throw Error(result.message||'ส่งออเดอร์ไม่สำเร็จ');}
   app.pending=null;persist();app.cart.clear();app.view='orders';app.page=0;notice(`ส่งออเดอร์รอบที่ ${result.round_no} เข้าครัวแล้ว`);await load();
  }catch(error){notice(error.message,true);}finally{app.sending=false;render();}
 }
 document.addEventListener('click',event=>{
  const target=event.target.closest('button');if(!target||target.disabled)return;
  if(target.dataset.customerView){app.view=target.dataset.customerView;render();}
  if(target.dataset.category!==undefined){app.category=target.dataset.category;render();}
  if(target.hasAttribute('data-clear-search')){app.query='';render();$('#foodSearch')?.focus();}
  if(target.dataset.qty&&!app.sending&&!app.pending){
   const id=Number(target.dataset.qty),delta=Number(target.dataset.delta);if(delta>0&&!canOrder())return;
   const menu=app.data.menus.find(item=>item.id===id),existing=app.cart.get(id);if(!menu&&!existing)return;
   const quantity=(existing?.quantity||0)+delta;if(quantity>99)return;
   if(quantity<=0)app.cart.delete(id);else if(app.cart.size<50||existing)app.cart.set(id,{id,name:menu?.name||existing.name,emoji:menu?.emoji||existing.emoji,quantity});else notice('ส่งได้ไม่เกิน 50 เมนูต่อรอบ กรุณาส่งรอบนี้ก่อน',true);
   render();
  }
  if(target.hasAttribute('data-submit-order'))submit();
  if(target.dataset.orderPage!==undefined){app.page=Number(target.dataset.orderPage);load();}
 });
 let searchTimer;document.addEventListener('input',event=>{if(event.target.id==='foodSearch'){app.query=event.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(render,180);}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!app.sending)load();});
 setInterval(()=>{if(!document.hidden&&!app.loading&&!app.sending)load();},3000);
 setInterval(updateTime,1000);load();
})();
