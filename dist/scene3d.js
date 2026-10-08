import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {PLOT,FOREST_BEARING,GATE,ROAD,pathPoints,rad} from './geometry.js?v=40';
import {solarPosition} from './solar.js?v=30';

// ракурс с террасы / леса — виден панорамный фасад Модерн 80
const CAM={pos:[-6,12,24],target:[12,.8,10]};
let renderer,scene,camera,controls,root,raf=0,host=null,ro=null,texCache=new Map();
let editEnabled=false,editHooks=null,drag3d=null,selected3d='',selectedPart='',gridHelper=null,spaceHeld=false;
const GRID=0.25;
const raycaster=new THREE.Raycaster(),pointerNdc=new THREE.Vector2(),groundHit=new THREE.Vector3(),groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
const snap3d=v=>Math.round(v/GRID)*GRID;

function findEditRoot(obj){
 while(obj){
  if(obj.userData?.editId)return obj;
  obj=obj.parent;
 }
 return null;
}

function findEditPart(obj){
 while(obj){
  if(obj.userData?.partId)return obj;
  if(obj.userData?.editId)break;
  obj=obj.parent;
 }
 return null;
}

function pickGround(e){
 const rect=renderer.domElement.getBoundingClientRect();
 pointerNdc.x=((e.clientX-rect.left)/rect.width)*2-1;
 pointerNdc.y=-((e.clientY-rect.top)/rect.height)*2+1;
 raycaster.setFromCamera(pointerNdc,camera);
 return raycaster.ray.intersectPlane(groundPlane,groundHit)?groundHit.clone():null;
}

function setGridVisible(on){
 if(!scene)return;
 if(on&&!gridHelper){
  gridHelper=new THREE.GridHelper(48,48/GRID,0x6a7d62,0xb7c4a8);
  gridHelper.position.set(18.5,.02,10.5);
  gridHelper.material.transparent=true;
  if(Array.isArray(gridHelper.material))gridHelper.material.forEach(m=>{m.transparent=true;m.opacity=.55;});
  else{gridHelper.material.transparent=true;gridHelper.material.opacity=.55;}
  scene.add(gridHelper);
 }
 if(gridHelper)gridHelper.visible=!!on;
}

function syncPanMode(){
 if(!controls)return;
 // Space или СКМ/ПКМ — сдвиг камеры по плоскости
 controls.mouseButtons.LEFT=spaceHeld?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;
 controls.mouseButtons.MIDDLE=THREE.MOUSE.PAN;
 controls.mouseButtons.RIGHT=THREE.MOUSE.PAN;
 controls.touches.ONE=spaceHeld?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE;
 controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
}

function onSpaceDown(e){
 if(e.code!=='Space'||e.repeat)return;
 if(e.target.closest?.('input,textarea,select,[contenteditable]'))return;
 e.preventDefault();
 spaceHeld=true;syncPanMode();
 if(renderer?.domElement)renderer.domElement.style.cursor='grab';
}

function onSpaceUp(e){
 if(e.code!=='Space')return;
 spaceHeld=false;syncPanMode();
 if(renderer?.domElement)renderer.domElement.style.cursor='';
}

function onCanvasPointerDown(e){
 // Space + ЛКМ — только сдвиг камеры, не захват объекта
 if(spaceHeld||e.button===1||e.button===2)return;
 if(!editEnabled||!editHooks||e.button!==0||!root)return;
 const rect=renderer.domElement.getBoundingClientRect();
 pointerNdc.x=((e.clientX-rect.left)/rect.width)*2-1;
 pointerNdc.y=-((e.clientY-rect.top)/rect.height)*2+1;
 raycaster.setFromCamera(pointerNdc,camera);
 const hits=raycaster.intersectObjects(root.children,true);
 const hit=hits.find(h=>findEditRoot(h.object));
 if(!hit)return;
 const grp=findEditRoot(hit.object);
 if(!grp?.userData.editId)return;
 e.preventDefault();e.stopPropagation();
 const id=grp.userData.editId;
 const part=findEditPart(hit.object);
 selected3d=id;
 selectedPart=part?.userData.partId||'';
 editHooks.onSelect?.(id,selectedPart?{id:selectedPart,label:part.userData.partLabel||selectedPart}:null);
 const p=pickGround(e)||grp.position;
 drag3d={id,group:grp,startX:p.x,startZ:p.z,baseX:grp.position.x,baseZ:grp.position.z,pathDx:0,pathDz:0,moved:false};
 controls.enabled=false;
 applySelectionHighlight(root,selectedPart||id);
}

function onCanvasPointerMove(e){
 if(!drag3d)return;
 const p=pickGround(e);if(!p)return;
 const dx=snap3d(p.x)-snap3d(drag3d.startX),dz=snap3d(p.z)-snap3d(drag3d.startZ);
 if(!drag3d.moved&&Math.hypot(dx,dz)<GRID*.4)return;
 if(!drag3d.moved){drag3d.moved=true;editHooks?.onMoveStart?.();}
 if(drag3d.id==='path'){drag3d.pathDx=dx;drag3d.pathDz=dz;drag3d.group.position.set(dx,0,dz);}
 else{drag3d.group.position.set(snap3d(drag3d.baseX+dx),0,snap3d(drag3d.baseZ+dz));}
}

function onCanvasPointerUp(){
 if(!drag3d)return;
 const d=drag3d;drag3d=null;controls.enabled=true;
 if(!d.moved)return;
 if(d.id==='path'){
  const dx=d.pathDx,dz=d.pathDz;
  d.group.position.set(0,0,0);
  editHooks?.onMovePath?.(dx,dz);
 }else editHooks?.onMove?.(d.id,d.group.position.x,d.group.position.z);
 editHooks?.onMoveEnd?.();
}

function disposeObject(obj){
 obj.traverse(o=>{
  if(o.geometry)o.geometry.dispose();
  if(o.material){
   if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());
   else o.material.dispose();
  }
 });
}

function mat(color,opts={}){
 return new THREE.MeshStandardMaterial({color,roughness:.88,metalness:.04,...opts});
}

function mesh(geo,material,cast=true,receive=true){
 const m=new THREE.Mesh(geo,material);
 m.castShadow=cast;m.receiveShadow=receive;
 return m;
}

function box(w,h,d,material,y=0){
 const m=mesh(new THREE.BoxGeometry(w,h,d),material);
 m.position.y=y+h/2;
 return m;
}

/** Сдвиг по плану без сброса высоты, которую задал box(). */
function atXZ(m,x,z){m.position.x=x;m.position.z=z;return m;}

/**
 * Крутой двускат «барнхаус».
 * Строится с коньком вдоль X: скаты уходят к ±Z, фронтоны (треугольники) на торцах ±X.
 * ridgeAxis:'z' — та же крыша, повёрнутая на 90°: конёк вдоль Z, фронтоны на ±Z.
 * Без свесов: кромка кровли лежит на верху стены (wallY), как у барна.
 */
function makeBarnRoof({cx=0,cz=0,span,length,wallY,rise,roofMat,gableMat,trimMat,ridgeAxis='x',gableInset=0}){
 const g=new THREE.Group();
 const hs=span/2,hl=length/2,ridgeY=wallY+rise;
 const slopeLen=Math.hypot(hs,rise),tilt=Math.atan2(rise,hs);
 const thick=.07;
 for(const s of [-1,1]){
  const panel=mesh(new THREE.BoxGeometry(length+.02,thick,slopeLen+.04),roofMat);
  panel.position.set(0,(wallY+ridgeY)/2+thick/2,s*(hs/2));
  panel.rotation.x=s*tilt;
  g.add(panel);
  // карнизная доска по длинной кромке
  const fascia=mesh(new THREE.BoxGeometry(length+.02,.16,.05),trimMat||roofMat);
  fascia.position.set(0,wallY-.02,s*(hs+.01));
  g.add(fascia);
 }
 // конёк
 g.add(atXZ(box(length+.06,.07,.2,trimMat||roofMat,ridgeY+thick/2),0,0));
 // фронтоны — объёмные треугольники на торцах ±X
 for(const s of [-1,1]){
  const shape=new THREE.Shape();
  shape.moveTo(-hs,wallY);shape.lineTo(hs,wallY);shape.lineTo(0,ridgeY+thick*.6);shape.closePath();
  const depth=.12;
  const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false});
  // ExtrudeGeometry лежит в XY, тянется вдоль +Z → разворачиваем в плоскость YZ
  geo.rotateY(Math.PI/2);
  const gable=mesh(geo,gableMat||roofMat);
  // после поворота экструзия идёт вдоль +X: фронтон занимает [px, px+depth]
  gable.position.x=s>0?hl-gableInset-depth:-(hl-gableInset);
  g.add(gable);
  // торцевая доска по скатам (ветровая)
  for(const t of [-1,1]){
   const wind=mesh(new THREE.BoxGeometry(.06,.14,slopeLen+.02),trimMat||roofMat);
   wind.position.set(s*(hl+.02),(wallY+ridgeY)/2+thick/2+.04,t*(hs/2));
   wind.rotation.x=t*tilt;
   g.add(wind);
  }
 }
 if(ridgeAxis==='z')g.rotation.y=Math.PI/2;
 g.position.set(cx,0,cz);
 return g;
}

function cachedTex(key,make){
 if(texCache.has(key))return texCache.get(key);
 const t=make();texCache.set(key,t);return t;
}

function grassTexture(){
 return cachedTex('grass',()=>{
  const c=document.createElement('canvas');c.width=c.height=256;
  const g=c.getContext('2d');
  g.fillStyle='#b7c79a';g.fillRect(0,0,256,256);
  for(let i=0;i<4200;i++){
   const x=Math.random()*256,y=Math.random()*256;
   const s=1+Math.random()*2.2;
   g.fillStyle=`hsl(${95+Math.random()*28},${28+Math.random()*22}%,${42+Math.random()*18}%)`;
   g.fillRect(x,y,s*.4,s);
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(18,12);t.colorSpace=THREE.SRGBColorSpace;
  return t;
 });
}

function deckTexture(){
 return cachedTex('deck',()=>{
  const c=document.createElement('canvas');c.width=128;c.height=256;
  const g=c.getContext('2d');
  g.fillStyle='#c4a67c';g.fillRect(0,0,128,256);
  for(let i=0;i<16;i++){
   g.fillStyle=i%2?'#b89568':'#cbb089';
   g.fillRect(0,i*16,128,14);
   g.strokeStyle='#a88858';g.lineWidth=.6;g.beginPath();g.moveTo(0,i*16+14);g.lineTo(128,i*16+14);g.stroke();
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1,5);t.colorSpace=THREE.SRGBColorSpace;
  return t;
 });
}

function pavingTexture(){
 return cachedTex('paving',()=>{
  const c=document.createElement('canvas');c.width=c.height=128;
  const g=c.getContext('2d');
  g.fillStyle='#d2ceba';g.fillRect(0,0,128,128);
  g.strokeStyle='#b8b49e';g.lineWidth=2;
  for(let i=0;i<=8;i++){g.beginPath();g.moveTo(i*16,0);g.lineTo(i*16,128);g.stroke();g.beginPath();g.moveTo(0,i*16);g.lineTo(128,i*16);g.stroke();}
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(6,8);t.colorSpace=THREE.SRGBColorSpace;
  return t;
 });
}

function asphaltTexture(){
 return cachedTex('asphalt',()=>{
  const c=document.createElement('canvas');c.width=c.height=64;
  const g=c.getContext('2d');
  g.fillStyle='#9a9b94';g.fillRect(0,0,64,64);
  for(let i=0;i<200;i++){g.fillStyle=`rgba(0,0,0,${.04+Math.random()*.08})`;g.fillRect(Math.random()*64,Math.random()*64,1,1);}
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1/2.5,1/2.5);t.colorSpace=THREE.SRGBColorSpace;
  return t;
 });
}

/** Фальцевая кровля RAL 7024: вертикальные фальцы вдоль ската. */
function metalRoofTexture(repeatX=8,repeatY=1){
 return cachedTex(`metalroof-${repeatX}-${repeatY}`,()=>{
  const c=document.createElement('canvas');c.width=128;c.height=128;
  const g=c.getContext('2d');
  g.fillStyle='#7f868d';g.fillRect(0,0,128,128);
  for(let i=0;i<128;i+=32){
   g.fillStyle='rgba(255,255,255,.12)';g.fillRect(i,0,2,128);
   g.fillStyle='rgba(0,0,0,.22)';g.fillRect(i+3,0,2,128);
   g.fillStyle='rgba(0,0,0,.05)';g.fillRect(i+16,0,10,128);
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeatX,repeatY);t.colorSpace=THREE.SRGBColorSpace;
  return t;
 });
}

/** Вертикальный планкен. dark — графит RAL 7024, иначе — лиственница. */
function plankTexture(kind,repeatX=1,repeatY=1){
 return cachedTex(`plank-${kind}-${repeatX}-${repeatY}`,()=>{
  const c=document.createElement('canvas');c.width=256;c.height=256;
  const g=c.getContext('2d');
  const dark=kind==='dark';
  g.fillStyle=dark?'#9ea4a9':'#d6b27c';g.fillRect(0,0,256,256);
  const bw=16;
  for(let x=0;x<256;x+=bw){
   const v=(Math.sin(x*12.9898)*43758.5453)%1;
   g.fillStyle=dark?`rgba(255,255,255,${.03+Math.abs(v)*.07})`:`rgba(${120+Math.abs(v)*40|0},${85+Math.abs(v)*30|0},40,${.10+Math.abs(v)*.14})`;
   g.fillRect(x,0,bw-2,256);
   g.fillStyle=dark?'rgba(0,0,0,.32)':'rgba(90,60,25,.55)';g.fillRect(x+bw-2,0,2,256);
  }
  if(!dark){
   for(let i=0;i<70;i++){g.fillStyle=`rgba(110,75,35,${.06+Math.random()*.08})`;g.fillRect(Math.random()*256,Math.random()*256,1,8+Math.random()*30);}
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeatX,repeatY);t.colorSpace=THREE.SRGBColorSpace;
  return t;
 });
}
/** Материал стены с планкеном под реальную ширину грани (доска ≈ 0,14 м). */
function plankMat(kind,faceWidth){
 const rep=Math.max(1,Math.round(faceWidth/.14/16));
 // серый планкен ≈ RAL 7037/7042 — читается светлее, чем графит 7024
 return mat(kind==='dark'?'#e0e3e6':'#e2c08c',{map:plankTexture(kind,rep,1),roughness:kind==='dark'?.72:.86});
}

function plotShape(){
 const s=new THREE.Shape();
 PLOT.forEach((p,i)=>{if(i===0)s.moveTo(p[0],-p[1]);else s.lineTo(p[0],-p[1]);});
 s.closePath();
 return s;
}

function groundSurround(){
 const g=new THREE.Group();
 const dirt=mesh(new THREE.CircleGeometry(90,48),mat('#c5c2b0',{roughness:1}),false,true);
 dirt.rotation.x=-Math.PI/2;dirt.position.y=-.04;dirt.position.set(16,-.04,11);
 g.add(dirt);
 return g;
}

function extrudedPlot(){
 const g=new THREE.Group();
 const geo=new THREE.ExtrudeGeometry(plotShape(),{depth:.14,bevelEnabled:true,bevelThickness:.02,bevelSize:.03,bevelSegments:1});
 geo.rotateX(-Math.PI/2);
 const grass=mesh(geo,mat('#b9c9a0',{map:grassTexture(),roughness:.95}),false,true);
 g.add(grass);
 const edge=new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints(PLOT.map(p=>new THREE.Vector3(p[0],0.16,p[1]))),
  new THREE.LineBasicMaterial({color:'#5a7558'})
 );
 g.add(edge);
 const rim=mat('#8a9a7a',{roughness:.9});
 for(let i=0;i<PLOT.length;i++){
  const a=PLOT[i],b=PLOT[(i+1)%PLOT.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
  if(len<.05)continue;
  const seg=mesh(new THREE.BoxGeometry(len,.1,.07),rim,false,true);
  seg.position.set((a[0]+b[0])/2,.05,(a[1]+b[1])/2);
  seg.rotation.y=-Math.atan2(dz,dx);
  g.add(seg);
 }
 return g;
}

function glassMat(){
 return new THREE.MeshPhysicalMaterial({
  color:'#c3dfee',metalness:.15,roughness:.04,transparent:true,opacity:.3,
  transmission:.5,thickness:.04,ior:1.45,envMapIntensity:1,
  emissive:'#86aec4',emissiveIntensity:.16,
  side:THREE.DoubleSide,depthWrite:false
 });
}

function tagEditable(group,id){
 group.userData.editId=id;
 group.traverse(c=>{if(c.isMesh){c.userData.editPick=id;if(!c.userData.partId&&group.userData.partId){c.userData.partId=group.userData.partId;c.userData.partLabel=group.userData.partLabel;}}});
 return group;
}

function tagPart(obj,partId,label){
 obj.userData.partId=partId;
 obj.userData.partLabel=label;
 obj.traverse(c=>{if(c.isMesh){c.userData.partId=partId;c.userData.partLabel=label;}});
 return obj;
}

function addPart(parent,obj,partId,label,hidden){
 if(hidden?.has(partId)){disposeObject(obj);return null;}
 parent.add(tagPart(obj,partId,label));
 return obj;
}

function applySelectionHighlight(root,selected){
 const isPart=selected&&String(selected).includes(':');
 root?.traverse(obj=>{
  if(!obj.isMesh||!obj.userData.editPick)return;
  // клон материала — иначе подсветка красит все общие материалы
  if(!obj.userData._ownMat){
   obj.material=Array.isArray(obj.material)?obj.material.map(m=>m.clone()):obj.material.clone();
   obj.userData._ownMat=true;
  }
  const on=isPart?obj.userData.partId===selected:obj.userData.editPick===selected;
  for(const m of Array.isArray(obj.material)?obj.material:[obj.material]){
   if(!m?.emissive)continue;
   if(on){m.emissive.set(0xc9a35a);m.emissiveIntensity=.14;}
   else{m.emissive.set(0x000000);m.emissiveIntensity=0;}
  }
 });
}

/** Окно как у двери: тёмная рама-обвязка, тёмное отражающее стекло, сверху — прозрачный слой. */
function makeWindow(frameMat,paneMat,w,h,y,depth=.06){
 const g=new THREE.Group();
 const f=.06;
 // рама из четырёх брусков — не сплошная плита за стеклом
 g.add(atXZ(box(w+2*f,f,depth,frameMat,y+h),0,0));
 g.add(atXZ(box(w+2*f,f,depth,frameMat,y-f),0,0));
 g.add(atXZ(box(f,h,depth,frameMat,y),-(w+f)/2,0));
 g.add(atXZ(box(f,h,depth,frameMat,y),(w+f)/2,0));
 // тёмный стеклопакет — читается как стекло, а не как светлая панель
 g.add(box(w,h,.01,windowGlassBack(),y));
 g.add(box(w,h,depth*.5,paneMat,y));
 return g;
}
let _glassBack=null;
function windowGlassBack(){
 // светлое «небесное» стекло: полупрозрачное, с отблеском
 return _glassBack||(_glassBack=new THREE.MeshStandardMaterial({color:'#a9c8da',roughness:.08,metalness:.45,emissive:'#7ea4b8',emissiveIntensity:.3,transparent:true,opacity:.7,depthWrite:false}));
}

/** Материалы барнхауса: графит RAL 7024 + лиственница + чёрные рамы. */
function barnPalette(){
 return {
  roof:(len)=>mat('#c9cfd4',{map:metalRoofTexture(Math.max(2,Math.round(len/2)),1),roughness:.55,metalness:.22}),
  trim:mat('#4a5157',{roughness:.6,metalness:.15}),
  // рамы как у двери — антрацит
  frame:mat('#1f2428',{roughness:.45,metalness:.2}),
  rail:mat('#1c2023',{roughness:.4,metalness:.3}),
  gable:mat('#e2c08c',{map:plankTexture('wood',.45,.45),roughness:.86}),
  plinth:mat('#4e4c48',{roughness:.94}),
  deck:mat('#c4a67c',{map:deckTexture(),roughness:.85}),
  door:mat('#2a2e32',{roughness:.5,metalness:.15}),
  glass:glassMat()
 };
}

/** Коробка с планкеном: ±X и ±Z грани — по своей ширине; terraceFace — какая грань тёплым деревом. */
function plankBox(w,h,d,y,woodFace=null){
 const mats=[
  plankMat(woodFace==='+x'?'wood':'dark',d), // +X
  plankMat(woodFace==='-x'?'wood':'dark',d), // -X
  mat('#3d4145'),mat('#3d4145'),               // top / bottom
  plankMat(woodFace==='+z'?'wood':'dark',w), // +Z
  plankMat(woodFace==='-z'?'wood':'dark',w)  // -Z
 ];
 return box(w,h,d,mats,y);
}

/**
 * Дом 10×8 в стиле барнхаус: крутой двускат без свесов, конёк вдоль длинной оси,
 * графитовый объём, фронтоны из лиственницы, терраса под общей крышей со стороны леса.
 */
function buildHouse(project){
 const g=new THREE.Group();
 const hidden=new Set(project.hidden3d||[]);
 const H=project.house.height||2.7;
 const P=barnPalette();
 // конёк поперёк дома (вдоль X), скаты к ±Z; пологий барн ≈ 12.5° (подъём ≈ 1,1 м)
 const y0=.18,wallY=y0+H,rise=5.05*Math.tan(rad(24))/2,tilt=Math.atan2(rise,5.05);

 g.add(box(8.05,.16,10.05,P.plinth,0));
 // основной объём x∈[-2,4]; грань к террасе (−X) — дерево
 g.add(atXZ(plankBox(6,H,10,y0,'-x'),1,0));

 // торцевые стены — по 3 высоких окна
 for(const zSign of [-1,1]){
  const zFace=zSign*5.0,side=zSign<0?'s':'n';
  let i=0;
  for(const x of [-.6,1,2.6]){
   const win=makeWindow(P.frame,P.glass,.8,1.6,y0+.7);
   win.position.set(x,0,zFace+zSign*.03);
   addPart(g,win,`house:window-${side}-${i++}`,'Окно',hidden);
  }
 }

 // фасад к террасе — 4 витража в пол
 for(let i=0;i<4;i++){
  const z=-3.7+i*2.45;
  const win=makeWindow(P.frame,P.glass,2.15,H-.4,y0+.15,.06);
  win.rotation.y=Math.PI/2;
  win.position.set(-2.0,0,z);
  addPart(g,win,`house:window-terrace-${i}`,'Витраж',hidden);
 }

 // крыша: конёк вдоль X, пролёт 10 м (±Z), длина 8 м накрывает и террасу
 addPart(g,makeBarnRoof({cx:0,cz:0,span:10.1,length:8.08,wallY,rise,roofMat:P.roof(8),gableMat:P.gable,trimMat:P.trim,ridgeAxis:'x'}),'house:roof','Кровля',hidden);

 // окно во фронтоне со стороны дороги (+X)
 {
  const win=makeWindow(P.frame,P.glass,.9,.5,wallY+.18,.06);
  win.rotation.y=Math.PI/2;
  win.position.set(4.08,0,0);
  addPart(g,win,'house:window-gable','Окно фронтона',hidden);
 }

 {
  const terrace=new THREE.Group();
  terrace.add(atXZ(box(2,.1,10,P.deck,y0),-3,0));
  terrace.add(atXZ(box(2.05,.05,10.05,mat('#8f7348'),.08),-3,0));
  // стойки под фронтоном и прогон
  for(const z of [-1.65,1.65])terrace.add(atXZ(box(.14,wallY-y0-.1,.14,P.trim,y0+.1),-3.92,z));
  terrace.add(atXZ(box(.14,.2,10,P.trim,wallY-.2),-3.92,0));
  // деревянный потолок террасы — два ската под кровлей
  const sl=Math.hypot(5.05,rise);
  for(const s of [-1,1]){
   const soffit=mesh(new THREE.BoxGeometry(1.96,.03,sl-.1),plankMat('wood',2));
   soffit.position.set(-3,wallY+rise/2-.06,s*5.05/2);
   soffit.rotation.x=s*tilt;
   terrace.add(soffit);
  }
  addPart(g,terrace,'house:terrace','Терраса',hidden);
 }
 {
  // боковые стены продолжены на террасу — классическая ниша барнхауса; изнутри лиственница
  const walls=new THREE.Group();
  const t=.2;
  for(const s of [-1,1])walls.add(atXZ(plankBox(2,H,t,y0,s<0?'+z':'-z'),-3,s*(5-t/2)));
  addPart(g,walls,'house:terrace-walls','Стены террасы',hidden);
 }
 {
  const rail=new THREE.Group();
  for(const z of [-3.3,-2.5,-0.8,0,0.8,2.5,3.3])rail.add(atXZ(box(.03,.92,.03,P.rail,y0+.1),-3.84,z));
  rail.add(atXZ(box(.04,.04,9.6,P.rail,y0+1.0),-3.84,0));
  rail.add(atXZ(box(.025,.025,9.6,P.rail,y0+.55),-3.84,0));
  addPart(g,rail,'house:railing','Перила',hidden);
 }
 {
  const entry=new THREE.Group();
  entry.add(atXZ(box(1.2,2.3,.06,plankMat('wood',1.2),y0),-1,-5.03));
  entry.add(atXZ(box(1.0,2.15,.08,P.door,y0),-1,-5.06));
  entry.add(atXZ(box(.55,1.4,.03,P.glass,y0+.45),-1,-5.11));
  entry.add(atXZ(box(1.5,.1,.6,mat('#8a8880'),y0-.1),-1,-5.35));
  addPart(g,entry,'house:entry','Дверь',hidden);
 }

 g.position.set(project.house.x,0,project.house.y);
 g.rotation.y=-rad(project.house.angle);
 return g;
}

/**
 * Бытовка «Барн Хаус» 6×4: конёк вдоль длинной оси, крутой двускат RAL 7024,
 * веранда 1×4 внутри габарита под фронтоном, стены — графит, ниша веранды — лиственница.
 */
function buildShed(o,hiddenList=[]){
 const g=new THREE.Group();
 const hidden=new Set(hiddenList);
 const H=o.height||2.4,W=o.w||6,D=o.h||4;
 const P=barnPalette();
 // конёк вдоль X как у дома, скаты к ±Z; пологий ≈ 20° (подъём ≈ 0,7 м)
 const y0=.12,wallY=y0+H,V=1,rise=(D/2)*Math.tan(rad(20));

 g.add(box(W,.12,D,P.plinth,0));
 // объём без веранды; грань к веранде (+X) — дерево
 g.add(atXZ(plankBox(W-V,H,D,y0,'+x'),-V/2,0));

 addPart(g,makeBarnRoof({cx:0,cz:0,span:D+.06,length:W+.06,wallY,rise,roofMat:P.roof(W),gableMat:P.gable,trimMat:P.trim,ridgeAxis:'x'}),'shed:roof','Кровля',hidden);

 {
  const veranda=new THREE.Group();
  veranda.add(atXZ(box(V,.1,D-.04,P.deck,y0),W/2-V/2,0));
  // прогон под фронтоном
  veranda.add(atXZ(box(.12,.16,D,P.trim,wallY-.16),W/2-.08,0));
  addPart(g,veranda,'shed:veranda','Веранда',hidden);
 }
 {
  // боковые стены продолжены на веранду — ниша под фронтоном, изнутри лиственница
  const walls=new THREE.Group();
  const t=.12;
  for(const s of [-1,1])walls.add(atXZ(plankBox(V,H,t,y0,s<0?'+z':'-z'),W/2-V/2,s*(D/2-t/2)));
  addPart(g,walls,'shed:veranda-walls','Стены веранды',hidden);
 }
 {
  const entry=new THREE.Group();
  const xf=W/2-V;
  entry.add(atXZ(box(.07,2.05,.95,P.door,y0),xf+.03,-D*.2));
  entry.add(atXZ(box(.03,1.2,.5,P.glass,y0+.45),xf+.08,-D*.2));
  addPart(g,entry,'shed:entry','Дверь',hidden);
 }
 {
  const win=makeWindow(P.frame,P.glass,.8,1.2,y0+.8);
  win.rotation.y=Math.PI/2;
  win.position.set(W/2-V+.03,0,D*.22);
  addPart(g,win,'shed:window','Окно',hidden);
 }
 {
  const win=makeWindow(P.frame,P.glass,.7,1.1,y0+.85);
  win.position.set(-W*.12,0,D/2+.03);
  addPart(g,win,'shed:window-side','Окно бок',hidden);
 }

 g.position.set(o.x,0,o.y);
 g.rotation.y=-rad(o.angle||0);
 return g;
}

function gravelTexture(){
 return cachedTex('gravel',()=>{
  const c=document.createElement('canvas');c.width=c.height=128;
  const g=c.getContext('2d');
  g.fillStyle='#c7b797';g.fillRect(0,0,128,128);
  for(let i=0;i<900;i++){
   g.fillStyle=`rgba(${140+Math.random()*60|0},${120+Math.random()*50|0},${90+Math.random()*40|0},${.35+Math.random()*.4})`;
   g.fillRect(Math.random()*128,Math.random()*128,1+Math.random()*2,1+Math.random()*2);
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(4,6);t.colorSpace=THREE.SRGBColorSpace;
  return t;
 });
}

function buildParking(o){
 const g=new THREE.Group();
 const w=o.w,d=o.h;
 // газон ~0,16 м — площадка выше травы
 const y0=.18;
 const padMat=mat('#cfcab4',{map:pavingTexture(),roughness:.9});
 g.add(box(w,.1,d,padMat,y0));
 const curb=mat('#a8a494',{roughness:.92});
 g.add(atXZ(box(w+.16,.14,.14,curb,y0),0,-d/2));
 g.add(atXZ(box(w+.16,.14,.14,curb,y0),0,d/2));
 g.add(atXZ(box(.14,.14,d,curb,y0),-w/2,0));
 g.add(atXZ(box(.14,.14,d,curb,y0),w/2,0));
 const mark=mat('#f2efe4',{roughness:.55}),top=y0+.1;
 const bw=Math.min(2.5,w*.4),bh=Math.min(5.4,d*.72);
 for(const side of [-1,1]){
  const x=side*(w/4);
  const mk=(ww,hh,dx,dz)=>atXZ(box(ww,.03,hh,mark,top),x+dx,dz);
  g.add(mk(bw,.07,0,-bh/2),mk(bw,.07,0,bh/2),mk(.07,bh,-bw/2,0),mk(.07,bh,bw/2,0));
 }
 g.add(atXZ(box(.05,.025,d*.75,mat('#b0aa94'),top+.01),0,0));
 for(const side of [-1,1])
  g.add(atXZ(box(bw*.9,.035,.12,mat('#c45a4a',{roughness:.7}),top),side*(w/4),-bh/2+.2));
 g.position.set(o.x,0,o.y);
 g.rotation.y=-rad(o.angle||0);
 return g;
}

function pathStyle(material){
 if(material==='pavers')return {color:'#bebcad',roughness:.88,map:pavingTexture()};
 if(material==='wood')return {color:'#bb9772',roughness:.85,map:deckTexture()};
 return {color:'#c4b38a',roughness:.94,map:gravelTexture()};
}

function pathMeshes(points,width,material='gravel'){
 const g=new THREE.Group();
 if(points.length<2)return g;
 const style=pathStyle(material);
 const m=mat(style.color,{roughness:style.roughness,map:pathMap(material)});
 const edge=mat('#a89872',{roughness:.95});
 const y=.16,r=width/2;
 // убираем дубли узлов — иначе ломается направление
 const pts=points.filter((p,i)=>i===0||Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>.05);
 if(pts.length<2)return g;
 // прямые торцы и острые (mitre) углы — один плоский полигон
 const {L,R}=offsetOutline(pts,r);
 const shape=new THREE.Shape();
 L.forEach((p,i)=>i?shape.lineTo(p[0],-p[1]):shape.moveTo(p[0],-p[1]));
 for(let i=R.length-1;i>=0;i--)shape.lineTo(R[i][0],-R[i][1]);
 shape.closePath();
 const slab=mesh(new THREE.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:false}),m,false,true);
 slab.rotation.x=-Math.PI/2;slab.position.y=y;g.add(slab);
 // бордюр по обеим кромкам
 const rims=offsetOutline(pts,r-.04);
 for(const side of [rims.L,rims.R])for(let i=1;i<side.length;i++){
  const a=side[i-1],b=side[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
  if(len<.02)continue;
  const rim=mesh(new THREE.BoxGeometry(len+.06,.05,.08),edge,false,true);
  rim.position.set((a[0]+b[0])/2,y+.03,(a[1]+b[1])/2);
  rim.rotation.y=-Math.atan2(dz,dx);g.add(rim);
 }
 return g;
}
/** Левая и правая кромки ломаной с острыми стыками (mitre, ограничен 3r). */
function offsetOutline(points,r){
 const n=points.length,L=[],R=[];
 const dir=i=>{const a=points[i],b=points[i+1],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;return [(b[0]-a[0])/l,(b[1]-a[1])/l];};
 for(let i=0;i<n;i++){
  const d0=i>0?dir(i-1):dir(0),d1=i<n-1?dir(i):dir(n-2);
  const n0=[-d0[1],d0[0]],n1=[-d1[1],d1[0]];
  let mx=n0[0]+n1[0],mz=n0[1]+n1[1];const ml=Math.hypot(mx,mz);
  let ox,oz;
  if(ml<1e-6){ox=n0[0]*r;oz=n0[1]*r;}
  else{mx/=ml;mz/=ml;const len=Math.min(r/Math.max(mx*n0[0]+mz*n0[1],.2),r*3);ox=mx*len;oz=mz*len;}
  L.push([points[i][0]+ox,points[i][1]+oz]);R.push([points[i][0]-ox,points[i][1]-oz]);
 }
 return {L,R};
}
/** Текстура покрытия в метрах (UV экструзии — мировые координаты). */
function pathMap(material){
 return cachedTex('path-map-'+material,()=>{
  const src=pathStyle(material).map,t=src.clone();
  t.needsUpdate=true;
  if(material==='pavers')t.repeat.set(1/3.2,1/3.2);
  else if(material==='wood')t.repeat.set(1/1.2,1/2.4);
  else t.repeat.set(1/.6,1/.6);
  return t;
 });
}

function buildGate(){
 const g=new THREE.Group();
 const len=dist2(GATE.a,GATE.b);
 const ang=-Math.atan2(GATE.b[1]-GATE.a[1],GATE.b[0]-GATE.a[0]);
 const postMat=mat('#6e5538',{roughness:.82});
 const barMat=mat('#b28652',{roughness:.7});
 for(const p of [GATE.a,GATE.b]){
  g.add(atXZ(box(.26,1.35,.26,postMat,0),p[0],p[1]));
  g.add(atXZ(box(.34,.07,.34,mat('#c4a06a'),1.35),p[0],p[1]));
 }
 // перекладина и порог — без «створок» плашмя
 const beam=atXZ(box(len,.1,.1,barMat,1.15),GATE.center[0],GATE.center[1]);
 beam.rotation.y=ang;g.add(beam);
 const apron=atXZ(box(len+.3,.06,1.8,mat('#b8b3a0',{map:pavingTexture(),roughness:.92}),0),GATE.center[0],GATE.center[1]);
 apron.rotation.y=ang;g.add(apron);
 return g;
}

/** Гравийный въезд — позиция/размер из project.driveway, без привязки к парковке. */
function buildDriveway(o){
 const g=new THREE.Group();
 const w=o.w,d=o.h,y0=.18;
 const gravel=mat('#c4b38a',{map:gravelTexture(),roughness:.95});
 g.add(box(w,.08,d,gravel,y0));
 const curb=mat('#a89872',{roughness:.92});
 g.add(atXZ(box(w+.1,.1,.1,curb,y0),0,-d/2));
 g.add(atXZ(box(w+.1,.1,.1,curb,y0),0,d/2));
 g.add(atXZ(box(.1,.1,d,curb,y0),-w/2,0));
 g.add(atXZ(box(.1,.1,d,curb,y0),w/2,0));
 g.position.set(o.x,0,o.y);
 g.rotation.y=-rad(o.angle||0);
 return g;
}

function buildRoad(){
 const g=new THREE.Group();
 // Полотно повторяет излом правой границы: внутренняя кромка лежит на границе участка.
 const ring=[...ROAD.inner,...[...ROAD.outer].reverse()];
 const shape=new THREE.Shape(ring.map(([x,z])=>new THREE.Vector2(x,-z)));
 const geo=new THREE.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:false});
 const road=mesh(geo,mat('#8f9088',{map:asphaltTexture(),roughness:.94}),false,true);
 road.rotation.x=-Math.PI/2;road.position.y=-.01;g.add(road);
 const alongSegments=(pts,fn)=>{for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);fn(a,dx/len,dz/len,len,Math.atan2(dx,dz));}};
 // разметка — штрихи вдоль осевой каждого отрезка
 const dash=mat('#e8e4d4',{roughness:.6});
 alongSegments(ROAD.center,(a,ux,uz,len,ang)=>{
  for(let t=1.6;t+1.4<len;t+=3.2){
   const m=mesh(new THREE.BoxGeometry(.12,.02,1.4),dash,false,true);
   m.position.set(a[0]+ux*(t+.7),.07,a[1]+uz*(t+.7));m.rotation.y=ang;g.add(m);
  }
 });
 // бордюр только с внешней стороны — внутренняя кромка вплотную к забору
 const curbMat=mat('#a8a99f');
 alongSegments(ROAD.outer,(a,ux,uz,len,ang)=>{
  const c=atXZ(box(.2,.14,len+.2,curbMat,0),a[0]+ux*len/2,a[1]+uz*len/2);c.rotation.y=ang;g.add(c);
 });
 return g;
}

function addTree(group,x,z,height,trunkMat,leafMats,crownScale=1){
 const th=Math.max(3.5,height),tw=.014*th;
 const trunk=mesh(new THREE.CylinderGeometry(tw*.6,tw,th*.24,6),trunkMat);
 trunk.position.set(x,th*.12,z);group.add(trunk);
 const tiers=[[.55,.34],[.44,.52],[.34,.68],[.24,.84]];
 tiers.forEach(([rFrac,yFrac],i)=>{
  const r=th*rFrac*.17*crownScale;
  const crown=mesh(new THREE.ConeGeometry(r,th*.27,8),leafMats[i%leafMats.length]);
  crown.position.set(x,th*yFrac,z);group.add(crown);
 });
}

function addForest(group,treeHeight=7){
 const trunkMat=mat('#6a5438',{roughness:1});
 const leafMats=[mat('#5a7550',{roughness:1}),mat('#6a8460',{roughness:1}),mat('#4f6a48',{roughness:1})];
 const h=Math.max(4,Math.min(treeHeight,40));
 const base=h*1.06;
 for(let i=0;i<24;i++){
  const z=.35+i*.82+(i%4)*.05;
  const x=-.75-(i%6)*.34-((i*5)%8)*.04;
  addTree(group,x,z,base*(.78+(i%6)*.035),trunkMat,leafMats,.95+((i*3)%5)*.06);
 }
 for(let i=0;i<16;i++){
  const z=.9+i*1.05+(i%3)*.07;
  const x=-1.55-(i%5)*.28;
  addTree(group,x,z,base*(.88+(i%4)*.03),trunkMat,leafMats,1.05+((i*2)%4)*.05);
 }
 for(let i=0;i<10;i++){
  const z=1.8+i*1.85;
  const x=-2.35-(i%3)*.22;
  addTree(group,x,z,base*(.92+(i%3)*.025),trunkMat,leafMats,1.08);
 }
}

function addFence(group){
 const matWood=mat('#8a734f',{roughness:.9});
 const matRail=mat('#9a8560',{roughness:.85});
 for(let i=0;i<=14;i++){
  const z=.6+i*(21.44-.8)/14;
  group.add(atXZ(box(.08,1.2,.08,matWood,0),-.12,z));
 }
 for(const y of [.35,.7,1.05])group.add(atXZ(box(.04,.04,20.6,matRail,y),-.12,11));
}

function buildSceneContent(project,solar){
 const g=new THREE.Group();
 g.add(groundSurround());
 g.add(extrudedPlot());
 g.add(tagEditable(buildHouse(project),'house'));
 if(project.shed.visible!==false)g.add(tagEditable(buildShed(project.shed,project.hidden3d),'shed'));
 if(project.driveway&&project.driveway.visible!==false)g.add(tagEditable(buildDriveway(project.driveway),'driveway'));
 if(project.parking.visible!==false)g.add(tagEditable(buildParking(project.parking),'parking'));
 if(project.path.visible){
  const pathWrap=new THREE.Group();
  pathWrap.userData.editId='path';
  pathWrap.add(pathMeshes(pathPoints(project),project.path.width,project.path.material));
  pathWrap.traverse(c=>{if(c.isMesh)c.userData.editPick='path';});
  g.add(pathWrap);
 }
 g.add(buildGate());
 g.add(buildRoad());
 if(solar?.forest!==false){
  const forest=new THREE.Group();
  addForest(forest,solar?.treeHeight||7);
  addFence(forest);
  g.add(forest);
 }
 return g;
}

function dist2(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1]);}

function updateSunLight(light,solar){
 const sun=solarPosition(solar.date,solar.minutes,solar.lat,solar.lng,solar.tz);
 const amb=scene?.userData.amb,hemi=scene?.userData.hemi;
 if(!sun.daylight){
  // мягкие сумерки: материалы остаются читаемыми
  light.intensity=.35;light.color.set('#b8c4d8');light.position.set(22,28,14);
  if(amb)amb.intensity=.55;if(hemi)hemi.intensity=.32;
  if(scene){scene.background=new THREE.Color('#6a7580');scene.fog.color.set('#6a7580');scene.fog.near=50;scene.fog.far=120;}
  if(renderer)renderer.toneMappingExposure=.95;
  return sun;
 }
 const az=rad(sun.azimuth-(FOREST_BEARING-180));
 const alt=rad(sun.altitude);
 const r=55;
 const vx=Math.cos(az),vz=Math.sin(az);
 light.position.set(18+vx*r*Math.cos(alt),Math.max(4,r*Math.sin(alt)),10.7+vz*r*Math.cos(alt));
 light.intensity=.85+.45*Math.sin(alt);
 light.color.set('#fff8ea');
 light.target.position.set(18,0,10.7);
 if(amb)amb.intensity=.65;if(hemi)hemi.intensity=.5;
 if(scene){scene.background=new THREE.Color('#d4deca');scene.fog.color.set('#d4deca');scene.fog.near=55;scene.fog.far=130;}
 if(renderer)renderer.toneMappingExposure=1.05;
 return sun;
}

function frame(){
 raf=requestAnimationFrame(frame);
 controls?.update();
 renderer?.render(scene,camera);
}

function onResize(){
 if(!host||!renderer||!camera)return;
 const w=host.clientWidth||1,h=host.clientHeight||1;
 camera.aspect=w/h;camera.updateProjectionMatrix();
 renderer.setSize(w,h,false);
}

function applyCameraHome(){
 camera.position.set(...CAM.pos);
 controls.target.set(...CAM.target);
 controls.update();
}

export async function mountView3d(container){
 host=container;
 if(!renderer){
  scene=new THREE.Scene();
  scene.background=new THREE.Color('#d4deca');
  scene.fog=new THREE.Fog('#d4deca',55,130);
  camera=new THREE.PerspectiveCamera(40,1,0.1,300);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.05;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.06;
  controls.enablePan=true;
  controls.screenSpacePanning=true;
  controls.panSpeed=1.15;
  controls.rotateSpeed=.85;
  controls.zoomSpeed=1.05;
  controls.maxPolarAngle=Math.PI*.48;
  controls.minDistance=6;controls.maxDistance=120;
  controls.target.set(...CAM.target);
  syncPanMode();
  applyCameraHome();
  window.addEventListener('keydown',onSpaceDown,{passive:false});
  window.addEventListener('keyup',onSpaceUp);
  window.addEventListener('blur',()=>{spaceHeld=false;syncPanMode();});
  const amb=new THREE.AmbientLight(0xe9ecef,.6);
  const hemi=new THREE.HemisphereLight(0xdfe8f5,0x7a8468,.5);
  const sun=new THREE.DirectionalLight(0xfff1d0,1);
  sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.left=-45;sun.shadow.camera.right=45;
  sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;
  sun.shadow.camera.far=130;
  sun.shadow.bias=-0.00025;
  sun.target.position.set(18,0,10.7);
  scene.add(amb,hemi,sun,sun.target);
  scene.userData.sun=sun;scene.userData.amb=amb;scene.userData.hemi=hemi;
  root=new THREE.Group();
  scene.add(root);
  renderer.domElement.className='view3d-canvas';
  renderer.domElement.setAttribute('aria-label','Трёхмерный вид участка');
  const el=renderer.domElement;
  el.addEventListener('pointerdown',onCanvasPointerDown);
  el.addEventListener('pointermove',onCanvasPointerMove);
  el.addEventListener('pointerup',onCanvasPointerUp);
  el.addEventListener('pointercancel',onCanvasPointerUp);
  el.addEventListener('pointerleave',onCanvasPointerUp);
 }
 if(renderer.domElement.parentElement!==host)host.appendChild(renderer.domElement);
 host.hidden=false;
 onResize();
 if(ro)ro.disconnect();
 ro=new ResizeObserver(onResize);ro.observe(host);
 if(!raf)frame();
 return {ok:true};
}

export function updateView3d(project,solar,selected='',partId=''){
 if(!scene||!root)return;
 while(root.children.length){const c=root.children.pop();disposeObject(c);}
 root.add(buildSceneContent(project,solar));
 updateSunLight(scene.userData.sun,solar);
 selected3d=selected;
 selectedPart=partId||'';
 // подсветка выбранного — только в режиме редактирования, иначе здание красится целиком
 applySelectionHighlight(root,editEnabled?(partId||selected):'');
 setGridVisible(editEnabled);
}

export function setView3dEditEnabled(on){
 editEnabled=!!on;
 setGridVisible(editEnabled);
 applySelectionHighlight(root,editEnabled?(selectedPart||selected3d):'');
}

export function setView3dEditor(hooks){editHooks=hooks||null;}

export function getSelectedPart(){return selectedPart;}

export function resetView3dCamera(){
 if(!camera||!controls)return;
 applyCameraHome();
}

export function unmountView3d(){
 if(raf){cancelAnimationFrame(raf);raf=0;}
 if(ro){ro.disconnect();ro=null;}
 if(renderer?.domElement?.parentElement)renderer.domElement.parentElement.removeChild(renderer.domElement);
 if(host)host.hidden=true;
}

export function disposeView3d(){
 unmountView3d();
 if(root){disposeObject(root);scene?.remove(root);root=null;}
 controls?.dispose();
 renderer?.dispose();
 for(const t of texCache.values())t.dispose();
 texCache.clear();
 renderer=null;scene=null;camera=null;controls=null;host=null;
}
