'use strict';
const orderLabels={PENDING:'รอรับออเดอร์',COOKING:'กำลังทำ',READY:'พร้อมเสิร์ฟ',SERVED:'เสิร์ฟแล้ว'};
const orderNext={PENDING:'COOKING',COOKING:'READY',READY:'SERVED'};
const orderActions={COOKING:'เริ่มทำ',READY:'พร้อมเสิร์ฟ',SERVED:'เสิร์ฟแล้ว'};
const foodOrders={data:null,filter:'ACTIVE',query:'',page:0,size:20,request:0,loading:false,mutating:false,detailId:null,snapshot:'',
 async load(){
  const request=++this.request;this.loading=true;
  try{
   const data=await api('/api/admin/orders?'+new URLSearchParams({status:this.filter,q:this.query,page:this.page,size:this.size}));
   if(request!==this.request)return false;
   const snapshot=JSON.stringify([data.items,data.total,data.page,data.size,data.counts]);const changed=snapshot!==this.snapshot;
   this.snapshot=snapshot;this.data=data;this.page=data.page;return changed;
  }finally{if(request===this.request)this.loading=false;}
 },
 stamp(error){const label=$('#ordersConnection');if(label){label.textContent=error||'อัปเดต '+new Intl.DateTimeFormat('th-TH',{timeStyle:'medium',timeZone:'Asia/Bangkok'}).format(new Date())+' · อัตโนมัติทุก 3 วินาที';label.classList.toggle('text-danger',!!error);}},
 async update(){try{await this.load();this.render();}catch(error){this.stamp(error.message);toast(error.message);}},
 canChange(target){return document.body.dataset.role!=='CASHIER'||target==='SERVED';},
 printLink(round){return `<a class="btn btn-outline-secondary order-print-link" href="/admin/orders/${Number(round.id)}/print" target="_blank" rel="noopener noreferrer"><i class="bx bx-printer" aria-hidden="true"></i> พิมพ์ใบสั่งอาหาร</a>`;},
 chip(status){return `<span class="order-chip ${status}">${orderLabels[status]}</span>`;},
 action(round,item){const current=item?.status||round.status,next=orderNext[current];if(!next||!this.canChange(next))return '';return `<button type="button" class="btn order-action ${next}" data-order-status="${next}" data-round-id="${round.id}" data-order-version="${round.version}" ${item?`data-item-id="${item.id}"`:''} ${this.mutating?'disabled':''}>${item?orderActions[next]:next==='COOKING'?'รับรายการที่รอทั้งหมด':next==='READY'?'อาหารที่กำลังทำพร้อมเสิร์ฟทั้งหมด':'ยืนยันเสิร์ฟรายการที่พร้อมทั้งหมด'}</button>`;},
 items(round,actions=false){return `<ul class="order-items">${round.items.map(item=>`<li><div><strong>${escapeHtml(item.emoji)} ${escapeHtml(item.menu_name)}</strong><small>${escapeHtml(item.category_name)} · ×${item.quantity}</small></div><div class="order-item-status">${this.chip(item.status)}${actions?this.action(round,item):''}</div></li>`).join('')}</ul>`;},
 card(round){return `<article class="order-card ${round.status}"><header><div><h3>โต๊ะ ${escapeHtml(round.table_name)} <small>รอบ ${round.round_no}</small></h3><span>ออเดอร์ #${round.id} · บิล #${round.bill_id}</span></div><small>${date(round.created_at)}</small></header>${round.bill_status==='PAID'?'<div class="order-closed">บิลชำระเงินแล้ว · ตรวจสอบก่อนเสิร์ฟ</div>':''}${this.items(round,true)}<div class="order-card-total">รวม ${round.quantity} จาน</div><div class="order-card-actions"><button type="button" class="btn btn-outline-secondary" data-order-detail="${round.id}">รายละเอียด</button>${this.printLink(round)}${this.action(round)}</div></article>`;},
 render(){
  if(!this.data)return;
  const active=document.activeElement,focusId=active?.id,selection=active?.selectionStart;
  $('#pageActions').innerHTML='<button class="btn btn-outline-secondary" type="button" data-order-refresh>↻ อัปเดต</button>';
  const counts=this.data.counts;
  const summary=`<div class="order-stats">${Object.entries(orderLabels).map(([key,label])=>`<button type="button" class="order-stat ${key}" data-order-filter="${key}" aria-label="${label}"><span>${label}${key==='SERVED'?'วันนี้':''}</span><strong>${counts[key]||0}</strong></button>`).join('')}</div>`;
  const filters=`<div class="order-toolbar"><input class="form-control" id="orderQuery" type="search" placeholder="ค้นหาโต๊ะ / เลขออเดอร์ / เลขบิล" aria-label="ค้นหาออเดอร์" maxlength="100" value="${escapeHtml(this.query)}"><button type="button" class="btn btn-outline-secondary" data-order-clear>ล้างค่า</button><select class="form-select" id="orderFilter" aria-label="สถานะออเดอร์">${Object.entries({ACTIVE:'ออเดอร์ที่ยังไม่เสร็จ',ALL:'ประวัติทั้งหมด',...orderLabels}).map(([value,label])=>`<option value="${value}" ${value===this.filter?'selected':''}>${label}</option>`).join('')}</select><select class="form-select" id="orderSize" aria-label="จำนวนต่อหน้า">${[20,50,100].map(size=>`<option value="${size}" ${size===this.size?'selected':''}>${size} รอบ / หน้า</option>`).join('')}</select></div><p id="ordersConnection" class="small muted" role="status"></p>`;
  const list=page==='/admin/kds'&&this.filter!=='SERVED'&&this.filter!=='ALL'?`<div class="kds-board">${['PENDING','COOKING','READY'].filter(status=>this.filter==='ACTIVE'||this.filter===status).map(status=>`<section class="kds-column"><h2>${orderLabels[status]} <span>${this.data.items.filter(order=>order.status===status).length}</span></h2>${this.data.items.filter(order=>order.status===status).map(order=>this.card(order)).join('')||'<div class="empty">ยังไม่มีรายการ</div>'}</section>`).join('')}</div>`:page==='/admin/kds'?`<div class="order-history-grid">${this.data.items.map(order=>this.card(order)).join('')}</div>`:this.table();
  $('#content').innerHTML=summary+filters+list+`<div class="order-pagination"><button type="button" class="btn btn-outline-secondary" data-order-page="${this.page-1}" ${!this.page?'disabled':''}>← ก่อนหน้า</button><span>พบ ${this.data.total} รอบ · หน้า ${this.page+1} / ${Math.max(1,Math.ceil(this.data.total/this.size))}</span><button type="button" class="btn btn-outline-secondary" data-order-page="${this.page+1}" ${(this.page+1)*this.size>=this.data.total?'disabled':''}>ถัดไป →</button></div>`;
  if(focusId){const input=document.getElementById(focusId);if(input){input.focus({preventScroll:true});try{input.setSelectionRange(selection,selection);}catch{}}}
  this.stamp();
 },
 table(){return `<div class="card section-card"><div class="table-responsive"><table class="table mb-0"><thead><tr><th>ออเดอร์ / บิล</th><th>โต๊ะ</th><th>รอบ</th><th>รายการอาหาร</th><th>เวลาสั่ง</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${this.data.items.map(round=>`<tr><td><strong>#${round.id}</strong><small class="d-block muted">บิล #${round.bill_id}</small></td><td>${escapeHtml(round.table_name)}${round.bill_status==='PAID'?'<small class="d-block text-danger">ชำระเงินแล้ว</small>':''}</td><td>${round.round_no}</td><td>${round.items.map(item=>`${escapeHtml(item.menu_name)} ×${item.quantity}`).join('<br>')}</td><td>${date(round.created_at)}</td><td>${this.chip(round.status)}</td><td><div class="action-row"><button type="button" class="btn btn-soft" data-order-detail="${round.id}">รายละเอียด</button>${this.printLink(round)}${this.action(round)}</div></td></tr>`).join('')}</tbody></table></div>${this.data.items.length?'':empty('ไม่พบออเดอร์ตามตัวกรอง')}</div>`;},
 async detail(id){const round=await api('/api/admin/orders/'+id);this.detailId=Number(id);showModal('โต๊ะ '+round.table_name+' · ออเดอร์ #'+round.id,this.detailBody(round),null);},
 async bill(id,pageNumber=0){
  this.detailId=null;
  const data=await api('/api/admin/orders?'+new URLSearchParams({billId:id,status:'ALL',page:pageNumber,size:20}));
  showModal('ออเดอร์อาหาร · บิล #'+id,data.items.map(round=>`<article class="mb-4"><div class="d-flex justify-content-between align-items-center"><strong>รอบ ${round.round_no} · #${round.id}</strong>${this.chip(round.status)}</div><p class="small muted mt-2">${date(round.created_at)} · โต๊ะ ${escapeHtml(round.table_name)}</p>${this.items(round)}<button type="button" class="btn btn-soft mt-2" data-order-detail="${round.id}">รายละเอียด / จัดการ</button></article>`).join('')+(data.total?'':empty('ยังไม่มีออเดอร์อาหารในบิลนี้'))+`<div class="order-pagination"><button type="button" class="btn btn-outline-secondary" data-bill-orders="${id}" data-bill-order-page="${data.page-1}" ${data.page===0?'disabled':''}>ก่อนหน้า</button><span>${data.total} รอบ · หน้า ${data.page+1} / ${Math.max(1,Math.ceil(data.total/20))}</span><button type="button" class="btn btn-outline-secondary" data-bill-orders="${id}" data-bill-order-page="${data.page+1}" ${(data.page+1)*20>=data.total?'disabled':''}>ถัดไป</button><button type="button" class="btn btn-soft" data-bill-orders="${id}" data-bill-order-page="${data.page}">อัปเดต</button></div>`,null);
 },
 detailBody(round){return `<div class="d-flex align-items-center justify-content-between gap-2"><strong>รอบ ${round.round_no} · บิล #${round.bill_id}</strong>${this.chip(round.status)}</div><p class="small muted mt-2">${date(round.created_at)} · ${escapeHtml(round.package_name)}<br>โต๊ะตอนสั่ง ${escapeHtml(round.table_name_at_order)} · โต๊ะปัจจุบัน ${escapeHtml(round.table_name)}</p>${round.bill_status==='PAID'?'<div class="order-closed">บิลชำระเงินแล้ว · ตรวจสอบก่อนเสิร์ฟ</div>':''}${this.items(round,true)}<p class="small muted">เปลี่ยนทีละเมนูได้ ปุ่มรวมจะเปลี่ยนเฉพาะรายการที่อยู่ขั้นเดียวกับสถานะของรอบ</p><div class="action-row">${this.printLink(round)}${this.action(round)}</div>`;},
 async change(button){
  if(this.mutating)return;this.mutating=true;document.querySelectorAll('[data-order-status]').forEach(el=>el.disabled=true);
  const id=Number(button.dataset.roundId);
  try{await api('/api/admin/orders/'+id+'/status',{status:button.dataset.orderStatus,version:Number(button.dataset.orderVersion),itemId:button.dataset.itemId?Number(button.dataset.itemId):null});toast('อัปเดตสถานะอาหารแล้ว');}
  catch(error){toast(error.message);}
  finally{
   let detail;
   try{await this.load();if(this.detailId===id&&$('#editor').classList.contains('show'))detail=await api('/api/admin/orders/'+id);}catch(error){this.stamp(error.message);toast(error.message);}
   finally{this.mutating=false;if(['/admin/orders','/admin/kds'].includes(page))this.render();if(detail&&this.detailId===id&&$('#editor').classList.contains('show'))$('#modalBody').innerHTML=this.detailBody(detail);}
  }
 }
};
let orderSearchTimer;
document.addEventListener('input',event=>{if(event.target.id==='orderQuery'){foodOrders.query=event.target.value;foodOrders.page=0;clearTimeout(orderSearchTimer);orderSearchTimer=setTimeout(()=>foodOrders.update(),250);}});
document.addEventListener('change',event=>{if(event.target.id==='orderFilter'||event.target.id==='orderSize'){foodOrders.filter=$('#orderFilter').value;foodOrders.size=Number($('#orderSize').value);foodOrders.page=0;foodOrders.update();}});
document.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button||button.disabled)return;
 try{
  if(button.dataset.orderDetail)await foodOrders.detail(button.dataset.orderDetail);
  if(button.dataset.billOrders)await foodOrders.bill(Number(button.dataset.billOrders),Number(button.dataset.billOrderPage||0));
  if(button.dataset.orderStatus)await foodOrders.change(button);
  if(button.hasAttribute('data-order-refresh'))await foodOrders.update();
  if(button.dataset.orderPage!==undefined){foodOrders.page=Number(button.dataset.orderPage);await foodOrders.update();}
  if(button.dataset.orderFilter){foodOrders.filter=button.dataset.orderFilter;foodOrders.page=0;await foodOrders.update();}
  if(button.hasAttribute('data-order-clear')){foodOrders.query='';foodOrders.page=0;await foodOrders.update();}
 }catch(error){toast(error.message);}
});
$('#editor').addEventListener('hidden.bs.modal',()=>foodOrders.detailId=null);
async function pollOrders(){
 if(!['/admin/orders','/admin/kds'].includes(page)||document.hidden||foodOrders.loading||foodOrders.mutating)return;
 try{
  if(await foodOrders.load())foodOrders.render();else foodOrders.stamp();
  if(foodOrders.detailId&&$('#editor').classList.contains('show')){
   const round=await api('/api/admin/orders/'+foodOrders.detailId);$('#modalTitle').textContent='โต๊ะ '+round.table_name+' · ออเดอร์ #'+round.id;$('#modalBody').innerHTML=foodOrders.detailBody(round);
  }
 }catch(error){foodOrders.stamp('เชื่อมต่อไม่สำเร็จ · '+error.message+' · กำลังลองใหม่');}
}
setInterval(pollOrders,3000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollOrders();});
