import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {PLOT,FOREST_BEARING,GATE,pathPoints,rad} from './geometry.js?v=15';
import {solarPosition} from './solar.js?v=15';

let renderer,scene,camera,controls,root,raf=0,host=null,ro=null;

function disposeObject(obj){
 obj.traverse(o=>{
  if(o.geometry)o.geometry.dispose();
  if(o.material){
   if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());
   else o.material.dispose();
  }
 });
}

function plotShape(){
 const s=new THREE.Shape();
 // −y: после rotateX(−90°) план (x,y) → мир (x, z=y), нормаль вверх
 PLOT.forEach((p,i)=>{if(i===0)s.moveTo(p[0],-p[1]);else s.lineTo(p[0],-p[1]);});
 s.closePath();
 return s;
}

function boxMesh(w,h,d,color,y=0){
 const m=new THREE.Mesh(
  new THREE.BoxGeometry(w,h,d),
  new THREE.MeshStandardMaterial({color,roughness:.85,metalness:.05})
 );
 m.position.y=y+h/2;
 m.castShadow=true;m.receiveShadow=true;
 return m;
}

function extrudedPlot(color='#c5d2b0'){
 const geo=new THREE.ExtrudeGeometry(plotShape(),{depth:.12,bevelEnabled:false});
 geo.rotateX(-Math.PI/2);
 const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:1,metalness:0}));
 mesh.receiveShadow=true;
 return mesh;
}

function addForest(group,treeHeight=18){
 const trunkMat=new THREE.MeshStandardMaterial({color:'#6a5438',roughness:1});
 const leafMat=new THREE.MeshStandardMaterial({color:'#5f7a52',roughness:1});
 for(let i=0;i<14;i++){
  const z=1.2+i*1.45,x=-1.1-(i%3)*.35;
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,treeHeight*.22,6),trunkMat);
  trunk.position.set(x,treeHeight*.11,z);trunk.castShadow=true;
  const crown=new THREE.Mesh(new THREE.ConeGeometry(.9+((i*5)%7)*.08,treeHeight*.55,7),leafMat);
  crown.position.set(x,treeHeight*.22+treeHeight*.28,z);crown.castShadow=true;
  group.add(trunk,crown);
 }
}

function pathMeshes(points,width,color='#c7b797'){
 const g=new THREE.Group();
 if(points.length<2)return g;
 const mat=new THREE.MeshStandardMaterial({color,roughness:.95});
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
  if(len<.05)continue;
  const slab=new THREE.Mesh(new THREE.BoxGeometry(len,0.08,width),mat);
  slab.position.set((a[0]+b[0])/2,0.04,(a[1]+b[1])/2);
  slab.rotation.y=-Math.atan2(dz,dx);
  slab.receiveShadow=true;
  g.add(slab);
 }
 return g;
}

function buildSceneContent(project,solar){
 const g=new THREE.Group();
 g.add(extrudedPlot());

 const edge=new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints(PLOT.map(p=>new THREE.Vector3(p[0],0.13,p[1]))),
  new THREE.LineBasicMaterial({color:'#476c4e'})
 );
 g.add(edge);

 const hh=project.house.height||2.7;
 const house=new THREE.Group();
 house.position.set(project.house.x,0,project.house.y);
 house.rotation.y=-rad(project.house.angle);
 const living=boxMesh(6,hh,10,'#6a8475');living.position.x=1;
 const terrace=boxMesh(2,.32,10,'#c4a67c');terrace.position.set(-3,0,0);
 house.add(living,terrace);
 g.add(house);

 const shedH=project.shed.height||2.5;
 const shed=boxMesh(project.shed.w,shedH,project.shed.h,'#9aaf8f');
 shed.position.set(project.shed.x,shedH/2,project.shed.y);
 shed.rotation.y=-rad(project.shed.angle||0);
 g.add(shed);

 const park=boxMesh(project.parking.w,.06,project.parking.h,'#cfcab6');
 park.position.set(project.parking.x,.03,project.parking.y);
 park.rotation.y=-rad(project.parking.angle||0);
 g.add(park);

 if(project.path.visible)g.add(pathMeshes(pathPoints(project),project.path.width));

 const gateMat=new THREE.MeshStandardMaterial({color:'#b28652'});
 const gate=new THREE.Mesh(new THREE.BoxGeometry(dist2(GATE.a,GATE.b),.2,.25),gateMat);
 gate.position.set(GATE.center[0],.2,GATE.center[1]);
 const gdx=GATE.b[0]-GATE.a[0],gdz=GATE.b[1]-GATE.a[1];
 gate.rotation.y=-Math.atan2(gdz,gdx);
 g.add(gate);

 if(solar?.forest!==false)addForest(g,solar?.treeHeight||18);

 // дорога за участком
 const road=new THREE.Mesh(
  new THREE.BoxGeometry(4,0.05,28),
  new THREE.MeshStandardMaterial({color:'#b8b9b0',roughness:1})
 );
 road.position.set(38.5,0.02,10);road.rotation.y=-0.2;
 g.add(road);

 return g;
}

function dist2(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1]);}

function updateSunLight(light,solar){
 const sun=solarPosition(solar.date,solar.minutes,solar.lat,solar.lng,solar.tz);
 if(!sun.daylight){
  light.intensity=.15;light.position.set(20,30,10);return sun;
 }
 const az=rad(sun.azimuth-(FOREST_BEARING-180));
 const alt=rad(sun.altitude);
 const r=55;
 // свет приходит с азимута: в плане +X к дороге, лес −X; sunVector в solar.js
 const vx=Math.cos(az),vz=Math.sin(az);
 light.position.set(18+vx*r*Math.cos(alt),Math.max(4,r*Math.sin(alt)),10.7+vz*r*Math.cos(alt));
 light.intensity=.95+.4*Math.sin(alt);
 light.target.position.set(18,0,10.7);
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

export async function mountView3d(container){
 host=container;
 if(!renderer){
  scene=new THREE.Scene();
  scene.background=new THREE.Color('#dfe6d4');
  scene.fog=new THREE.Fog('#dfe6d4',70,140);
  camera=new THREE.PerspectiveCamera(42,1,0.1,300);
  camera.position.set(42,28,48);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  controls=new OrbitControls(camera,renderer.domElement);
  controls.target.set(17,0,11);
  controls.enableDamping=true;
  controls.maxPolarAngle=Math.PI*.48;
  controls.minDistance=12;controls.maxDistance=90;
  const amb=new THREE.AmbientLight(0xf2efe4,.55);
  const hemi=new THREE.HemisphereLight(0xe8f0ff,0x6b7a5a,.35);
  const sun=new THREE.DirectionalLight(0xfff1d0,1);
  sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.left=-40;sun.shadow.camera.right=40;
  sun.shadow.camera.top=40;sun.shadow.camera.bottom=-40;
  sun.shadow.camera.far=120;
  sun.target.position.set(18,0,10.7);
  scene.add(amb,hemi,sun,sun.target);
  scene.userData.sun=sun;
  root=new THREE.Group();
  scene.add(root);
  renderer.domElement.className='view3d-canvas';
  renderer.domElement.setAttribute('aria-label','Трёхмерный вид участка');
 }
 if(renderer.domElement.parentElement!==host)host.appendChild(renderer.domElement);
 host.hidden=false;
 onResize();
 if(ro)ro.disconnect();
 ro=new ResizeObserver(onResize);ro.observe(host);
 if(!raf)frame();
 return {ok:true};
}

export function updateView3d(project,solar){
 if(!scene||!root)return;
 while(root.children.length){const c=root.children.pop();disposeObject(c);}
 root.add(buildSceneContent(project,solar));
 updateSunLight(scene.userData.sun,solar);
}

export function resetView3dCamera(){
 if(!camera||!controls)return;
 camera.position.set(42,28,48);
 controls.target.set(17,0,11);
 controls.update();
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
 renderer=null;scene=null;camera=null;controls=null;host=null;
}
