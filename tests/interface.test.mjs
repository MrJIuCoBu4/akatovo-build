import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as geometry from '../dist/geometry.js';
import * as solar from '../dist/solar.js';
import * as scene from '../dist/scene.js';
const modules={geometry,solar,scene};
const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import \{([^}]+)\} from '\.\/([\w-]+)\.js(?:\?v=\d+)?';$/gm,(_,names,module)=>`const {${names}}=modules[${JSON.stringify(module)}];`);
function createApp(initial){
 const memory=new Map(initial?[['forest-plot-planner-v1',initial]]:[]),elements=new Map(),listeners=new Map(),timers=new Map(),downloads=[],blobs=new Map();let timer=0;
 class Element{
  constructor(id){this.id=id;this.innerHTML='';this.textContent='';this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.style={};this.attributes={};this.handlers=new Map();this.dataset={};const classes=new Set();this.classList={add:(...c)=>c.forEach(x=>classes.add(x)),remove:(...c)=>c.forEach(x=>classes.delete(x)),toggle:(c,force)=>{if(force===true)classes.add(c);else if(force===false)classes.delete(c);else if(classes.has(c))classes.delete(c);else classes.add(c);return classes.has(c);},contains:c=>classes.has(c)};}
  addEventListener(type,fn){this.handlers.set(type,fn);}setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k];}focus(){}remove(){}append(){}setPointerCapture(){}scrollIntoView(){}showModal(){this.open=true;}close(){this.open=false;}
  getScreenCTM(){return {inverse(){return {};}};}createSVGPoint(){return {x:0,y:0,matrixTransform(){return {x:this.x,y:this.y};}};}
  async fire(type,event={}){return this.handlers.get(type)?.({target:this,preventDefault(){},...event});}
  click(){downloads.push({name:this.download,blob:blobs.get(this.href)});}
 }
 for(const m of html.matchAll(/\bid="([^"]+)"/g))elements.set(m[1],new Element(m[1]));
 const tabs=new Element('tabs'),selectors=new Map();
 const document={getElementById:id=>{if(!elements.has(id))throw Error('Unknown element '+id);return elements.get(id);},querySelector:s=>{if(s==='.workspace-tabs')return tabs;if(!selectors.has(s))selectors.set(s,new Element(s));return selectors.get(s);},addEventListener:(t,f)=>listeners.set(t,f),createElement:()=>new Element(),body:new Element('body')};
 const context={modules,document,Blob,URL:{createObjectURL(blob){const id='blob:'+blobs.size;blobs.set(id,blob);return id;},revokeObjectURL(){}},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id),setInterval:fn=>{timers.set(++timer,fn);return timer;},clearInterval:id=>timers.delete(id),requestAnimationFrame:fn=>{timers.set(++timer,fn);return timer;},console};
 vm.runInNewContext(js,context);
 const delegated=async(attr,value)=>listeners.get('click')({target:{closest:selector=>selector==='[data-'+attr+']'?{dataset:{[attr]:value}}:null}});
 const flush=()=>{const tasks=[...timers.values()];timers.clear();for(const t of tasks)t();};
 const data=()=>{flush();return JSON.parse(memory.get('forest-plot-planner-v1'));};
 const target=(attrs={})=>({closest:s=>{const m=s.match(/^\[data-(.+)\]$/);return m&&m[1] in attrs?{dataset:attrs}:null;}});
 return {elements,memory,downloads,delegated,flush,data,target};
}
test('all object positions, sizes and path width survive saving and reload',async()=>{
 const a=createApp();await a.delegated('select','parking');assert.equal(a.elements.get('object-title').textContent,'Парковка');
 a.elements.get('pos-x').value=27;await a.elements.get('pos-x').fire('change');a.elements.get('size-w').value=6;await a.elements.get('size-w').fire('change');
 await a.delegated('select','shed');await a.delegated('rotate','90');a.elements.get('pos-y').value=4.5;await a.elements.get('pos-y').fire('change');
 await a.delegated('select','path');a.elements.get('path-width').value=2;await a.elements.get('path-width').fire('input');await a.elements.get('path-width').fire('change');
 a.elements.get('variant-name').value='Всё вместе <тест>';await a.elements.get('save-variant-form').fire('submit');const d=a.data();assert.equal(d.version,2);assert.equal(d.project.parking.x,27);assert.equal(d.project.shed.angle,90);assert.equal(d.project.path.width,2);
 const b=createApp(a.memory.get('forest-plot-planner-v1'));assert.equal(b.elements.get('active-name').textContent,'Всё вместе <тест>');await b.delegated('tab','compare');assert.match(b.elements.get('comparison').innerHTML,/Всё вместе &lt;тест&gt;/);
 await b.delegated('preset','south');assert.equal(b.data().project.parking.x,27);assert.equal(b.data().project.shed.angle,90);assert.equal(b.data().project.house.angle,-35);
});
test('dragging house, shed and parking updates the appropriate selected object, and undo restores it',async()=>{
 const a=createApp(),plan=a.elements.get('plan');for(const key of ['house','shed','parking']){const original=geometry.defaultProject()[key];await plan.fire('pointerdown',{target:a.target({object:key}),clientX:original.x,clientY:original.y,pointerId:1});await plan.fire('pointermove',{clientX:original.x+1,clientY:original.y+.5,pointerId:1});await plan.fire('pointerup',{pointerId:1});assert.equal(a.data().project[key].x,original.x+1);assert.equal(a.elements.get('object-title').textContent,key==='house'?'Модерн 80':key==='shed'?'Бытовка':'Парковка');}
 await a.elements.get('undo').fire('click');assert.equal(a.data().project.parking.x,geometry.PARKING.x);
 await a.delegated('select','parking');a.elements.get('pos-x').value=37;await a.elements.get('pos-x').fire('change');assert.match(a.elements.get('warnings').innerHTML,/Парковка выходит/);
 await a.delegated('select','house');a.elements.get('show-floor').checked=true;await a.elements.get('show-floor').fire('change');assert.match(plan.innerHTML,/Кухня-гостиная/);assert.match(plan.innerHTML,/floor-plan/);
});
test('a user route can be drawn, reshaped, widened, and undo restores automatic routing',async()=>{
 const a=createApp(),plan=a.elements.get('plan');await a.elements.get('path-draw').fire('click');
 for(const [x,y] of [[33,13],[23,8],[11,3]])await plan.fire('pointerdown',{target:a.target(),clientX:x,clientY:y,pointerId:1});
 await a.elements.get('draw-finish').fire('click');assert.equal(a.data().project.path.mode,'manual');assert.equal(a.data().project.path.points.length,3);
 await plan.fire('pointerdown',{target:a.target({node:'1'}),clientX:23,clientY:8,pointerId:2});await plan.fire('pointermove',{clientX:21,clientY:6,pointerId:2});await plan.fire('pointerup',{pointerId:2});assert.deepEqual(a.data().project.path.points[1],[21,6]);
 await a.elements.get('path-delete-point').fire('click');assert.equal(a.data().project.path.points.length,2);assert.deepEqual(a.data().project.path.points,[[33,13],[11,3]]);
 a.elements.get('path-width').value=3;await a.elements.get('path-width').fire('input');await a.elements.get('path-width').fire('change');assert.match(a.elements.get('path-stats').innerHTML,/м²/);
 await a.elements.get('path-auto').fire('click');assert.equal(a.data().project.path.mode,'auto');await a.elements.get('undo').fire('click');assert.equal(a.data().project.path.mode,'manual');assert.equal(a.data().project.path.width,3);
});
test('old browser variants migrate without losing names or house orientation',async()=>{
 const old={version:1,state:{x:10,y:10,angle:-35},saved:[{id:'saved-old',name:'Мой старый вариант',x:10,y:10,angle:-35}],activeId:'saved-old',options:{width:3}};
 const a=createApp(JSON.stringify(old));assert.equal(a.elements.get('active-name').textContent,'Мой старый вариант');assert.equal(a.elements.get('angle').value,-35);await a.delegated('rotate','45');const d=a.data();assert.equal(d.saved[0].project.house.angle,-35);assert.equal(d.saved[0].name,'Мой старый вариант');assert.equal(d.project.house.angle,10);
});
test('sun controls show night, preserve the selected date, and export a complete scene',async()=>{
 const a=createApp();assert.match(a.elements.get('solar-headline').textContent,/Свет с/);a.elements.get('solar-clock').value='00:00';await a.elements.get('solar-clock').fire('change');assert.equal(a.elements.get('solar-headline').textContent,'Солнце ниже горизонта');assert.match(a.elements.get('solar-meaning').innerHTML,/Ночь/);
 await a.delegated('season','winter');assert.equal(a.elements.get('solar-date').value,'2026-12-21');await a.elements.get('export-json').fire('click');const json=await a.downloads.at(-1).blob.text();assert.equal(JSON.parse(json).version,2);assert.equal(JSON.parse(json).solar.date,'2026-12-21');
 const b=createApp();b.elements.get('import-json').files=[{size:json.length,text:async()=>json}];await b.elements.get('import-json').fire('change');assert.match(b.elements.get('toast').textContent,/загружены/);assert.equal(b.elements.get('solar-date').value,'2026-12-21');
 b.elements.get('import-json').files=[{size:30,text:async()=>'{"format":"other"}'}];await b.elements.get('import-json').fire('change');assert.match(b.elements.get('toast').textContent,/Не удалось загрузить/);
 await a.elements.get('export-svg').fire('click');const svg=await a.downloads.at(-1).blob.text();assert.match(svg,/Участок у леса/);assert.match(svg,/id="export-deck"/);assert.doesNotMatch(svg,/id="house"|id="rotate-handle"/);
 if(process.env.PLAN_QA_EXPORT){a.elements.get('solar-clock').value='16:00';await a.elements.get('solar-clock').fire('change');await a.delegated('season','summer');await a.elements.get('export-svg').fire('click');fs.writeFileSync(process.env.PLAN_QA_EXPORT,await a.downloads.at(-1).blob.text());}
});
