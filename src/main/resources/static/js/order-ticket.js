'use strict';
const copyCheckbox=document.querySelector('#ticketCopy');
function prepareOrderTicket(){
 document.querySelector('#ticketCopyLabel').hidden=!copyCheckbox.checked;
 document.querySelector('#ticketPrintedAt').textContent=new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'medium',timeZone:'Asia/Bangkok'}).format(new Date());
}
copyCheckbox.addEventListener('change',prepareOrderTicket);
document.querySelector('#printOrderTicket').addEventListener('click',()=>{prepareOrderTicket();window.print();});
window.addEventListener('beforeprint',prepareOrderTicket);
