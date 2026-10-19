'use strict';
const salesReports={from:null,to:null,data:null,request:0,
 async load(from=this.from,to=this.to){
  const request=++this.request,query=new URLSearchParams();
  if(from)query.set('from',from);if(to)query.set('to',to);
  const data=await api('/api/admin/reports/sales'+(query.size?'?'+query:''));
  if(request!==this.request)return false;
  this.data=data;this.from=data.from;this.to=data.to;return true;
 },
 day(value){return new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeZone:'Asia/Bangkok'}).format(new Date(value+'T00:00:00+07:00'));},
 today(){const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(type=>parts.find(p=>p.type===type).value).join('-');},
 stampPrint(){const label=$('#reportPrintedAt');if(label)label.textContent='พิมพ์เมื่อ '+new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(new Date())+' น. (เวลาไทย)';},
 print(){if(!this.data)return;this.stampPrint();window.print();},
 async run(from,to){
  const status=$('#reportStatus');status.classList.remove('text-danger');status.textContent='กำลังอัปเดตรายงาน…';
  document.querySelectorAll('#reportFilter button').forEach(el=>el.disabled=true);
  try{if(await this.load(from,to))this.render();}
  catch(error){status.classList.add('text-danger');status.textContent=error.message;}
  finally{document.querySelectorAll('#reportFilter button').forEach(el=>el.disabled=false);}
 },
 render(){
  $('#pageActions').innerHTML=button('↻ อัปเดตรายงาน','refresh','','btn-outline-secondary')+button('พิมพ์รายงาน','print-report','','btn-primary');
  $('[data-action="print-report"]').onclick=()=>this.print();
  if(!this.data){$('#content').innerHTML=empty('กำลังเตรียมรายงาน');return;}
  const data=this.data,s=data.summary;
  const stats=[['ยอดรับชำระ','฿'+money(s.paid_total),'รวม VAT และค่าปรับที่เรียกเก็บ','bx-wallet'],['บิลชำระแล้ว',s.bill_count+' บิล','อิงวันที่รับชำระเงิน','bx-receipt'],['ลูกค้า',s.guests+' คน',`ผู้ใหญ่ ${s.adults} · เด็ก ${s.children}`,'bx-group'],['ยอดเฉลี่ยต่อบิล','฿'+money(s.average_bill),'เฉพาะบิลที่ชำระแล้ว','bx-bar-chart-alt-2']];
  const table=(heading,headers,rows)=>`<article class="card section-card"><h3>${heading}</h3>${rows.length?`<div class="table-responsive mt-3"><table class="table mb-0"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`:empty('ไม่มีบิลที่ชำระแล้วในช่วงวันที่นี้')}</article>`;
  const paymentNames={CASH:'เงินสด',TRANSFER:'โอนเงิน',CARD:'บัตร',UNKNOWN:'ไม่ระบุ'};
  $('#content').innerHTML=`<header class="report-print-header"><h1>${escapeHtml(state.settings.name)}</h1><h2>รายงานยอดขาย</h2><p id="reportPrintedAt"></p></header><section class="card section-card report-filter-card"><form id="reportFilter"><div class="report-filter-fields">${field('วันที่เริ่มต้น','reportFrom',this.from,'date','required min="1900-01-01" max="2200-12-31"')}${field('วันที่สิ้นสุด','reportTo',this.to,'date','required min="1900-01-01" max="2200-12-31"')}<button type="submit" class="btn btn-primary">แสดงรายงาน</button></div><div class="report-presets"><button type="button" class="btn btn-soft" data-report-period="today">วันนี้</button><button type="button" class="btn btn-soft" data-report-period="week">7 วันล่าสุด</button><button type="button" class="btn btn-soft" data-report-period="month">เดือนนี้</button></div><div id="reportStatus" role="status"></div></form></section><p class="report-period">${this.day(data.from)} – ${this.day(data.to)} · ตามวันที่รับชำระ เวลาไทย</p><div class="stat-grid report-stat-grid">${stats.map(([label,value,note,icon])=>`<article class="card stat-card"><span class="stat-icon bx ${icon}"></span><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></article>`).join('')}</div><div class="report-columns"><article class="card section-card"><h3>สรุปยอดรับชำระ</h3><div class="quote"><div class="quote-row"><span>ค่าบริการก่อน VAT</span><strong>฿${money(s.subtotal)}</strong></div><div class="quote-row"><span>VAT ตามบิล</span><strong>฿${money(s.vat)}</strong></div><div class="quote-row"><span>ค่าบริการรวม VAT</span><strong>฿${money(s.service_total)}</strong></div><div class="quote-row"><span>ค่าปรับที่เรียกเก็บ</span><strong>฿${money(s.penalty_total)}</strong></div><div class="quote-row quote-total"><span>ยอดรับชำระทั้งหมด</span><strong>฿${money(s.paid_total)}</strong></div></div><p class="small muted mt-3 mb-0">นับเฉพาะบิลที่ชำระแล้ว บิลที่ยังเปิดอยู่ไม่รวมในยอดนี้ และใช้ราคากับ VAT ที่บันทึกในบิล</p></article>${table('ช่องทางชำระเงิน',['ช่องทาง','บิล','ยอดรับชำระ'],data.payments.map(p=>`<tr><td>${escapeHtml(paymentNames[p.payment_method]||p.payment_method)}</td><td>${p.bill_count}</td><td class="report-money">฿${money(p.paid_total)}</td></tr>`))}</div>${table('ยอดขายรายวัน',['วันที่','บิล','ลูกค้า','ก่อน VAT','VAT','ค่าปรับ','ยอดรับชำระ'],data.daily.map(d=>`<tr><td>${this.day(d.day)}</td><td>${d.bill_count}</td><td>${d.guests}</td><td class="report-money">฿${money(d.subtotal)}</td><td class="report-money">฿${money(d.vat)}</td><td class="report-money">฿${money(d.penalty_total)}</td><td class="report-money"><strong>฿${money(d.paid_total)}</strong></td></tr>`))}${table('สรุปตามแพ็กเกจ',['แพ็กเกจ','บิล','ผู้ใหญ่','เด็ก','ยอดรับชำระรวม VAT และค่าปรับ'],data.packages.map(p=>`<tr><td>${escapeHtml(p.package_name)}</td><td>${p.bill_count}</td><td>${p.adults}</td><td>${p.children}</td><td class="report-money">฿${money(p.paid_total)}</td></tr>`))}`;
  $('#reportFilter').onsubmit=e=>{e.preventDefault();this.run($('#f-reportFrom').value,$('#f-reportTo').value);};
  document.querySelectorAll('[data-report-period]').forEach(el=>el.onclick=()=>{
   const to=this.today();let from=to;
   if(el.dataset.reportPeriod==='week'){const start=new Date(to+'T00:00:00Z');start.setUTCDate(start.getUTCDate()-6);from=start.toISOString().slice(0,10);}
   if(el.dataset.reportPeriod==='month')from=to.slice(0,8)+'01';
   this.run(from,to);
  });
 }
};

window.addEventListener('beforeprint',()=>{if(page==='/admin/reports')salesReports.stampPrint();});
