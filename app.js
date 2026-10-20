'use strict';
(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fold = (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es');
  const number = (value) => new Intl.NumberFormat('es-ES').format(value);
  const dateTime = (value) => new Intl.DateTimeFormat('es-ES', {dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  const dayKey = (value) => {const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const uuid = () => crypto.randomUUID();
  const DB_NAME = 'manzana-recepcion-v1';
  let db, records = [], currentReceipt = null, busy = false, installPrompt = null, toastTimer;
  let deviceId = '';
  try {deviceId = localStorage.getItem('manzana-device') || uuid(); localStorage.setItem('manzana-device', deviceId);} catch {deviceId = uuid();}
  const icon = (name, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  function toast(message) {clearTimeout(toastTimer); $('#toast').textContent=message; $('#toast').hidden=false; toastTimer=setTimeout(()=>$('#toast').hidden=true,5500);}
  function fatal(message) {$('#storage-error').textContent=message; $('#storage-error').hidden=false; $('#save-button').disabled=true; $('#import-button').disabled=true;}
  function requestResult(request) {return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
  function complete(tx) {return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error || new Error('Operación cancelada.'));});}
  async function openDatabase() {
    const request = indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{request.result.createObjectStore('entries',{keyPath:'id'});};
    request.onblocked=()=>fatal('Cierre las otras pestañas de Manzana y vuelva a abrir la app para acceder al registro.');
    db=await requestResult(request);
    db.onversionchange=()=>{db.close();fatal('La base de datos se ha actualizado. Vuelva a abrir esta página.');};
    await refresh();
  }
  async function refresh() {records=await requestResult(db.transaction('entries','readonly').objectStore('entries').getAll());records.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));render();}
  function activeEntries() {return records.filter(r=>r.status==='active');}
  function groups(entries, field) {
    const map = new Map();
    entries.forEach(r=>{const key=fold(r[field]);const g=map.get(key)||{name:r[field],count:0,quantity:0};g.count++;g.quantity+=r.quantity;map.set(key,g);});
    return [...map.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'es'));
  }
  function empty(title, description, action = false) {return `<div class="empty"><span class="empty-symbol">${icon('box')}</span><h3>${escape(title)}</h3><p>${escape(description)}</p>${action?'<button class="text-button" data-view="entrada">Registrar primera entrada ↗</button>':''}</div>`;}
  function render() {
    const active=activeEntries(), now=new Date(), today=dayKey(now), todayEntries=active.filter(r=>dayKey(r.createdAt)===today);
    const medicines=groups(active,'medicine'), receivers=groups(active,'receiver');
    $('#today-label').textContent = new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long'}).format(now);
    $('#today-count').textContent=number(todayEntries.length);
    $('#today-description').textContent=todayEntries.length===1?'entrada registrada':'entradas registradas';
    $('#hero-note').textContent=todayEntries.length?'Cada recepción tiene su albarán.':'Su próxima entrada empieza aquí.';
    $('#total-count').textContent=number(active.length);$('#medicine-count').textContent=number(medicines.length);$('#receiver-count').textContent=number(receivers.length);
    $('#sidebar-count').textContent=`${number(active.length)} entradas activas`;
    const monday=new Date(now.getFullYear(),now.getMonth(),now.getDate());monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
    const days=Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(d.getDate()+i);return {key:dayKey(d),count:active.filter(r=>dayKey(r.createdAt)===dayKey(d)).length,label:['L','M','X','J','V','S','D'][i]};});
    const max=Math.max(1,...days.map(d=>d.count));$('#week-count').textContent=number(days.reduce((sum,d)=>sum+d.count,0));
    $('#week-chart').innerHTML=days.map(d=>`<div class="day-column ${d.key===today?'today':''}" title="${d.key}: ${d.count} entradas"><div class="day-bar" style="height:${Math.max(4,Math.round(d.count/max*68))}px"></div><span class="day-label">${d.label}</span></div>`).join('');
    $('#week-chart').setAttribute('aria-label',`Entradas de esta semana: ${days.map(d=>`${d.key}: ${d.count}`).join('; ')}`);
    $('#recent-list').innerHTML=active.length?active.slice(0,4).map(r=>`<button class="recent-row" data-receipt="${escape(r.id)}"><span class="record-icon">${icon('box')}</span><span class="recent-info"><strong>${escape(r.medicine)}</strong><small>${escape(r.receiver)} · ${escape(dateTime(r.createdAt))}</small></span><span class="quantity-pill">${number(r.quantity)} ud.</span></button>`).join(''):empty('Todo preparado para empezar','Aquí aparecerán sus últimas recepciones.',true);
    $('#medicine-ranking').innerHTML=medicines.length?medicines.slice(0,4).map(m=>`<div class="ranking-row"><div class="ranking-row-head"><span>${escape(m.name)}</span><strong>${m.count} ${m.count===1?'entrada':'entradas'}</strong></div><div class="ranking-track"><div class="ranking-fill" style="width:${Math.round(m.count/medicines[0].count*100)}%"></div></div></div>`).join(''):empty('Su resumen, de un vistazo','Los medicamentos recibidos aparecerán aquí.');
    $('#medicine-options').innerHTML=medicines.map(m=>`<option value="${escape(m.name)}"></option>`).join('');
    $('#receiver-options').innerHTML=receivers.map(m=>`<option value="${escape(m.name)}"></option>`).join('');
    $('#export-summary').textContent=`${number(records.length)} albaranes · ${number(active.length)} activos · ${number(records.length-active.length)} anulados`;
    try {const last=localStorage.getItem('manzana-last-export');if(last)$('#backup-status').textContent=`Última descarga de Excel iniciada: ${dateTime(last)}. Compruebe que el archivo está guardado.`;} catch {}
    renderRecords();
  }
  function renderRecords() {
    const query=fold($('#search').value), from=$('#date-from').value, to=$('#date-to').value, status=$('#status-filter').value;
    if(from&&to&&from>to){$('#filter-summary').textContent='La fecha «Desde» debe ser anterior a «Hasta».';$('#records-list').innerHTML=empty('Revise las fechas','El inicio del periodo es posterior al final.');return;}
    const filtered=records.filter(r=>(status==='all'||r.status===status)&&(!query||fold(`${r.medicine} ${r.receiver} ${r.receiptNumber}`).includes(query))&&(!from||dayKey(r.createdAt)>=from)&&(!to||dayKey(r.createdAt)<=to));
    $('#filter-summary').textContent=`${number(filtered.length)} ${filtered.length===1?'albarán':'albaranes'}`;
    $('#records-list').innerHTML=filtered.length?filtered.map(r=>`<button class="record-card ${r.status==='void'?'void':''}" data-receipt="${escape(r.id)}"><span class="record-icon">${icon('box')}</span><span class="record-main"><span class="record-meta"><span>${escape(r.receiptNumber)}</span><span>· ${escape(dateTime(r.createdAt))}</span>${r.status==='void'?'<span class="void-badge">Anulado</span>':''}</span><h2>${escape(r.medicine)}</h2><p>Recibido por ${escape(r.receiver)}</p></span><span class="record-tail"><strong>${number(r.quantity)}</strong><small>unidades</small></span></button>`).join(''):empty(records.length?'No hay coincidencias':'Todavía no hay albaranes',records.length?'Pruebe otro nombre, periodo o estado.':'Registre una entrada para crear el primero.',!records.length);
  }
  function navigate(view) {
    if(!['inicio','entrada','registros','excel'].includes(view))view='inicio';
    $$('.view').forEach(el=>el.hidden=el.id!==`view-${view}`);
    $$('nav [data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===view);if(el.dataset.view===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    if(location.hash!==`#${view}`)history.replaceState(null,'',`#${view}`);
    window.scrollTo({top:0,behavior:'instant'});
  }
  function validateFields(medicine,quantity,receiver) {
    if(typeof medicine!=='string'||!medicine.trim()||medicine.trim().length>120)throw new Error('Indique un medicamento de entre 1 y 120 caracteres.');
    if(typeof receiver!=='string'||!receiver.trim()||receiver.trim().length>100)throw new Error('Indique quién lo ha recibido, con un máximo de 100 caracteres.');
    if(!Number.isSafeInteger(quantity)||quantity<1||quantity>1000000)throw new Error('La cantidad debe ser un número entero entre 1 y 1.000.000.');
  }
  $('#entry-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!db)return;$('#form-error').hidden=true;
    const medicine=$('#medicine').value.trim(),quantity=Number($('#quantity').value),receiver=$('#receiver').value.trim();
    try {validateFields(medicine,quantity,receiver);} catch(error){$('#form-error').textContent=error.message;$('#form-error').hidden=false;return;}
    busy=true;$('#save-button').disabled=true;
    try {
      const id=uuid(),createdAt=new Date().toISOString();
      const entry={id,medicine,quantity,receiver,createdAt,status:'active',deviceId,voidedAt:'',receiptNumber:`M-${dayKey(createdAt).replaceAll('-','')}-${id.slice(0,8).toUpperCase()}`};
      const tx=db.transaction('entries','readwrite'),done=complete(tx);tx.objectStore('entries').add(entry);await done;
      await refresh();$('#medicine').value='';$('#quantity').value='';navigate('registros');openReceipt(id);toast('Entrada guardada en este dispositivo.');
      if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
      channel?.postMessage('refresh');
    } catch(error){$('#form-error').textContent='No se ha podido guardar la entrada. Compruebe el espacio disponible y vuelva a intentarlo.';$('#form-error').hidden=false;}
    finally {busy=false;$('#save-button').disabled=false;}
  });
  function receiptMarkup(r) {return `<div class="receipt-brand">${icon('apple','apple')}<span>manzana</span></div><h2 class="receipt-number">${escape(r.receiptNumber)}</h2><p class="receipt-date">${escape(dateTime(r.createdAt))}</p><div class="receipt-fields"><div class="receipt-field"><span>Medicamento</span><strong>${escape(r.medicine)}</strong></div><div class="receipt-field"><span>Cantidad recibida</span><strong>${number(r.quantity)} unidades</strong></div><div class="receipt-field"><span>Recibido por</span><strong>${escape(r.receiver)}</strong></div></div><span class="receipt-status ${r.status==='void'?'cancelled':''}">${r.status==='void'?`Anulado · ${escape(dateTime(r.voidedAt))}`:'Recepción registrada'}</span><p class="receipt-id">ID de control: ${escape(r.id)}</p>`;}
  function openReceipt(id) {const entry=records.find(r=>r.id===id);if(!entry)return;currentReceipt=id;$('#receipt-content').innerHTML=receiptMarkup(entry);$('#void-button').hidden=entry.status==='void';if(!$('#receipt-dialog').open)$('#receipt-dialog').showModal();}
  $('#print-button').addEventListener('click',()=>{const entry=records.find(r=>r.id===currentReceipt);if(entry){$('#print-area').innerHTML=receiptMarkup(entry);window.print();}});
  function confirmAction(title,message,label='Confirmar') {
    return new Promise(resolve=>{
      const dialog=$('#confirm-dialog');$('#confirm-title').textContent=title;$('#confirm-message').textContent=message;$('#confirm-ok').textContent=label;
      function finish(value){dialog.removeEventListener('close',onClose);$('#confirm-ok').removeEventListener('click',onOk);$('#confirm-cancel').removeEventListener('click',onCancel);dialog.close();resolve(value);}
      const onClose=()=>finish(false),onOk=()=>finish(true),onCancel=()=>finish(false);
      dialog.addEventListener('close',onClose);$('#confirm-ok').addEventListener('click',onOk);$('#confirm-cancel').addEventListener('click',onCancel);dialog.showModal();
    });
  }
  $('#void-button').addEventListener('click',async()=>{
    const id=currentReceipt,entry=records.find(r=>r.id===id);if(!entry||entry.status==='void'||busy)return;
    if(!await confirmAction('Anular esta entrada',`${entry.medicine} · ${entry.quantity} unidades\nEl albarán se conservará como anulado y dejará de contar en el dashboard.`,'Anular entrada'))return;
    try {const tx=db.transaction('entries','readwrite'),done=complete(tx),store=tx.objectStore('entries');const request=store.get(id);request.onsuccess=()=>{if(request.result?.status==='active')store.put({...request.result,status:'void',voidedAt:new Date().toISOString()});};await done;await refresh();openReceipt(id);toast('Entrada anulada. Se conserva en el historial.');channel?.postMessage('refresh');}catch{toast('No se ha podido anular. Sus datos se conservan.');}
  });
  const HEADERS=['ID','Albarán','Fecha ISO','Medicamento','Cantidad','Recibido por','Estado','Dispositivo','Anulado en'];
  function addSheet(book,name,rows,widths){const sheet=XLSX.utils.aoa_to_sheet(rows);sheet['!cols']=widths.map(w=>({wch:w}));XLSX.utils.book_append_sheet(book,sheet,name);}
  function buildWorkbook(template=false) {
    if(typeof XLSX==='undefined')throw new Error('Excel todavía no está disponible. Espere a que termine la carga de la app.');
    const book=XLSX.utils.book_new();book.Props={Title:'Manzana · Recepción de medicamentos',Author:'Manzana',Subject:'Registro de entradas'};
    addSheet(book,'Entradas',[HEADERS,...(template?[]:records.map(r=>[r.id,r.receiptNumber,r.createdAt,r.medicine,r.quantity,r.receiver,r.status==='active'?'Activo':'Anulado',r.deviceId,r.voidedAt]))],[40,29,27,43,13,30,12,40,27]);
    if(template){addSheet(book,'Instrucciones',[
      ['MANZANA · PLANTILLA DE ENTRADAS'],['Complete la hoja Entradas. No cambie los nombres de las columnas.'],['Obligatorios: Medicamento, Cantidad (entero positivo), Recibido por.'],['Opcionales: Fecha ISO (ejemplo 2026-10-20T10:00:00+02:00), Estado (Activo o Anulado).'],['Sin fecha se asigna la fecha y hora de la primera importación.'],['Deje ID, Albarán y Dispositivo vacíos para nuevas entradas manuales.'],['Para reunir móviles use el Excel exportado, sin alterar sus identificadores.'],['Anulado en es obligatorio para entradas cuyo estado sea Anulado.'],['El mismo archivo sin modificar no se duplica. Los archivos distintos sin ID pueden duplicar entradas.'],['Las entradas ya guardadas no se sobrescriben al importar.']
    ],[115]);return book;}
    const active=activeEntries();
    addSheet(book,'Resumen',[
      ['MANZANA · RESUMEN'],['Generado (ISO)',new Date().toISOString()],['Albaranes totales',records.length],['Entradas activas',active.length],['Entradas anuladas',records.length-active.length],['Medicamentos distintos',groups(active,'medicine').length],['Personas receptoras',groups(active,'receiver').length],[],['Las cantidades se agrupan por medicamento y presentación.'],['Los datos son locales a este dispositivo, incluidos los importados.'],['Las anulaciones de registros ya importados no se sincronizan.']
    ],[75,30]);
    addSheet(book,'Por medicamento',[['Medicamento','Entradas activas','Cantidad recibida'],...groups(active,'medicine').map(g=>[g.name,g.count,g.quantity])],[55,20,23]);return book;
  }
  function exportExcel(template=false) {
    try {if(!db)throw new Error('El registro todavía no está disponible.');const book=buildWorkbook(template);XLSX.writeFile(book,template?'Manzana-plantilla.xlsx':`Manzana-entradas-${dayKey(new Date())}.xlsx`,{compression:true});if(!template){try{localStorage.setItem('manzana-last-export',new Date().toISOString());}catch{}render();toast('Descarga iniciada. Conserve el Excel como copia de sus datos.');}}catch(error){toast(error.message||'No se ha podido generar el Excel.');}
  }
  $('#template-button').addEventListener('click',()=>exportExcel(true));
  $('#import-button').addEventListener('click',()=>{if(!db)return;$('#import-file').value='';$('#import-file').click();});
  const hash = async buffer => [...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(v=>v.toString(16).padStart(2,'0')).join('');
  function parseISO(value,label,optional=false){if((value===''||value==null)&&optional)return '';if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))throw new Error(`${label}: use una fecha ISO con zona horaria, como 2026-10-20T10:00:00+02:00.`);const datePart=value.slice(0,10),date=new Date(`${datePart}T00:00:00Z`);if(date.toISOString().slice(0,10)!==datePart)throw new Error(`${label}: la fecha no existe.`);return new Date(value).toISOString();}
  $('#import-file').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file||busy||!db)return;
    busy=true;$('#import-button').disabled=true;
    try {
      if(!/\.xlsx$/i.test(file.name)||file.size>5*1024*1024)throw new Error('Seleccione un archivo .xlsx de hasta 5 MB.');
      const bytes=await file.arrayBuffer(),fileHash=await hash(bytes);
      if(new Uint8Array(bytes)[0]!==80||new Uint8Array(bytes)[1]!==75)throw new Error('El archivo no es un Excel .xlsx válido.');
      const workbook=XLSX.read(bytes,{type:'array',cellFormula:false,cellHTML:false,cellDates:false,sheetRows:10002});
      const sheet=workbook.Sheets.Entradas;if(!sheet)throw new Error('Falta la hoja «Entradas». Use la plantilla o un Excel exportado desde Manzana.');
      const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',blankrows:false});
      if(rows.length>10001)throw new Error('El archivo supera el límite de 10.000 entradas por importación.');
      if(rows.length<2)throw new Error('La hoja Entradas está vacía. No se ha cambiado ningún dato.');
      const headers=rows[0].map(String);if(new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)throw new Error('Hay columnas duplicadas. Use la plantilla original.');
      for(const field of ['Medicamento','Cantidad','Recibido por'])if(!headers.includes(field))throw new Error(`Falta la columna «${field}».`);
      const now=new Date().toISOString(),existing=new Map(records.map(r=>[r.id,r])),seen=new Map(),incoming=[];let duplicates=0,statusDifferences=0,manual=0;
      for(let index=1;index<rows.length;index++){
        const row=rows[index];if(row.every(value=>value===''))continue;
        const get=field=>row[headers.indexOf(field)]??'';
        const medicine=String(get('Medicamento')).trim(),receiver=String(get('Recibido por')).trim(),rawQuantity=get('Cantidad');
        if(!((typeof rawQuantity==='number')||(typeof rawQuantity==='string'&&/^\d+$/.test(rawQuantity.trim()))))throw new Error(`Fila ${index+1}: la cantidad debe ser un número entero positivo.`);
        const quantity=Number(rawQuantity);try{validateFields(medicine,quantity,receiver);}catch(error){throw new Error(`Fila ${index+1}: ${error.message}`);}
        const suppliedId=String(get('ID')).trim();if(suppliedId&&(!/^[a-zA-Z0-9_-]{8,100}$/.test(suppliedId)))throw new Error(`Fila ${index+1}: identificador no válido.`);
        const id=suppliedId||`imp-${fileHash.slice(0,40)}-${index}`;if(!suppliedId)manual++;
        const old=existing.get(id)||seen.get(id);
        const createdAt=parseISO(get('Fecha ISO'),`Fila ${index+1}`,true)||old?.createdAt||now;
        const state=fold(get('Estado'));if(!['','activo','anulado'].includes(state))throw new Error(`Fila ${index+1}: Estado debe ser Activo o Anulado.`);
        const status=state==='anulado'?'void':'active',voidedAt=parseISO(get('Anulado en'),`Fila ${index+1}, anulación`,true);
        if(status==='void'&&!voidedAt)throw new Error(`Fila ${index+1}: falta la fecha ISO en «Anulado en».`);
        if(status==='active'&&voidedAt)throw new Error(`Fila ${index+1}: una entrada activa no puede tener fecha de anulación.`);
        if(voidedAt&&voidedAt<createdAt)throw new Error(`Fila ${index+1}: la anulación es anterior a la recepción.`);
        if(old){if(old.medicine!==medicine||old.receiver!==receiver||old.quantity!==quantity||old.createdAt!==createdAt)throw new Error(`Fila ${index+1}: el ID ya existe con otros datos. No se ha importado nada. Revise el archivo sin cambiar los identificadores.`);duplicates++;if(old.status!==status)statusDifferences++;continue;}
        const receiptNumber=String(get('Albarán')).trim()||`M-${dayKey(createdAt).replaceAll('-','')}-${(suppliedId||fileHash).slice(0,8).toUpperCase()}${suppliedId?'':`-${index}`}`;
        if(receiptNumber.length>100)throw new Error(`Fila ${index+1}: número de albarán demasiado largo.`);
        const sourceDevice=String(get('Dispositivo')).trim()||'Excel';if(sourceDevice.length>100)throw new Error(`Fila ${index+1}: identificador de dispositivo demasiado largo.`);
        const entry={id,medicine,quantity,receiver,createdAt,status,voidedAt,receiptNumber,deviceId:sourceDevice};incoming.push(entry);seen.set(id,entry);
      }
      if(!incoming.length){toast(`${duplicates} albaranes ya estaban guardados. No se ha añadido ninguno.${statusDifferences?' Hay estados diferentes; se ha conservado el estado local.':''}`);return;}
      let message=`${incoming.length} entradas nuevas.\n${duplicates} albaranes ya guardados se omitirán.\nSus entradas actuales se conservan.`;
      if(manual)message+='\nHay filas sin ID. Si modifica el archivo y lo importa otra vez, podrían duplicarse.';
      if(statusDifferences)message+=`\n${statusDifferences} estados diferentes: se conservará el estado local.`;
      if(!await confirmAction('Reunir estas entradas',message,'Importar entradas'))return;
      // Unique keys and one transaction prevent a concurrent tab from creating duplicates or a partial import.
      const tx=db.transaction('entries','readwrite'),done=complete(tx),store=tx.objectStore('entries');let added=0,concurrentDuplicates=0,conflict=false;
      for(const entry of incoming){const request=store.get(entry.id);request.onsuccess=()=>{const old=request.result;if(!old){store.add(entry);added++;}else if(old.medicine===entry.medicine&&old.quantity===entry.quantity&&old.receiver===entry.receiver&&old.createdAt===entry.createdAt){concurrentDuplicates++;}else{conflict=true;tx.abort();}};}
      try{await done;}catch(error){if(conflict)throw new Error('Otro registro con el mismo ID ha cambiado. No se ha importado ninguna entrada.');throw error;}
      await refresh();channel?.postMessage('refresh');toast(`${added} entradas importadas. ${duplicates+concurrentDuplicates} duplicadas omitidas.`);navigate('registros');
    } catch(error){await confirmAction('No se ha importado el archivo',`${error.message || 'No se ha podido leer el Excel.'}\nSus registros actuales se conservan.`,'Entendido');}
    finally {busy=false;$('#import-button').disabled=false;}
  });
  document.addEventListener('click',event=>{
    const view=event.target.closest('[data-view]');if(view){navigate(view.dataset.view);return;}
    const receipt=event.target.closest('[data-receipt]');if(receipt){openReceipt(receipt.dataset.receipt);return;}
    const close=event.target.closest('[data-close]');if(close){close.closest('dialog').close();return;}
    const action=event.target.closest('[data-action]');if(action?.dataset.action==='export')exportExcel();if(action?.dataset.action==='install'){$('#native-install').hidden=!installPrompt;$('#install-dialog').showModal();}
  });
  ['search','date-from','date-to','status-filter'].forEach(id=>$('#'+id).addEventListener('input',renderRecords));
  $('#clear-filters').addEventListener('click',()=>{$('#search').value='';$('#date-from').value='';$('#date-to').value='';$('#status-filter').value='active';renderRecords();});
  window.addEventListener('hashchange',()=>navigate(location.hash.slice(1)));
  window.addEventListener('focus',()=>{if(db&&!busy)refresh().catch(()=>toast('No se ha podido actualizar el registro.'));});
  let channel;try{channel=new BroadcastChannel('manzana-recepcion');channel.onmessage=()=>{if(db)refresh().catch(()=>{});};}catch{}
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('#native-install').hidden=false;});
  $('#native-install').addEventListener('click',async()=>{if(!installPrompt)return;await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#native-install').hidden=true;});
  window.addEventListener('appinstalled',()=>{toast('Manzana instalada.');$('#install-dialog').close();});
  if('serviceWorker' in navigator && location.protocol!=='file:'){
    navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>$('#offline-status').textContent='App preparada para funcionar sin conexión.').catch(()=>$('#offline-status').textContent='El acceso sin conexión no está preparado. Abra la app con conexión y vuelva a intentarlo.');
  }else $('#offline-status').textContent='Abra la dirección web publicada para instalar la app y activar el acceso sin conexión.';
  navigate(location.hash.slice(1));
  openDatabase().catch(()=>fatal('No se puede acceder al almacenamiento de este navegador. No registre entradas aquí. Abra la app en Safari o Chrome con el almacenamiento habilitado.'));
})();
