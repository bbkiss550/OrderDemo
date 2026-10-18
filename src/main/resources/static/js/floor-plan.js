'use strict';
const floorPlan={id:null,layout:null,draft:[],design:page==='/admin/floor-plan',dirty:false,selected:null,cells:new Set(),replace:false,additive:false,ignoreClick:false,
 async load(){if(this.dirty)return;if(!state.floors.some(f=>f.id===this.id))this.id=state.floors[0]?.id??null;this.layout=this.id?await api(`/api/admin/floors/${this.id}/layout`):null;this.draft=this.layout?structuredClone(this.layout.tables):[];this.cells.clear();},
 tableKey(t){return String(t.id??t.key);},
 mark(){this.dirty=true;this.render();},
 render(){
  this.cancelGesture?.();
  $('#pageActions').innerHTML=this.design?'<button class="btn btn-outline-primary" data-floor="add">+ เพิ่มชั้น</button>':button('↻ อัปเดต','refresh','','btn-outline-secondary');
  if(!this.layout){$('#content').innerHTML=empty(this.design?'เพิ่มชั้นเพื่อเริ่มออกแบบผังโต๊ะ':'ยังไม่มีผังโต๊ะ กรุณาให้ผู้ดูแลจัดการผังโต๊ะก่อนรับลูกค้า');return;}
  const f=this.layout.floor, tables=this.design?this.draft:this.layout.tables, occupied=new Map();
  tables.forEach(t=>t.cells.forEach(c=>occupied.set(`${c.row},${c.column}`,t)));
  const floorTabs=`<nav class="floor-tabs" aria-label="เลือกชั้น">${state.floors.map(x=>`<button class="btn ${x.id===this.id?'btn-primary':'btn-outline-secondary'}" data-floor="choose" data-id="${x.id}" aria-pressed="${x.id===this.id}">${escapeHtml(x.name)} <small>(${x.table_count} โต๊ะ)</small></button>`).join('')}</nav>`;
  const floorHeader=this.design?`<div class="card floor-header"><div><h3>${escapeHtml(f.name)}</h3><span class="muted">${f.grid_rows} แถว × ${f.grid_columns} คอลัมน์</span></div><div class="floor-tools">${this.replace?'<button class="btn btn-outline-secondary btn-sm" data-floor="cancel-area">ยกเลิกเลือกพื้นที่</button>':''}<button class="btn btn-outline-secondary btn-sm" data-floor="floor-options">จัดการชั้น</button><button class="btn btn-primary btn-sm" data-floor="save" ${!this.dirty?'disabled':''}>บันทึกผัง</button></div></div>`:'';
  const legend=`<div class="floor-legend"><span><i class="swatch free"></i> ว่าง</span><span><i class="swatch occupied"></i> ไม่ว่าง</span><span><i class="swatch closed"></i> ปิดรับ / ปรับปรุง</span><span>◷ หมดเวลาสั่งอาหาร</span>${this.dirty?'<strong class="text-primary">มีการแก้ไขที่ยังไม่บันทึก</strong>':''}</div>`;
  const workspace=`<div class="floor-workspace"><div class="card floor-canvas"><div class="floor-scroll"><div id="floorBoard" class="floor-board ${this.design?'design':''}" style="--columns:${f.grid_columns};--rows:${f.grid_rows}" role="group" aria-label="ผังโต๊ะ ${escapeHtml(f.name)}">${Array.from({length:f.grid_rows*f.grid_columns},(_,i)=>{const row=Math.floor(i/f.grid_columns),column=i%f.grid_columns,key=`${row},${column}`,t=occupied.get(key),first=t&&t.cells[0].row===row&&t.cells[0].column===column,status=t?(!t.active?'closed':t.bill_id?'occupied':'free'):'blank',joined=t?['top','right','bottom','left'].filter((_,n)=>{const [dr,dc]=[[-1,0],[0,1],[1,0],[0,-1]][n];return occupied.get(`${row+dr},${column+dc}`)===t;}).map(edge=>'join-'+edge).join(' '):'';return `<button type="button" class="floor-cell ${status} ${joined} ${t&&this.tableKey(t)===this.selected?'table-selected':''} ${this.cells.has(key)?'cell-selected':''}" data-cell="${key}" ${t?`data-table="${this.tableKey(t)}"`:''} aria-label="${t?`${escapeHtml(t.name)} ${t.capacity} ที่นั่ง ${!t.active?'ปิดรับ':t.bill_id?t.expired?'ไม่ว่าง หมดเวลา':'ไม่ว่าง':'ว่าง'} · `:''}แถว ${row+1} คอลัมน์ ${column+1}" ${!this.design&&!t?'disabled':''} aria-pressed="${this.design?this.cells.has(key):Boolean(t&&this.tableKey(t)===this.selected)}">${first?`<strong>${escapeHtml(t.name)}</strong><small>${t.capacity} ที่นั่ง</small>${t.expired&&t.bill_id?'<span class="expired-marker">◷ หมดเวลา</span>':''}`:''}</button>`;}).join('')}</div></div></div></div>`;
  $('#content').innerHTML=
   `<div class="floor-layout"><aside class="card floor-selector"><h2>เลือกชั้น</h2>${floorTabs}</aside><div class="floor-main">${floorHeader}${workspace}${legend}</div></div>`;
  this.bindDrag();
 },
 finishSelection(){if(!this.cells.size)return;this.additive=false;if(this.replace){const t=this.draft.find(x=>this.tableKey(x)===this.selected);if(!t)return;showModal('ปรับพื้นที่โต๊ะ '+t.name,`<p>ใช้พื้นที่ที่เลือก ${this.cells.size} ช่องแทนพื้นที่เดิม ${t.cells.length} ช่อง?</p><button type="button" class="btn btn-outline-secondary" data-floor="continue-selection">เลือกพื้นที่เพิ่ม</button>`,()=>{t.cells=this.selectionCells();this.cells.clear();this.replace=false;this.dirty=true;return {skipRefresh:true,message:'ปรับพื้นที่แล้ว กดบันทึกผังเพื่อใช้งาน'};},'ใช้พื้นที่นี้');}else this.editTable(null);},
 servicePanel(t){if(!t)return '<h3>เลือกโต๊ะในผัง</h3><p class="mt-2 muted">เปิดบิล ดู QR เช็คบิล หรือจัดการสถานะโต๊ะได้ที่นี่</p>';return `<p class="mt-2">${t.capacity} ที่นั่ง · ${t.cells.length} ช่อง</p>${badge(!t.active?'ปิดรับ':t.bill_id?'ไม่ว่าง':'ว่าง',!t.active?'red':t.bill_id?'gray':'green')}${t.bill_id?`<p class="mt-3">ลูกค้า ${t.guests} คน<br>สิ้นสุด ${date(t.ends_at)}</p>${t.expired?'<div class="warning-strip">◷ หมดเวลาสั่งอาหาร<br>ลูกค้ายังทานต่อได้</div>':''}<div class="floor-stack mt-3">${button('รายละเอียด / QR','bill',t.bill_id)}${button('ย้ายบิลไปโต๊ะอื่น','move',t.bill_id)}${button('เช็คบิล','checkout',t.bill_id,'btn-primary')}</div>`:`${!t.active?`<p class="mt-3 muted">${escapeHtml(t.closure_reason||'ปิดปรับปรุงชั่วคราว')}</p>`:''}<div class="floor-stack mt-3">${t.active?button('รับลูกค้า / เปิดบิล','open',t.id,'btn-primary'):''}<button class="btn btn-outline-${t.active?'danger':'success'}" data-floor="availability" data-id="${t.id}">${t.active?'ปิดรับ / ปรับปรุง':'เปิดรับลูกค้าอีกครั้ง'}</button></div>`}`;},
 selectionCells(){return Array.from(this.cells,k=>{const [row,column]=k.split(',').map(Number);return {row,column};});},
 availableCell(key){const t=this.draft.find(t=>t.cells.some(c=>`${c.row},${c.column}`===key));return !t||(this.replace&&this.tableKey(t)===this.selected);},
 bindDrag(){
  const board=$('#floorBoard');
  if(!this.design){board.onclick=e=>{const el=e.target.closest('[data-table]');if(el){this.selected=el.dataset.table;const table=this.layout.tables.find(t=>this.tableKey(t)===this.selected);this.render();if(table)showModal('โต๊ะ '+table.name,this.servicePanel(table),null);}};return;}
  let drag=null,previewElements=[],sourceElements=[];
  const elements=new Map(Array.from(board.querySelectorAll('[data-cell]'),el=>[el.dataset.cell,el]));
  elements.forEach(el=>{if(el.dataset.table)el.title='คลิกเพื่อแก้ไข · กดค้างแล้วลากเพื่อย้าย';});
  const highlight=()=>elements.forEach((el,key)=>{el.classList.toggle('cell-selected',this.cells.has(key));el.setAttribute('aria-pressed',this.cells.has(key));});
  const point=(x,y,clamp)=>{
   const rect=board.getBoundingClientRect(),first=board.firstElementChild.getBoundingClientRect(),style=getComputedStyle(board);
   let row=Math.floor((y-rect.top)/(first.height+parseFloat(style.rowGap||0))),column=Math.floor((x-rect.left)/(first.width+parseFloat(style.columnGap||0)));
   if(clamp){row=Math.max(0,Math.min(this.layout.floor.grid_rows-1,row));column=Math.max(0,Math.min(this.layout.floor.grid_columns-1,column));}
   return {row,column,inside:x>=rect.left&&x<rect.right&&y>=rect.top&&y<rect.bottom};
  };
  const clearPreview=()=>{previewElements.forEach(el=>el.classList.remove('cell-drop-valid','cell-drop-invalid'));sourceElements.forEach(el=>el.classList.remove('table-drag-source'));previewElements=[];sourceElements=[];board.classList.remove('table-dragging','drop-blocked');};
  const preview=(gesture,x,y)=>{
   const target=point(x,y,false),dr=target.row-gesture.r,dc=target.column-gesture.c;
   const cells=gesture.origin.map(c=>({row:c.row+dr,column:c.column+dc}));
   const valid=target.inside&&cells.every(c=>c.row>=0&&c.column>=0&&c.row<this.layout.floor.grid_rows&&c.column<this.layout.floor.grid_columns&&!gesture.occupied.has(`${c.row},${c.column}`));
   previewElements.forEach(el=>el.classList.remove('cell-drop-valid','cell-drop-invalid'));
   previewElements=cells.map(c=>elements.get(`${c.row},${c.column}`)).filter(Boolean);
   previewElements.forEach(el=>el.classList.add(valid?'cell-drop-valid':'cell-drop-invalid'));
   board.classList.toggle('drop-blocked',!valid);
   return {cells,valid,changed:dr!==0||dc!==0};
  };
  const finish=()=>{
   const gesture=drag;drag=null;clearTimeout(gesture?.timer);window.removeEventListener('blur',abort);
   if(gesture&&board.hasPointerCapture(gesture.pointer))board.releasePointerCapture(gesture.pointer);
   clearPreview();return gesture;
  };
  const blockClick=()=>{this.ignoreClick=true;setTimeout(()=>this.ignoreClick=false,0);};
  const restore=gesture=>{if(gesture?.kind==='selection'){this.cells=new Set(gesture.previousCells);this.selected=gesture.previousSelected;}};
  const abort=()=>{if(!drag)return;restore(finish());blockClick();this.render();};
  this.cancelGesture=()=>{restore(finish());};
  board.onpointerdown=e=>{
   if(drag||e.button!==0)return;
   const el=e.target.closest('[data-cell]');if(!el)return;
   const [r,c]=el.dataset.cell.split(',').map(Number),table=!this.replace&&el.dataset.table?this.draft.find(t=>this.tableKey(t)===el.dataset.table):null;
   if(!table&&!this.availableCell(el.dataset.cell))return;
   e.preventDefault();el.focus({preventScroll:true});
   if(table){
    const gesture={kind:'table',pointer:e.pointerId,r,c,table,origin:table.cells.map(cell=>({...cell})),x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,active:false,cancelled:false,
     occupied:new Set(this.draft.filter(t=>t!==table).flatMap(t=>t.cells.map(cell=>`${cell.row},${cell.column}`)))};
    drag=gesture;
    gesture.timer=setTimeout(()=>{if(drag!==gesture||gesture.cancelled||!board.isConnected)return;gesture.active=true;board.classList.add('table-dragging');sourceElements=gesture.origin.map(cell=>elements.get(`${cell.row},${cell.column}`)).filter(Boolean);sourceElements.forEach(cell=>cell.classList.add('table-drag-source'));preview(gesture,gesture.x,gesture.y);},350);
   }else{
    drag={kind:'selection',pointer:e.pointerId,r,c,base:this.additive?new Set(this.cells):new Set(),previousCells:new Set(this.cells),previousSelected:this.selected,startedSelected:this.cells.has(el.dataset.cell),moved:false};
    if(!this.replace)this.selected=null;
    if(drag.startedSelected)this.cells.delete(el.dataset.cell);else this.selectRectangle(drag,r,c);
    highlight();
   }
   board.setPointerCapture(e.pointerId);window.addEventListener('blur',abort);
  };
  board.onpointermove=e=>{
   if(!drag||drag.pointer!==e.pointerId||drag.cancelled)return;
   if(drag.kind==='table'){
    drag.x=e.clientX;drag.y=e.clientY;
    if(drag.active)preview(drag,e.clientX,e.clientY);
    else if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>8){clearTimeout(drag.timer);drag.cancelled=true;}
   }else{const target=point(e.clientX,e.clientY,true);drag.moved=drag.moved||target.row!==drag.r||target.column!==drag.c;if(drag.moved){this.selectRectangle(drag,target.row,target.column);highlight();}}
  };
  board.onpointerup=e=>{
   if(!drag||drag.pointer!==e.pointerId)return;
   const drop=drag.kind==='table'&&drag.active&&!drag.cancelled?preview(drag,e.clientX,e.clientY):null;
   const gesture=finish();blockClick();
   if(gesture.cancelled){restore(gesture);this.render();return;}
   if(gesture.kind==='selection'){
    if(gesture.startedSelected&&!gesture.moved){this.cells=new Set(gesture.previousCells);this.cells.delete(`${gesture.r},${gesture.c}`);this.render();return;}
    this.render();this.finishSelection();return;
   }
   if(!gesture.active){this.selected=this.tableKey(gesture.table);this.render();this.editTable(gesture.table);return;}
   if(drop.valid&&drop.changed){gesture.table.cells=drop.cells;this.selected=this.tableKey(gesture.table);this.cells.clear();this.dirty=true;toast('ย้ายโต๊ะแล้ว กดบันทึกผังเพื่อใช้งาน');}
   else if(!drop.valid)toast('วางตำแหน่งนี้ไม่ได้: โต๊ะทับกันหรืออยู่นอกผัง');
   this.render();
  };
  board.onpointercancel=e=>{if(drag?.pointer===e.pointerId)abort();};
  board.onlostpointercapture=()=>{if(drag)abort();};
  board.onkeydown=e=>{if(e.key==='Escape'&&drag){e.preventDefault();e.stopPropagation();clearTimeout(drag.timer);drag.cancelled=true;clearPreview();restore(drag);highlight();}};
  board.oncontextmenu=e=>e.preventDefault();
  board.ondragstart=e=>e.preventDefault();
  board.onclick=e=>{if(this.ignoreClick)return;const el=e.target.closest('[data-cell]');if(!el)return;if(el.dataset.table&&!this.replace){this.selected=el.dataset.table;const t=this.draft.find(x=>this.tableKey(x)===this.selected);this.render();if(t)this.editTable(t);return;}if(this.availableCell(el.dataset.cell)){if(!this.replace)this.selected=null;if(this.cells.has(el.dataset.cell)){this.cells.delete(el.dataset.cell);this.render();return;}if(!this.additive)this.cells.clear();this.cells.add(el.dataset.cell);this.render();this.finishSelection();}};
 },
 selectRectangle(drag,r,c){this.cells=new Set(drag.base);for(let row=Math.min(r,drag.r);row<=Math.max(r,drag.r);row++)for(let col=Math.min(c,drag.c);col<=Math.max(c,drag.c);col++){const key=`${row},${col}`;if(this.availableCell(key))this.cells.add(key);}},
 async discardThen(action){if(!this.dirty){await action();return;}showModal('มีการแก้ไขผังที่ยังไม่บันทึก','<p>ยกเลิกการแก้ไขล่าสุดแล้วดำเนินการต่อ?</p>',async()=>{this.dirty=false;await action();return {skipRefresh:true,message:'ยกเลิกการแก้ไขผังแล้ว'};},'ยกเลิกการแก้ไขและดำเนินการต่อ');},
 editFloor(create){if(this.dirty){toast('บันทึกหรือยกเลิกการแก้ไขผังก่อนเปลี่ยนขนาดชั้น');return;}const f=create?{name:'',grid_rows:8,grid_columns:12,version:0}:this.layout.floor;showModal(create?'เพิ่มชั้น':'แก้ไขชั้น',`<div class="field-grid">${field('ชื่อชั้น','name',f.name,'text','required maxlength="80"')}${field('จำนวนแถว','rows',f.grid_rows,'number','required min="1" max="100"')}${field('จำนวนคอลัมน์','columns',f.grid_columns,'number','required min="1" max="100"')}</div>`,async form=>{const result=await api('/api/admin/floors'+(create?'':`/${this.id}`),{name:form.get('name'),rows:Number(form.get('rows')),columns:Number(form.get('columns')),version:f.version});this.id=result.id;this.selected=null;});},
 editTable(t){
  const cells=t?t.cells:this.selectionCells();if(!cells.length)return;
  const locked=Boolean(t?.bill_id),free=state.tables.filter(x=>!x.floor_id&&!this.draft.some(d=>d.id===x.id));
  const body=`<div class="info-strip floor-table-summary">พื้นที่ ${cells.length} ช่อง${locked?' · มีบิลเปิดอยู่':''}</div><div class="field-grid">${field('ชื่อโต๊ะ','name',t?.name||'','text',`required maxlength="30" ${locked?'disabled':''}`)}${field('จำนวนที่นั่ง','capacity',t?.capacity||2,'number',`required min="1" max="2147483647" ${locked?'disabled':''}`)}</div>${t?`<div class="floor-table-actions"><button type="button" class="btn btn-outline-primary" data-floor="replace-area">ย้าย / ปรับพื้นที่โต๊ะ</button><button type="button" class="btn btn-outline-danger" data-floor="remove-table" ${locked?'disabled':''}>นำโต๊ะออกจากผัง</button></div>${locked?'<p class="small muted mt-3 mb-0">โต๊ะมีบิลเปิดอยู่ ปรับพื้นที่ได้ แต่ต้องปิดบิลก่อนแก้ชื่อ จำนวนที่นั่ง หรือนำโต๊ะออก</p>':''}`:`<div class="floor-table-actions"><button type="button" class="btn btn-outline-secondary" data-floor="continue-selection">เลือกพื้นที่เพิ่ม</button>${free.length?'<button type="button" class="btn btn-outline-primary" data-floor="existing-table">ใช้โต๊ะที่มีอยู่แล้ว</button>':''}</div>`}`;
  showModal(t?'โต๊ะ '+t.name:'เพิ่มโต๊ะ',body,locked?null:form=>{const name=form.get('name').trim();if(this.draft.some(x=>x!==t&&x.name===name))throw new Error('ชื่อโต๊ะซ้ำในผัง');if(t){t.name=name;t.capacity=Number(form.get('capacity'));}else{const added={key:requestKey(),name,capacity:Number(form.get('capacity')),active:true,cells};this.draft.push(added);this.selected=this.tableKey(added);}this.cells.clear();this.dirty=true;return {skipRefresh:true,message:'ปรับโต๊ะแล้ว กดบันทึกผังเพื่อใช้งาน'};},t?'ใช้การแก้ไข':'เพิ่มโต๊ะ');
 },
 async action(action,id){if(!isFloorPage||(!this.design&&!['choose','availability'].includes(action)))return;const t=this.draft.find(t=>this.tableKey(t)===this.selected);
  if(action==='add')this.editFloor(true);
  if(action==='continue-selection'){this.additive=true;editor.hide();this.render();}
  if(action==='floor-options')showModal('จัดการ '+this.layout.floor.name,`<div class="floor-stack"><button type="button" class="btn btn-outline-primary" data-floor="edit-floor">แก้ขนาด / ชื่อชั้น</button><button type="button" class="btn btn-outline-secondary" data-floor="discard">ยกเลิกการแก้ไขผัง</button><button type="button" class="btn btn-outline-danger" data-floor="delete-floor">ลบชั้น</button></div>`,null);
  if(action==='edit-floor')this.editFloor(false);
  if(action==='choose')await this.discardThen(async()=>{this.id=Number(id);this.selected=null;this.replace=false;await this.load();this.render();});

  if(action==='discard')await this.discardThen(async()=>{this.selected=null;this.replace=false;await this.load();this.render();});
  if(action==='save'){await api(`/api/admin/floors/${this.id}/layout`,{version:this.layout.floor.version,tables:this.draft.map(t=>({tableId:t.id??null,tableVersion:t.metadata_version??0,name:t.name,capacity:t.capacity,cells:t.cells}))});this.dirty=false;this.selected=null;this.replace=false;await refresh();toast('บันทึกผังเรียบร้อย');}
  if(action==='new-table')this.editTable(null);
  if(action==='edit-table'&&t)this.editTable(t);
  if(action==='clear-cells'){this.cells.clear();this.render();}
  if(action==='replace-area'&&t){this.replace=true;this.additive=false;this.cells.clear();editor.hide();this.render();toast('ลากเลือกพื้นที่ใหม่ให้โต๊ะ '+t.name);}
  if(action==='cancel-area'){this.replace=false;this.cells.clear();this.render();}
  if(action==='apply-area'&&t&&this.cells.size){t.cells=this.selectionCells();this.cells.clear();this.replace=false;this.mark();}
  if(action==='remove-table'&&t&&!t.bill_id)showModal('นำโต๊ะออกจากผัง',`<p>นำโต๊ะ ${escapeHtml(t.name)} ออกจากผังนี้?</p>`,()=>{this.draft=this.draft.filter(x=>x!==t);this.selected=null;this.replace=false;this.cells.clear();this.dirty=true;return {skipRefresh:true,message:'นำโต๊ะออกแล้ว กดบันทึกผังเพื่อใช้งาน'};},'นำออกจากผัง');
  if(action==='existing-table'){const free=state.tables.filter(x=>!x.floor_id&&!this.draft.some(t=>t.id===x.id));if(!free.length){toast('ไม่มีโต๊ะที่ยังไม่ได้วางในผัง');return;}const cells=this.selectionCells();showModal('วางโต๊ะที่มีอยู่แล้ว',select('โต๊ะ','tableId',free.map(x=>`<option value="${x.id}">${escapeHtml(x.name)} · ${x.capacity} ที่นั่ง</option>`).join('')),form=>{const table=structuredClone(free.find(x=>x.id===Number(form.get('tableId'))));table.cells=cells;this.draft.push(table);this.selected=this.tableKey(table);this.cells.clear();this.dirty=true;return {skipRefresh:true,message:'วางในแบบร่างแล้ว กดบันทึกผังเพื่อใช้งาน'};});}
  if(action==='availability')await tableAvailability(id);
  if(action==='delete-floor'){if(this.dirty){toast('บันทึกหรือยกเลิกแบบร่างก่อนลบชั้น');return;}showModal('ลบชั้น',`<p>ลบ ${escapeHtml(this.layout.floor.name)}? ต้องนำโต๊ะออกจากผังทั้งหมดก่อน</p>`,()=>api(`/api/admin/floors/${this.id}/delete`,{version:this.layout.floor.version}),'ลบชั้น');}
 }
};
async function tableAvailability(id){const t=state.tables.find(x=>x.id===Number(id));showModal(t.active?'ปิดรับโต๊ะชั่วคราว':'เปิดรับโต๊ะอีกครั้ง',`<p>โต๊ะ ${escapeHtml(t.name)}</p>${t.active?field('สาเหตุปิดรับ','reason','','text','maxlength="250" placeholder="เช่น โต๊ะเสีย รอซ่อม"'):'<p>โต๊ะจะกลับเป็นสีเขียวและเปิดบิลได้</p>'}`,form=>api(`/api/admin/tables/${id}/availability`,{active:!t.active,reason:form.get('reason')}),t.active?'ปิดรับโต๊ะ':'เปิดรับโต๊ะ');}
async function moveBill(id){const b=await api(`/api/admin/bills/${id}`);if(b.status!=='OPEN'){toast('บิลนี้ชำระแล้ว');return;}state=await api('/api/admin/state');const free=state.tables.filter(t=>t.id!==b.table_id&&t.active&&!t.bill_id&&t.capacity>=b.lines.reduce((n,l)=>n+l.quantity,0));if(!free.length){toast('ไม่มีโต๊ะว่างที่รองรับลูกค้าในบิลนี้ได้');return;}const key=requestKey();showModal(`ย้ายบิล #${String(b.id).padStart(5,'0')}`,`<p>โต๊ะปัจจุบัน <strong>${escapeHtml(b.table_name)}</strong></p>${select('โต๊ะปลายทาง','toTableId',free.map(t=>`<option value="${t.id}">${escapeHtml(t.name)} · ${t.capacity} ที่นั่ง${t.floor_id?' · '+escapeHtml(state.floors.find(f=>f.id===t.floor_id)?.name||''):''}</option>`).join(''))}<div class="info-strip">เวลาเริ่ม–สิ้นสุด ราคา และ QR เดิมคงอยู่ ลูกค้าใช้ QR เดิมต่อได้</div>`,form=>api(`/api/admin/bills/${id}/move`,{fromTableId:b.table_id,toTableId:Number(form.get('toTableId')),requestKey:key}),'ยืนยันย้ายบิล');}
document.addEventListener('click',async e=>{const el=e.target.closest('[data-floor]');if(!el)return;try{await floorPlan.action(el.dataset.floor,el.dataset.id);}catch(err){toast(err.message);}});
document.addEventListener('click',async e=>{const el=e.target.closest('[data-availability]');if(el)try{await tableAvailability(el.dataset.availability);}catch(err){toast(err.message);}});
// Keep an unfinished design when navigating to the separate reception page.
document.addEventListener('click',e=>{const link=e.target.closest('a[data-nav]');if(page!=='/admin/floor-plan'||!floorPlan.dirty||!link||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();if(window.confirm('มีการแก้ไขผังที่ยังไม่บันทึก ต้องการยกเลิกการแก้ไขแล้วออกจากหน้านี้หรือไม่?')){floorPlan.dirty=false;window.location.assign(link.href);}});
window.addEventListener('beforeunload',e=>{if(page==='/admin/floor-plan'&&floorPlan.dirty){e.preventDefault();e.returnValue='';}});
// Operation mode uses the server's expiry flag and refreshes while no editor is open.
setInterval(()=>{if(page==='/admin/reception'&&!busy&&!document.querySelector('.modal.show')&&!document.hidden)refresh();},15000);
