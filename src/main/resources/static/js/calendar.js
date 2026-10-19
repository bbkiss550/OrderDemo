'use strict';

// Keep ISO dates in the named input; use Thai only for the visible calendar.
(() => {
 const instances = new Set();
 function enhance() {
  for (const picker of instances) {
   if (!picker.input.isConnected) { picker.destroy(); instances.delete(picker); }
  }
  document.querySelectorAll('input[type="date"]').forEach(input => {
   const label = input.labels[0], required = input.required;
   const picker = flatpickr(input, {
    locale: {...flatpickr.l10ns.th, yearAriaLabel: 'ปี ค.ศ.', monthAriaLabel: 'เดือน'},
    disableMobile: true,
    dateFormat: 'Y-m-d',
    altInput: true,
    altFormat: 'j F Y',
    ariaDateFormat: 'j F Y',
    minDate: input.min || undefined,
    maxDate: input.max || undefined,
    onReady: (_, __, calendar) => {
     calendar.altInput.id = input.id + '-display';
     calendar.altInput.classList.add('thai-date-display');
     calendar.altInput.placeholder = 'เลือกวันที่';
     calendar.altInput.setAttribute('aria-haspopup', 'dialog');
     calendar.altInput.setAttribute('aria-expanded', 'false');
     if (label) label.htmlFor = calendar.altInput.id;
     calendar.calendarContainer.setAttribute('role', 'dialog');
     calendar.calendarContainer.setAttribute('aria-label', 'เลือกวันที่');
     calendar.prevMonthNav.setAttribute('aria-label', 'เดือนก่อนหน้า');
     calendar.nextMonthNav.setAttribute('aria-label', 'เดือนถัดไป');
     const actions = document.createElement('div');
     actions.className = 'thai-calendar-actions';
     const addAction = (text, action) => {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = text;
      button.addEventListener('click', action); actions.append(button);
     };
     const today = new Date(); today.setHours(0, 0, 0, 0);
     if (calendar.isEnabled(today)) addAction('วันนี้', () => { calendar.setDate(new Date(), true); calendar.close(); });
     if (!required) addAction('ล้างวันที่', () => { calendar.clear(); calendar.close(); });
     calendar.calendarContainer.append(actions);
    },
    onOpen: (_, __, calendar) => calendar.altInput.setAttribute('aria-expanded', 'true'),
    onClose: (_, __, calendar) => calendar.altInput.setAttribute('aria-expanded', 'false')
   });
   instances.add(picker);
  });
 }
 // These forms render again when filters or pagination change.
 const observer = new MutationObserver(enhance);
 for (const root of document.querySelectorAll('#content, #modalBody')) observer.observe(root, {childList: true, subtree: true});
 document.addEventListener('submit', event => {
  for (const picker of instances) {
   if (picker.input.form === event.target && picker.input.required && !picker.input.value) {
    event.preventDefault(); event.stopImmediatePropagation();
    picker.altInput.focus(); picker.open(); return;
   }
  }
 }, true);
 enhance();
})();
