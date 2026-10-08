import {PLOT,FOREST_BEARING,PRESETS,rad,normAngle,snapAngle,bearing,direction,defaultProject,normalizeProject,validProject,validState,pathPoints,sceneMetrics} from './geometry.js?v=15';
import {SOLAR_DEFAULT,cleanSolar,validDate,solarDay,solarPosition,facadeLight,shadowScene,timeLabel} from './solar.js?v=15';
import {planMarkup} from './scene.js?v=15';
const $=id=>document.getElementById(id),KEY='forest-plot-planner-v1',NS='http://www.w3.org/2000/svg';
const clone=s=>JSON.parse(JSON.stringify(s)),fmt=(n,d=1)=>Number.isFinite(n)?n.toFixed(d).replace('.',','):'—',esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LABELS={house:'Дом',shed:'Бытовка',parking:'Парковка',path:'Дорожка'},ZONE_COLORS={plot:'#8fa97a',forest:'#6d8a62',buffer:'#8fa97a',gate:'#c9a46a',house:'#648375',shed:'#afc0a1',parking:'#c4c0a8',yard:'#99ae85'},DEFAULT_OPTIONS={compass:true,dimensions:true,floor:false,ghosts:false,buffer:true,zones:true,width:3};
let project=defaultProject(),saved=[],options={...DEFAULT_OPTIONS},solar={...SOLAR_DEFAULT},activeId='forest',selected='house',selectedPoint=-1,tab='editor',zoom=1,viewMode='2d',view3dApi=null,drawing=false,draft=[],history=[],future=[],drag=null,saveTimer,toastTimer,playTimer,storageWorks=true;
const sessions=new Set();
function cleanOptions(v={}){const o={...DEFAULT_OPTIONS};for(const k of ['compass','dimensions','floor','ghosts','buffer','zones'])if(typeof v?.[k]==='boolean')o[k]=v[k];if(Number.isFinite(v?.width)&&v.width>=0&&v.width<=8)o.width=v.width;return o;}
function cleanVariants(v){if(!Array.isArray(v))return [];const ids=new Set();return v.filter(a=>typeof a.name==='string'&&(validProject(a.project)||validState(a))).slice(0,9).map((a,i)=>{let id=typeof a.id==='string'&&/^saved-[a-zA-Z0-9-]+$/.test(a.id)&&a.id.length<60?a.id:'saved-import-'+i;if(ids.has(id))id+='-'+i;ids.add(id);return {id,name:a.name.slice(0,40),project:normalizeProject(a.project||defaultProject(a)),color:['#7a9278','#aa8f65','#6b8990'][i%3],tradeoff:'Твой план: все объекты и дорожка сохранены вместе.'};});}
try{const d=JSON.parse(localStorage.getItem(KEY)||'null');if(d&&(validProject(d.project)||validState(d.state))){project=normalizeProject(d.project||defaultProject(d.state));saved=cleanVariants(d.saved);options=cleanOptions(d.options);solar=cleanSolar(d.solar);activeId=typeof d.activeId==='string'?d.activeId:'custom';}}catch{storageWorks=false;}
function allVariants(){return [...PRESETS.map(v=>({...v,project:{...clone(project),house:{...project.house,x:v.x,y:v.y,angle:v.angle}}})),...saved];}
function currentName(){return allVariants().find(v=>v.id===activeId)?.name||'Свободное размещение';}
function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify({version:2,project,saved,options,solar,activeId}));storageWorks=true;$('save-state').textContent='Все объекты сохранены в браузере';}catch{storageWorks=false;$('save-state').textContent='Скачай JSON · автосохранение недоступно';}},200);}
function toast(t){$('toast').textContent=t;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function snapshot(){history.push({project:clone(project),activeId});if(history.length>60)history.shift();future=[];}
function changed(){activeId='custom';render();persist();}
function mutate(fn){snapshot();fn();changed();}
function selectObject(key){if(!LABELS[key])return;selected=key;selectedPoint=-1;render();}
function autoPath(){project.path.mode='auto';project.path.points=[];}
function basePreset(v){mutate(()=>{project.house={...project.house,x:v.x,y:v.y,angle:v.angle};autoPath();});activeId=v.id;selected='house';render();persist();}
function applyVariant(v){snapshot();project=clone(v.project);activeId=v.id;selected='house';selectedPoint=-1;drawing=false;render();persist();selectTab('editor');}
function applyZoom(){
 const plan=$('plan'),w=51/zoom,h=32/zoom;
 plan.setAttribute('viewBox',`${19-w/2} ${10.5-h/2} ${w} ${h}`);
 $('zoom-label').textContent=Math.round(zoom*100)+'%';
}
async function loadView3d(){
 if(view3dApi)return view3dApi;
 view3dApi=await import('./scene3d.js?v=16');
 return view3dApi;
}
async function setViewMode(mode){
 if(mode!=='2d'&&mode!=='3d')return;
 if(mode==='3d'&&drawing){drawing=false;draft=[];}
 viewMode=mode;
 const wrap=$('map-wrap'),v3=$('view3d');
 wrap.classList.toggle('is-3d',mode==='3d');
 $('view-2d').setAttribute('aria-pressed',String(mode==='2d'));
 $('view-3d').setAttribute('aria-pressed',String(mode==='3d'));
 $('map-mode-label').textContent=mode==='3d'?'ПРОСМОТР · THREE.JS 3D':'ЭСКИЗ · ВИД СВЕРХУ';
 $('map-hint').textContent=mode==='3d'?'ЛКМ — вращение · ПКМ — сдвиг · колесо — зум':'Выбор · перетаскивание · круг — поворот';
 if(mode==='3d'){
  v3.hidden=false;v3.setAttribute('aria-hidden','false');
  try{
   const api=await loadView3d();
   await api.mountView3d(v3);
   api.updateView3d(project,solar);
  }catch(err){
   viewMode='2d';wrap.classList.remove('is-3d');
   v3.hidden=true;v3.setAttribute('aria-hidden','true');
   $('view-2d').setAttribute('aria-pressed','true');$('view-3d').setAttribute('aria-pressed','false');
   $('map-mode-label').textContent='ЭСКИЗ · ВИД СВЕРХУ';
   toast(err?.message||'Не удалось загрузить 3D. Проверьте сеть (CDN Three.js).');
  }
 }else if(view3dApi){
  view3dApi.unmountView3d();
  v3.hidden=true;v3.setAttribute('aria-hidden','true');
 }
}
function syncView3d(){
 if(viewMode==='3d'&&view3dApi)view3dApi.updateView3d(project,solar);
}
function moveSelected(dx,dy){if(selected==='path'){const points=pathPoints(project);if(points.length<2)return;mutate(()=>{project.path.mode='manual';project.path.points=points.map(([x,y])=>[Math.max(-10,Math.min(47,x+dx)),Math.max(-10,Math.min(32,y+dy))]);});}else{const o=project[selected];mutate(()=>{o.x=Math.max(-10,Math.min(47,o.x+dx));o.y=Math.max(-10,Math.min(32,o.y+dy));autoPath();});}}
function renderInspector(m){
 for(const key of Object.keys(LABELS))$('pick-'+key).setAttribute('aria-pressed',String(key===selected));
 $('selected-badge').textContent=LABELS[selected]+' · настроить ↗';$('object-editor').hidden=selected==='path';$('path-editor').hidden=selected!=='path';
 const o=project[selected];if(selected!=='path'){$('object-title').textContent=selected==='house'?'Модерн 80':LABELS[selected];$('object-number').textContent=String(['house','shed','parking'].indexOf(selected)+1).padStart(2,'0');$('object-area').textContent=fmt(selected==='house'?80:o.w*o.h,0)+' м²';$('object-description').textContent=selected==='house'?'60 м² жилой объём + 20 м² терраса':selected==='shed'?'Бытовка / будущий хозблок. Размеры можно менять.':'Площадка для двух машин. Габариты — твой резерв.';$('angle').value=o.angle;$('angle-deg').value=Math.round(o.angle);$('pos-x').value=o.x.toFixed(2);$('pos-y').value=o.y.toFixed(2);$('object-size').hidden=selected==='house';$('height-label').hidden=selected==='parking';if(selected!=='house'){$('size-w').value=o.w;$('size-h').value=o.h;}if(selected!=='parking')$('object-height').value=o.height||2.5;}
 $('house-facing').hidden=selected!=='house';const b=bearing(project.house);$('facing').textContent=direction(b)+' · '+Math.round(b)+'°';$('facing-description').textContent=Math.abs(normAngle(b-FOREST_BEARING))<25?'К лесу. Свет и тень смотри на шкале дня.':'Под другим углом к лесу. Сравни свет по времени.';
 $('path-width').value=project.path.width;$('path-width-output').textContent=fmt(project.path.width)+' м';$('path-picker-width').textContent=fmt(project.path.width)+' м';$('path-mode-label').textContent=project.path.mode==='auto'?'Авто: огибает дом и бытовку':'Твой маршрут · '+m.path.points.length+' узлов';$('path-visible').checked=project.path.visible;
 $('path-stats').innerHTML=`<div><small>Длина</small><strong>≈ ${fmt(m.path.length)} м</strong></div><div><small>Покрытие</small><strong>≈ ${fmt(m.path.area)} м²</strong></div>`;
 for(const material of ['gravel','pavers','wood'])document.querySelector(`[data-material="${material}"]`)?.setAttribute('aria-pressed',String(project.path.material===material));
 $('path-delete-point').disabled=selectedPoint<0||m.path.points.length<=2;
 $('warnings').innerHTML=m.warnings.length?m.warnings.map(t=>`<div class="warning-item">${esc(t)}</div>`).join(''):'<div class="status-ok"><span>✓</span><span>Объекты внутри участка, пересечений нет. Проверка по эскизной модели.</span></div>';
 $('undo').disabled=!history.length;$('redo').disabled=!future.length;for(const k of ['compass','dimensions','floor','ghosts','buffer','zones'])$('show-'+k).checked=options[k];$('buffer').value=options.width;$('buffer-output').textContent=fmt(options.width,options.width%1?1:0)+' м';
}
function renderSolar(){
 const day=solarDay(solar),sh=shadowScene(project,solar),sun=sh.sun,facade=facadeLight(project.house,solar);$('solar-card').hidden=!solar.show;$('sun-toggle').setAttribute('aria-pressed',String(solar.show));$('solar-time-label').innerHTML=timeLabel(solar.minutes)+' <small>МСК</small>';$('solar-date').value=solar.date;$('solar-time').value=solar.minutes;$('solar-clock').value=timeLabel(solar.minutes);$('solar-headline').textContent=sun.daylight?'Свет с '+direction(sun.azimuth)+' · '+Math.round(sun.azimuth)+'°':'Солнце ниже горизонта';
 const y=a=>60-Math.max(0,Math.min(60,a))*.8,coords=day.samples.map(p=>`${p.minutes/2},${y(p.altitude)}`).join(' '),cx=solar.minutes/2,cy=y(sun.altitude);
 $('solar-timeline').innerHTML=`<svg xmlns="${NS}" viewBox="0 0 720 86" role="img" aria-label="Высота солнца за день. Текущее время ${timeLabel(solar.minutes)}"><path d="M0 60H720" stroke="#d6c49d" stroke-width=".7"/>${[0,360,720,1080,1440].map(t=>`<line x1="${t/2}" y1="8" x2="${t/2}" y2="63" stroke="#e2d6ba" stroke-width=".7" stroke-dasharray="2 4"/><text x="${Math.min(704,Math.max(16,t/2))}" y="80" text-anchor="middle" font-size="10" fill="#a38d65">${t===1440?'24:00':timeLabel(t)}</text>`).join('')}<polygon points="0,60 ${coords} 720,60" fill="#e7c67a" fill-opacity=".35"/><polyline points="${coords}" fill="none" stroke="#bd944b" stroke-width="1.7"/><line x1="${cx}" y1="4" x2="${cx}" y2="65" stroke="#95662d" stroke-width="1"/><circle cx="${cx}" cy="${cy}" r="4" fill="#bf8d38" stroke="#fff2d2" stroke-width="2"/></svg>`;
 $('solar-facts').innerHTML=[['Восход',timeLabel(day.sunrise)],['Закат',timeLabel(day.sunset)],['Высота солнца',Math.round(sun.altitude)+'°'],['Тень дома',sun.daylight?'≈ '+fmt(sh.shadowLength)+' м':'—']].map(([k,v])=>`<div><small>${k}</small><strong>${v}</strong></div>`).join('');
 const shade=!sun.daylight?'Ночь: прямого солнечного света нет.':!solar.shadows&&!solar.forest?'Тени выключены. Стрелка показывает направление света.':sh.shadeFraction>.7?'По модели терраса преимущественно в тени.':sh.shadeFraction>.15?'По модели на террасе есть и свет, и тень.':'По модели терраса преимущественно освещена.';
 const front=!sun.daylight?'Ночью световую сторону фасада не показываем.':sh.front?'Солнце перед фасадом террасы.':'Солнце сбоку или за домом относительно террасы.';
 $('solar-meaning').innerHTML=`<div class="solar-explanation-icon">${sun.daylight?'↘':'☾'}</div><div><strong>${front}</strong><p>${shade} ${solar.forest&&sun.daylight?'Лес принят высотой '+solar.treeHeight+' м.':''}</p><small>Перед фасадом в этот день: ${facade.intervals.length?facade.intervals.map(a=>timeLabel(a[0])+'–'+timeLabel(a[1])).join(', '):'—'} · без учёта препятствий.</small></div>`;
 $('solar-shadows').checked=solar.shadows;$('solar-forest').checked=solar.forest;$('tree-height').value=solar.treeHeight;$('tree-height-output').textContent=solar.treeHeight+' м';$('solar-play').textContent=playTimer?'Ⅱ':'▶';
}
function renderZones(m){
 const focus=['yard','forest','gate','house','parking','shed'];
 $('zone-list').innerHTML=m.zones.filter(z=>focus.includes(z.id)).map(z=>`<div class="zone-item"><span><i class="zone-swatch" style="background:${ZONE_COLORS[z.id]||'#99ae85'}"></i>${esc(z.name)}</span><strong>${fmt(z.area,0)} м²</strong></div>`).join('');
}
function render(){
 const m=sceneMetrics(project,options.width);$('plan').innerHTML=planMarkup(project,{selected,options,solar,drawing,draft,selectedPoint});applyZoom();$('active-name').textContent=currentName();renderInspector(m);renderSolar();renderZones(m);syncView3d();
 const status=m.warnings.length?m.warnings.length+' замечан.':'OK';
 $('metrics').innerHTML=[['К лесу',fmt(m.forest),'м','От террасы'],['Min отступ',m.inside?fmt(m.min):'—','м','До границы'],['Дорожка',fmt(m.path.length),'м',fmt(project.path.width)+' м шир.'],['Двор',fmt(m.zoneAreas.yard,0),'м²','Свободно ≈'],['Проверка',status,'',m.warnings.length?'См. инспектор':'Пересечений нет']].map(([k,v,u,t])=>`<div class="metric"><small>${k}</small><strong>${esc(String(v))}${u?`<span>${u}</span>`:''}</strong><em>${esc(t)}</em></div>`).join('');
 $('presets').innerHTML=PRESETS.map((v,i)=>`<button class="preset ${activeId===v.id?'active':''}" data-preset="${v.id}" aria-pressed="${activeId===v.id}"><div class="preset-line"><span>0${i+1}</span><small>${esc(v.tag)}</small></div><strong>${esc(v.name)}</strong><p>${esc(v.description)}</p><em>${esc(v.tradeoff)}</em></button>`).join('');
 $('draw-toolbar').hidden=!drawing;$('draw-status').textContent=draft.length?draft.length+' точек · добавь повороты и нажми «Готово»':'Кликай на плане, чтобы проложить дорожку';$('draw-finish').disabled=draft.length<2;$('draw-back').disabled=!draft.length;$('tool-select').setAttribute('aria-pressed',String(!drawing));$('tool-path').setAttribute('aria-pressed',String(drawing));$('tool-hint').textContent=drawing?'Клик — точка · Enter — готово · Esc — отмена':selected==='path'?'Тяни узлы · + добавляет поворот':'Выбран объект: '+LABELS[selected];$('plan').style.cursor=drawing?'crosshair':'';
 if(tab==='compare')renderCompare();
}
function renderCompare(){
 $('comparison').innerHTML=allVariants().map((v,i)=>{const m=sceneMetrics(v.project,options.width),f=facadeLight(v.project.house,solar);return `<article class="comparison-card"><svg xmlns="${NS}" viewBox="-5 -3 47 29" role="img" aria-label="План ${esc(v.name)}">${planMarkup(v.project,{mini:true,interactive:false,options,solar,prefix:'mini-'+v.id})}</svg><div class="comparison-card-content"><div class="comparison-card-top"><h3>${esc(v.name)}</h3><span class="tiny-label">0${i+1}</span></div>${v.description?`<p class="compare-why">${esc(v.description)}</p>`:''}<p class="compare-tradeoff">${esc(v.tradeoff)}</p><div class="compare-values"><div><span>До лесной границы</span><strong>≈ ${fmt(m.forest)} м</strong></div><div><span>Дорожка / покрытие</span><strong>${fmt(m.path.length,0)} м / ${fmt(m.path.area,0)} м²</strong></div><div><span>Солнце перед фасадом</span><strong>≈ ${fmt(f.minutes/60)} ч</strong></div><div><span>Дата сравнения</span><strong>${solar.date.split('-').reverse().join('.')}</strong></div></div><div class="comparison-card-footer"><button class="button light" data-apply="${esc(v.id)}">Выбрать ↗</button>${i>=PRESETS.length?`<button class="delete-variant" data-delete="${esc(v.id)}">Удалить</button>`:''}</div></div></article>`;}).join('');
 $('comparison-table-body').innerHTML=allVariants().map(v=>{const m=sceneMetrics(v.project,options.width),b=bearing(v.project.house),f=facadeLight(v.project.house,solar);return `<tr><td>${esc(v.name)}</td><td>≈ ${fmt(m.forest)} м</td><td>${m.inside?'≈ '+fmt(m.min)+' м':'За границей'}</td><td>${fmt(m.path.length,0)} м × ${fmt(v.project.path.width)} м</td><td>${direction(b)} · ${Math.round(b)}°</td><td>≈ ${fmt(f.minutes/60)} ч</td><td class="${m.warnings.length?'table-warning':'table-ok'}">${m.warnings.length?esc(m.warnings.join(' ')):'Пересечений нет'}</td></tr>`;}).join('');
}
function selectTab(name){if(!['editor','compare','sources'].includes(name))return;tab=name;for(const n of ['editor','compare','sources']){$('tab-'+n).setAttribute('aria-selected',String(n===name));$('tab-'+n).tabIndex=n===name?0:-1;$('panel-'+n).hidden=n!==name;}if(name==='compare')renderCompare();}
function stopPlay(){if(playTimer){clearInterval(playTimer);playTimer=null;}}
function startDrawing(){stopPlay();selected='path';selectedPoint=-1;drawing=true;draft=[];render();$('plan').focus();}
function finishDrawing(){if(draft.length<2)return;if(draft.some(([x,y])=>x< -10||x>47||y< -10||y>32)){toast('Точка за рабочей областью. Отмени последнюю точку.');return;}const points=draft.filter((p,i)=>i===0||Math.hypot(p[0]-draft[i-1][0],p[1]-draft[i-1][1])>.05);if(points.length<2)return;mutate(()=>{project.path.mode='manual';project.path.points=clone(points);project.path.visible=true;drawing=false;draft=[];});toast('Маршрут готов. Тяни узлы, чтобы поправить его.');}
function deletePoint(index=selectedPoint){const points=pathPoints(project);if(!Number.isInteger(index)||index<0||index>=points.length||points.length<=2){if(points.length<=2&&index>=0)toast('Нужны минимум две точки. Добавь поворот или перерисуй дорожку.');return;}mutate(()=>{project.path.mode='manual';project.path.points=points.filter((_,i)=>i!==index);selected='path';selectedPoint=-1;});}
function pointFromEvent(e){const svg=$('plan'),ctm=svg.getScreenCTM();if(!ctm)return null;const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(ctm.inverse());return [Math.round(q.x*20)/20,Math.round(q.y*20)/20];}
$('plan').addEventListener('pointerdown',e=>{
 const p=pointFromEvent(e);if(!p)return;stopPlay();if(drawing){e.preventDefault();if(draft.length>=60){toast('В одном маршруте не больше 60 точек.');return;}draft.push(p);render();return;}
 const del=e.target.closest('[data-delete-node]');
 if(del){e.preventDefault();e.stopPropagation();selected='path';selectedPoint=Number(del.dataset.deleteNode);deletePoint(selectedPoint);return;}
 const node=e.target.closest('[data-node]'),insert=e.target.closest('[data-insert]'),target=e.target.closest('[data-object]');
 if(insert){const i=Number(insert.dataset.insert),points=pathPoints(project);if(points.length>=60){toast('В маршруте не больше 60 точек.');return;}mutate(()=>{project.path.mode='manual';project.path.points=clone(points);project.path.points.splice(i+1,0,p);selected='path';selectedPoint=i+1;});return;}
 if(!node&&!target)return;e.preventDefault();const key=node?'path':target.dataset.object;if(!LABELS[key])return;selected=key;selectedPoint=node?Number(node.dataset.node):-1;
 const rotation=e.target.closest('[data-rotation]')||e.target.closest('#rotate-handle'),o=project[key],points=key==='path'?pathPoints(project):null;
 drag={key,node:selectedPoint,rotation:!!rotation,id:e.pointerId,start:p,project:clone(project),points:clone(points),recorded:false,offset:rotation?Math.atan2(p[1]-o.y,p[0]-o.x)*180/Math.PI-o.angle:0};$('plan').setPointerCapture(e.pointerId);render();
});
$('plan').addEventListener('dblclick',e=>{
 const node=e.target.closest('[data-node]');if(!node||drawing)return;e.preventDefault();
 selected='path';selectedPoint=Number(node.dataset.node);deletePoint(selectedPoint);
});
$('plan').addEventListener('pointermove',e=>{
 if(!drag||drag.id!==e.pointerId)return;const p=pointFromEvent(e);if(!p)return;const dx=p[0]-drag.start[0],dy=p[1]-drag.start[1];if(!drag.recorded&&Math.hypot(dx,dy)<.04)return;if(!drag.recorded){snapshot();drag.recorded=true;}
 if(drag.key==='path'){project.path.mode='manual';project.path.points=drag.points.map((a,i)=>drag.node>=0&&i!==drag.node?a:[Math.max(-10,Math.min(47,a[0]+dx)),Math.max(-10,Math.min(32,a[1]+dy))]);}
 else{const o=project[drag.key],start=drag.project[drag.key];if(drag.rotation)o.angle=snapAngle(Math.atan2(p[1]-o.y,p[0]-o.x)*180/Math.PI-drag.offset);else{o.x=Math.max(-10,Math.min(47,start.x+dx));o.y=Math.max(-10,Math.min(32,start.y+dy));}autoPath();}
 activeId='custom';render();
});
function endDrag(e){if(drag&&e.pointerId===drag.id){if(drag.key!=='path'&&drag.recorded)autoPath();drag=null;render();persist();}}
$('plan').addEventListener('pointerup',endDrag);$('plan').addEventListener('pointercancel',endDrag);
$('plan').addEventListener('keydown',e=>{if(e.key==='Escape'){drawing=false;draft=[];drag=null;render();return;}if(drawing&&e.key==='Enter'){e.preventDefault();finishDrawing();return;}if(selected==='path'&&['Delete','Backspace'].includes(e.key)){e.preventDefault();deletePoint();return;}const n=e.shiftKey?1:.25,m={ArrowLeft:[-n,0],ArrowRight:[n,0],ArrowUp:[0,-n],ArrowDown:[0,n]};if(m[e.key]){e.preventDefault();moveSelected(...m[e.key]);$('plan').focus();}else if(e.key.toLowerCase()==='r'&&selected!=='path'){e.preventDefault();mutate(()=>{project[selected].angle=snapAngle(project[selected].angle+(e.shiftKey?-45:45));autoPath();});$('plan').focus();}});
function continuous(id,fn,geometry=true){$(id).addEventListener('input',e=>{if(geometry&&!sessions.has(id)){snapshot();sessions.add(id);}fn(Number(e.target.value));if(geometry)activeId='custom';render();persist();});$(id).addEventListener('change',()=>sessions.delete(id));}
continuous('angle',v=>{if(selected!=='path'){project[selected].angle=normAngle(v);autoPath();}});continuous('path-width',v=>project.path.width=v);continuous('buffer',v=>options.width=v,false);continuous('solar-time',v=>{stopPlay();solar.minutes=v;},false);continuous('tree-height',v=>solar.treeHeight=v,false);
$('angle-deg').addEventListener('change',e=>{if(selected==='path')return;const n=Number(e.target.value);if(!Number.isFinite(n)||n<-180||n>180){toast('Допустимое значение: −180–180°.');render();return;}mutate(()=>{project[selected].angle=normAngle(n);autoPath();});});
for(const [id,key] of [['pos-x','x'],['pos-y','y'],['size-w','w'],['size-h','h'],['object-height','height']])$(id).addEventListener('change',e=>{if(selected==='path')return;const n=Number(e.target.value),ranges={x:[-10,47],y:[-10,32],w:[2,15],h:[2,15],height:[1,12]},[a,b]=ranges[key];if(!Number.isFinite(n)||n<a||n>b){toast(`Допустимое значение: ${a}–${b}.`);render();return;}mutate(()=>{project[selected][key]=n;if(key!=='height')autoPath();});});
for(const k of ['compass','dimensions','floor','ghosts','buffer','zones'])$('show-'+k).addEventListener('change',e=>{options[k]=e.target.checked;render();persist();});
$('solar-date').addEventListener('change',e=>{if(!validDate(e.target.value)){render();return;}solar.date=e.target.value;render();persist();});$('solar-clock').addEventListener('change',e=>{const [h,m]=e.target.value.split(':').map(Number);if(Number.isFinite(h)&&Number.isFinite(m)){solar.minutes=h*60+m;render();persist();}});
$('sun-toggle').addEventListener('click',()=>{solar.show=!solar.show;stopPlay();render();persist();});for(const k of ['shadows','forest'])$('solar-'+k).addEventListener('change',e=>{solar[k]=e.target.checked;render();persist();});
$('solar-play').addEventListener('click',()=>{if(playTimer){stopPlay();render();persist();return;}const d=solarDay(solar);solar.minutes=Math.round((d.sunrise||360)/5)*5;playTimer=setInterval(()=>{solar.minutes+=10;if(solar.minutes>Math.min(1435,d.sunset||1260)){stopPlay();persist();}render();},160);render();});
$('path-visible').addEventListener('change',e=>mutate(()=>project.path.visible=e.target.checked));$('path-draw').addEventListener('click',startDrawing);$('tool-path').addEventListener('click',startDrawing);$('tool-select').addEventListener('click',()=>{drawing=false;draft=[];render();});$('draw-cancel').addEventListener('click',()=>{drawing=false;draft=[];render();});$('draw-back').addEventListener('click',()=>{draft.pop();render();});$('draw-finish').addEventListener('click',finishDrawing);$('path-auto').addEventListener('click',()=>mutate(()=>{project.path.mode='auto';project.path.points=[];selectedPoint=-1;project.path.visible=true;}));$('path-delete-point').addEventListener('click',()=>deletePoint());
$('selected-badge').addEventListener('click',()=>$('inspector').scrollIntoView({behavior:'smooth',block:'start'}));
document.addEventListener('click',e=>{const get=a=>e.target.closest('[data-'+a+']');const sel=get('select'),preset=get('preset'),apply=get('apply'),remove=get('delete'),rotate=get('rotate'),nudge=get('nudge'),mat=get('material'),season=get('season'),source=get('source'),go=get('go'),t=get('tab');if(sel){drawing=false;draft=[];selectObject(sel.dataset.select);}if(preset){const v=PRESETS.find(v=>v.id===preset.dataset.preset);if(v)basePreset(v);}if(apply){const v=allVariants().find(v=>v.id===apply.dataset.apply);if(v)applyVariant(v);}if(remove){saved=saved.filter(v=>v.id!==remove.dataset.delete);if(activeId===remove.dataset.delete)activeId='custom';renderCompare();persist();}if(rotate&&selected!=='path')mutate(()=>{project[selected].angle=normAngle(project[selected].angle+Number(rotate.dataset.rotate));autoPath();});if(nudge)moveSelected(...nudge.dataset.nudge.split(',').map(Number));if(mat)mutate(()=>project.path.material=mat.dataset.material);if(season){const year=solar.date.slice(0,4),dates={summer:year+'-06-21',spring:year+'-03-21',winter:year+'-12-21',today:new Date(Date.now()+10800000).toISOString().slice(0,10)};solar.date=dates[season.dataset.season];stopPlay();render();persist();}if(source){$('source-image').src=source.dataset.source;$('source-image').alt=source.dataset.title;$('source-title').textContent=source.dataset.title;$('source-dialog').showModal();}if(go)selectTab(go.dataset.go);if(t)selectTab(t.dataset.tab);});
document.querySelector('.workspace-tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=['editor','compare','sources'];let i=tabs.indexOf(tab);i=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:-1)+3)%3;selectTab(tabs[i]);$('tab-'+tabs[i]).focus();});
$('undo').addEventListener('click',()=>{if(!history.length)return;future.push({project:clone(project),activeId});const p=history.pop();project=p.project;activeId=p.activeId;selectedPoint=-1;drawing=false;render();persist();});$('redo').addEventListener('click',()=>{if(!future.length)return;history.push({project:clone(project),activeId});const p=future.pop();project=p.project;activeId=p.activeId;selectedPoint=-1;render();persist();});
$('view-2d').addEventListener('click',()=>setViewMode('2d'));
$('view-3d').addEventListener('click',()=>setViewMode('3d'));
$('zoom-in').addEventListener('click',()=>{if(viewMode==='3d')return;zoom=Math.min(3,zoom+.25);applyZoom();});
$('zoom-out').addEventListener('click',()=>{if(viewMode==='3d')return;zoom=Math.max(.75,zoom-.25);applyZoom();});
$('fit').addEventListener('click',()=>{if(viewMode==='3d'){view3dApi?.resetView3dCamera();return;}zoom=1;applyZoom();});$('reset').addEventListener('click',()=>{mutate(()=>project=defaultProject());activeId='forest';selected='house';selectedPoint=-1;zoom=1;drawing=false;render();persist();toast('Вернул начальный план. Твои сохранённые варианты на месте.');});
function saveVariant(name){if(saved.length>=9){toast('Сохрани до 9 своих вариантов. Лишний можно удалить в сравнении.');return false;}const id='saved-'+Date.now().toString(36)+'-'+saved.length;saved.push({id,name:name.trim().slice(0,40)||'Мой план '+(saved.length+1),project:clone(project),tradeoff:'Твой план: все объекты и дорожка сохранены вместе.'});activeId=id;render();persist();toast(storageWorks?'Сохранён весь план: объекты и дорожка.':'План добавлен. Скачай JSON, чтобы сохранить его.');return true;}
$('save-variant-form').addEventListener('submit',e=>{e.preventDefault();if(saveVariant($('variant-name').value))$('variant-name').value='';});$('compare-current').addEventListener('click',()=>saveVariant('Мой план '+(saved.length+1)));
function download(content,type,name){const b=new Blob([content],{type}),url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
$('export-json').addEventListener('click',()=>download(JSON.stringify({format:'forest-plot-planner',version:2,project,saved,options,solar,activeId,reference:{area:750,plot:PLOT,forestBearing:FOREST_BEARING,gateWidth:5,address:'Московская обл., г. Клин, д. Акатово, владение 200, строение Акатово парк тер.',coordsDms:'56°05′54″ N, 36°35′42″ E',layout:'ГП-01 / РЕВ. 03',layoutDate:'2026-10-05',boundarySegments:{top:[24.89,12.11],bottom:[24,10],left:[21.44],right:[15.78,6.09]},setbacksOnSource:[1,3]}},null,2),'application/json','forest-plot-variants.json'));
$('import-json').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>500000)throw Error('Слишком большой файл.');const d=JSON.parse(await f.text());if(d.format!=='forest-plot-planner'||![1,2].includes(d.version)||!Array.isArray(d.saved)||d.saved.length>9||(d.version===2?!validProject(d.project):!validState(d.state))||d.saved.some(v=>typeof v.name!=='string'||!(validProject(v.project)||validState(v))))throw Error('Неверный формат файла вариантов.');snapshot();project=normalizeProject(d.project||defaultProject(d.state));saved=cleanVariants(d.saved);options=cleanOptions(d.options);solar=cleanSolar(d.solar);activeId='custom';selectedPoint=-1;drawing=false;render();persist();toast('Полный план и варианты загружены.');}catch(err){toast('Не удалось загрузить: '+err.message);}finally{e.target.value='';}});
$('export-svg').addEventListener('click',()=>{const s=shadowScene(project,solar),markup=planMarkup(project,{interactive:false,selected:'',options,solar,prefix:'export'});download(`<svg xmlns="${NS}" width="1530" height="1140" viewBox="-6.5 -9 51 38"><rect x="-6.5" y="-9" width="51" height="38" fill="#f5f4ee"/><text x="-4" y="-7.5" font-family="Arial,sans-serif" font-size=".7" fill="#253e35">Участок у леса · ${esc(currentName())}</text><text x="-4" y="-6.55" font-family="Arial,sans-serif" font-size=".34" fill="#7c8d70">${solar.date} · ${timeLabel(solar.minutes)} МСК · солнце ${Math.round(s.sun.azimuth)}°, высота ${Math.round(s.sun.altitude)}° · дорожка ${fmt(project.path.width)} м</text><g font-family="Arial,sans-serif">${markup}</g><text x="-4" y="26.4" font-family="Arial,sans-serif" font-size=".30" fill="#7b8c71">Контур и расстояния — эскиз. Тени рассчитаны при заданных высотах, без рельефа и облачности.</text><text x="-4" y="27.1" font-family="Arial,sans-serif" font-size=".30" fill="#7b8c71">Лес ≈ ${solar.treeHeight} м — допущение. Буфер ${options.width} м — ориентир, не нормативная проверка.</text></svg>`,'image/svg+xml','forest-plot-plan.svg');toast('План со всеми объектами скачан в SVG.');});
$('close-source').addEventListener('click',()=>$('source-dialog').close());$('source-dialog').addEventListener('click',e=>{if(e.target===$('source-dialog'))$('source-dialog').close();});
render();selectTab('editor');if(!storageWorks)$('save-state').textContent='Скачай JSON · автосохранение недоступно';
