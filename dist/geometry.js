export const PLOT = [[0,0],[37,0],[33.65,15.4],[34,21.44],[0,21.44]];
export const FOREST_BEARING = 215;
export const SHED = {x:27,y:3.7,w:6,h:2.4,angle:0};
export const PARKING = {x:29.5,y:15.95,w:7,h:9.5,angle:0};
const slope = [37-33.65, -15.4];
const sl = Math.hypot(...slope);
export const GATE = {a:[33.65+slope[0]*5/sl,15.4+slope[1]*5/sl],b:[33.65,15.4]};
GATE.center = [(GATE.a[0]+GATE.b[0])/2,(GATE.a[1]+GATE.b[1])/2];
export const PRESETS = [
 {
  id:'forest',name:'У леса',x:9,y:9.5,angle:0,tag:'Кромка',color:'#6b8c73',
  description:'Дом у лесной границы (ЮЗ 215°): терраса смотрит в лес, от кромки ≈ 5 м. Это исходный эскиз ГП-01 — жить «у леса», а не посреди участка. Большой двор остаётся со стороны въезда и парковки.',
  tradeoff:'Выбирай, если важны вид, тень деревьев летом и ощущение кромки. Влияет: высота леса (тень на террасе вечером), буфер от границы, длинная дорожка от ворот (~29 м). Зимой низкое солнце частично перекрыто лесом с ЮЗ.'
 },
 {
  id:'south',name:'Терраса к югу',x:11.7,y:10.7,angle:-35,tag:'Солнце',color:'#b79660',
  description:'Дом развёрнут так, что терраса смотрит почти строго на юг (азимут фасада 180°). Лес остаётся рядом, но прямой дневной свет попадает на террасу и в кухню-гостиную дольше, чем при фасаде строго на ЮЗ.',
  tradeoff:'Выбирай, если свет важнее «параллельности» границам. Влияет: сезон (зимой юг критичен), соседство с лесом (тень с ЮЗ слабее бьёт в фасад), боковые отступы чуть жёстче из‑за поворота. Путь от въезда чуть длиннее.'
 },
 {
  id:'balance',name:'Двор перед террасой',x:16,y:10,angle:0,tag:'Двор',color:'#6c8c95',
  description:'Дом сдвинут к середине участка: перед террасой появляется открытая площадка (~12 м до леса), а не узкая полоса у кромки. Фасад по-прежнему к лесу (215°), но между домом и деревьями — место для стола, игр, газона.',
  tradeoff:'Выбирай, если нужен «воздух» у террасы, а не максимальная близость к лесу. Влияет: сценарии во дворе, тень леса (дальше — меньше вечерней тени), короткий путь от ворот (~23 м). Вид в лес сохраняется, но уже не вплотную.'
 },
 {
  id:'gate-near',name:'Ближе к въезду',x:18,y:11,angle:0,tag:'Въезд',color:'#8a7a5c',
  description:'Дом сдвинут к востоку, ближе к воротам и парковке. Дорожка короткая (~21 м), бытовка и машины рядом с домом. У лесной кромки остаётся свободный двор без застройки — лес как фон участка, а не «стена» у террасы.',
  tradeoff:'Выбирай, если важны логистика, короткие проходы с покупками и зимой по снегу. Влияет: удобство въезда, связь дом–парковка–бытовка, отступ от леса (~14 м). Терраса дальше от кромки: меньше «леса в окне», меньше тени от деревьев.'
 }
];
export const rad = n => n*Math.PI/180;
export const ANGLE_STEP = 45;
export const normAngle = a => ((a+180)%360+360)%360-180;
/** Поворот объектов: удобные углы 0 / ±45 / ±90 / … */
export const snapAngle = a => normAngle(Math.round(Number(a)/ANGLE_STEP)*ANGLE_STEP);
export const bearing = s => ((FOREST_BEARING+s.angle)%360+360)%360;
export const direction = a => ['С','СВ','В','ЮВ','Ю','ЮЗ','З','СЗ'][Math.round(a/45)%8];
export const dist = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
export function transform(p,s){const c=Math.cos(rad(s.angle)),sn=Math.sin(rad(s.angle));return [s.x+p[0]*c-p[1]*sn,s.y+p[0]*sn+p[1]*c];}
export function footprint(s,pad=0){return [[-4-pad,-5-pad],[4+pad,-5-pad],[4+pad,5+pad],[-4-pad,5+pad]].map(p=>transform(p,s));}
export function rectPolygon(r,pad=0){return [[-r.w/2-pad,-r.h/2-pad],[r.w/2+pad,-r.h/2-pad],[r.w/2+pad,r.h/2+pad],[-r.w/2-pad,r.h/2+pad]].map(p=>transform(p,r));}
export function pointSegment(p,a,b){const d=[b[0]-a[0],b[1]-a[1]],l=d[0]*d[0]+d[1]*d[1];const t=l?Math.max(0,Math.min(1,((p[0]-a[0])*d[0]+(p[1]-a[1])*d[1])/l)):0;const q=[a[0]+t*d[0],a[1]+t*d[1]];return {distance:dist(p,q),point:q};}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export function intersects(a,b,c,d){const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);return x*y< -1e-10&&z*w< -1e-10;}
export function pointInside(p,poly=PLOT){for(let i=0;i<poly.length;i++)if(pointSegment(p,poly[i],poly[(i+1)%poly.length]).distance<1e-7)return true;let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i][1]>p[1])!==(poly[j][1]>p[1])&&p[0]<(poly[j][0]-poly[i][0])*(p[1]-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])inside=!inside;return inside;}
export function segmentInside(a,b){if(!pointInside(a)||!pointInside(b))return false;for(let i=0;i<PLOT.length;i++)if(intersects(a,b,PLOT[i],PLOT[(i+1)%PLOT.length]))return false;return pointInside([(a[0]+b[0])/2,(a[1]+b[1])/2]);}
export function overlap(a,b){for(const poly of [a,b])for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],axis=[-(q[1]-p[1]),q[0]-p[0]];const pa=a.map(v=>v[0]*axis[0]+v[1]*axis[1]),pb=b.map(v=>v[0]*axis[0]+v[1]*axis[1]);if(Math.max(...pa)<=Math.min(...pb)+1e-7||Math.max(...pb)<=Math.min(...pa)+1e-7)return false;}return true;}
export function segmentRectInterior(a,b,r){const inverse=p=>{const dx=p[0]-r.x,dy=p[1]-r.y,c=Math.cos(rad(-r.angle)),s=Math.sin(rad(-r.angle));return [dx*c-dy*s,dx*s+dy*c];};const p=inverse(a),q=inverse(b),half=[r.w/2-1e-6,r.h/2-1e-6];let lo=0,hi=1;for(let k=0;k<2;k++){const d=q[k]-p[k];if(Math.abs(d)<1e-10){if(p[k]<=-half[k]||p[k]>=half[k])return false;}else{let t1=(-half[k]-p[k])/d,t2=(half[k]-p[k])/d;if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>=hi)return false;}}return hi>0&&lo<1&&lo<hi;}
function inflateRect(r,pad){return {...r,w:r.w+pad*2,h:r.h+pad*2};}
function obstacleNodes(r){
 const c=rectPolygon(r);return [...c,...c.map((p,i)=>{const q=c[(i+1)%c.length];return [(p[0]+q[0])/2,(p[1]+q[1])/2];})];
}
function clearOfBlocks(a,b,blocks){return !blocks.some(r=>segmentRectInterior(a,b,r));}
function pointClear(p,blocks){return clearOfBlocks(p,p,blocks);}
/** Автодорожка: въезд → обход дома и бытовки → подход к входу. Парковку пересекать можно (зона прохода). */
export function walkingRoute(s,shed=SHED,padding=.7,_parking=PARKING){
 const door=transform([-1.05,-5],s),start=[GATE.center[0]-0.5,GATE.center[1]];
 const blocks=[inflateRect({x:s.x,y:s.y,w:8,h:10,angle:s.angle},padding),inflateRect(shed,padding)];
 if(!pointClear(start,blocks))return null;
 const approaches=[[-1.05,-5-padding-.45],[-2.4,-5-padding-.3],[.3,-5-padding-.3],[-1.05,-5-padding-.95],[-3.3,-5-padding-.15],[1.2,-5-padding-.15]]
  .map(p=>transform(p,s)).filter(p=>pointInside(p)&&pointClear(p,blocks));
 if(!approaches.length)return null;
 const waypoints=blocks.flatMap(obstacleNodes).filter(p=>pointInside(p)&&pointClear(p,blocks));
 const nodes=[start,...approaches,...waypoints];
 const goalCount=approaches.length,n=nodes.length;
 const ds=Array(n).fill(Infinity),prev=Array(n).fill(-1),used=Array(n).fill(false);ds[0]=0;
 for(let k=0;k<n;k++){
  let u=-1;for(let i=0;i<n;i++)if(!used[i]&&(u<0||ds[i]<ds[u]))u=i;
  if(u<0||ds[u]===Infinity)break;used[u]=true;
  for(let v=0;v<n;v++)if(!used[v]&&segmentInside(nodes[u],nodes[v])&&clearOfBlocks(nodes[u],nodes[v],blocks)){
   const next=ds[u]+dist(nodes[u],nodes[v]);if(next<ds[v]){ds[v]=next;prev[v]=u;}
  }
 }
 let best=-1;for(let g=1;g<=goalCount;g++)if(Number.isFinite(ds[g])&&(best<0||ds[g]<ds[best]))best=g;
 if(best<0)return null;
 const path=[];for(let v=best;v>=0;v=prev[v])path.unshift(nodes[v]);
 for(let i=1;i<path.length-1;){
  const a=path[i-1],b=path[i],c=path[i+1];
  if(dist(a,b)+dist(b,c)-dist(a,c)<1e-3&&segmentInside(a,c)&&clearOfBlocks(a,c,blocks))path.splice(i,1);else i++;
 }
 path.unshift(GATE.center);path.push(door);
 return {points:path,length:ds[best]+dist(GATE.center,start)+dist(nodes[best],door),door};
}
export function metrics(s,buffer=3,objects={shed:SHED,parking:PARKING,pathWidth:.6}){
 const poly=footprint(s);const inside=poly.every(p=>pointInside(p))&&poly.every((p,i)=>segmentInside(p,poly[(i+1)%4]));
 const edgeDistances=PLOT.map((a,i)=>{const b=PLOT[(i+1)%PLOT.length];if(poly.some((p,j)=>intersects(p,poly[(j+1)%4],a,b)))return 0;return Math.min(...poly.map(p=>pointSegment(p,a,b).distance),...poly.map((p,j)=>pointSegment(a,p,poly[(j+1)%4]).distance),...poly.map((p,j)=>pointSegment(b,p,poly[(j+1)%4]).distance));});
 const min=inside?Math.min(...edgeDistances):0;const collisions=[];if(overlap(poly,rectPolygon(objects.shed)))collisions.push('бытовкой');if(overlap(poly,rectPolygon(objects.parking)))collisions.push('зоной парковки');
 const warnings=[];if(!inside)warnings.push('Дом или терраса выходит за границу участка.');if(inside&&min<buffer-0.01)warnings.push(`Пятно дома заходит в выбранный буфер ${buffer} м.`);if(collisions.length)warnings.push(`Есть пересечение с ${collisions.join(' и ')}.`);
 const route=inside&&!collisions.length?walkingRoute(s,objects.shed,objects.pathWidth/2+.5,objects.parking):null;
 return {inside,min,forest:edgeDistances[4],road:Math.min(edgeDistances[1],edgeDistances[2]),bearing:bearing(s),route,collisions,warnings,area:80};
}
export function inwardBuffer(d){if(d===0)return PLOT;const lines=PLOT.map((p,i)=>{const q=PLOT[(i+1)%PLOT.length],dx=q[0]-p[0],dy=q[1]-p[1],l=Math.hypot(dx,dy);return {p:[p[0]-dy*d/l,p[1]+dx*d/l],v:[dx,dy]};});return lines.map((line,i)=>{const a=lines[(i+lines.length-1)%lines.length],b=line,den=a.v[0]*b.v[1]-a.v[1]*b.v[0];const delta=[b.p[0]-a.p[0],b.p[1]-a.p[1]],t=(delta[0]*b.v[1]-delta[1]*b.v[0])/den;return [a.p[0]+t*a.v[0],a.p[1]+t*a.v[1]];});}
export function validState(s){return s&&Number.isFinite(s.x)&&s.x>=-10&&s.x<=47&&Number.isFinite(s.y)&&s.y>=-10&&s.y<=32&&Number.isFinite(s.angle)&&s.angle>=-180&&s.angle<=180;}

export function defaultProject(house=PRESETS[0]){return {house:{x:house.x,y:house.y,angle:house.angle,height:2.7},shed:{...SHED,height:2.5},parking:{...PARKING},path:{mode:'auto',points:[],width:1.4,material:'gravel',visible:true}};}
export function normalizeProject(value){
 const p=defaultProject();if(!value||typeof value!=='object')return p;
 for(const key of ['house','shed','parking']){const v=value[key];if(v&&validState(v)){p[key].x=v.x;p[key].y=v.y;p[key].angle=normAngle(v.angle);if(key!=='house')for(const d of ['w','h'])if(Number.isFinite(v[d])&&v[d]>=2&&v[d]<=15)p[key][d]=v[d];if(Number.isFinite(v.height)&&v.height>=1&&v.height<=12)p[key].height=v.height;}}
 if(value.path){const v=value.path;if(Number.isFinite(v.width)&&v.width>=.6&&v.width<=4)p.path.width=v.width;if(['gravel','pavers','wood'].includes(v.material))p.path.material=v.material;if(typeof v.visible==='boolean')p.path.visible=v.visible;if(v.mode==='manual'&&Array.isArray(v.points)&&v.points.length>=2&&v.points.length<=60&&v.points.every(a=>Array.isArray(a)&&a.length===2&&a.every(Number.isFinite)&&a[0]>=-10&&a[0]<=47&&a[1]>=-10&&a[1]<=32)){p.path.mode='manual';p.path.points=v.points.map(a=>[...a]);}}
 return p;
}
export function validProject(p){return !!p&&['house','shed','parking'].every(k=>validState(p[k]))&&p.path&&Number.isFinite(p.path.width)&&p.path.width>=.6&&p.path.width<=4&&['auto','manual'].includes(p.path.mode)&&Array.isArray(p.path.points)&&p.path.points.length<=60&&(p.path.mode!=='manual'||p.path.points.length>=2)&&p.path.points.every(a=>Array.isArray(a)&&a.length===2&&a.every(Number.isFinite)&&a[0]>=-10&&a[0]<=47&&a[1]>=-10&&a[1]<=32)&&['shed','parking'].every(k=>['w','h'].every(d=>Number.isFinite(p[k][d])&&p[k][d]>=2&&p[k][d]<=15));}
export function pathPoints(p){if(p.path.mode==='manual')return p.path.points;const r=walkingRoute(p.house,p.shed,p.path.width/2+.5,p.parking);return r?r.points.slice(0,-1):[];}
export function polylineLength(points){return points.slice(1).reduce((a,p,i)=>a+dist(points[i],p),0);}
export function polygonInside(poly){return poly.every(p=>pointInside(p))&&poly.every((p,i)=>segmentInside(p,poly[(i+1)%poly.length]));}
export function polygonArea(poly){let a=0;for(let i=0;i<poly.length;i++){const j=(i+1)%poly.length;a+=poly[i][0]*poly[j][1]-poly[j][0]*poly[i][1];}return Math.abs(a)/2;}
export function polygonCentroid(poly){let x=0,y=0;for(const p of poly){x+=p[0];y+=p[1];}return [x/poly.length,y/poly.length];}
export function forestEdgeStrip(depth=4){return [[0,0],[depth,0],[depth,21.44],[0,21.44]];}
export function gateZone(depth=4){
 const dx=GATE.b[0]-GATE.a[0],dy=GATE.b[1]-GATE.a[1],l=Math.hypot(dx,dy)||1;let nx=-dy/l,ny=dx/l;
 const mid=[GATE.center[0]+nx*depth/2,GATE.center[1]+ny*depth/2];
 if(!pointInside(mid)){nx=-nx;ny=-ny;}
 return [GATE.a,GATE.b,[GATE.b[0]+nx*depth,GATE.b[1]+ny*depth],[GATE.a[0]+nx*depth,GATE.a[1]+ny*depth]];
}
export function functionalZones(p,buffer=3){
 const plotArea=750,house=footprint(p.house),shed=rectPolygon(p.shed),parking=rectPolygon(p.parking);
 const solid=80+p.shed.w*p.shed.h+p.parking.w*p.parking.h,yard=Math.max(0,plotArea-solid);
 const forest=forestEdgeStrip(4),gate=gateZone(4),inner=inwardBuffer(buffer);
 const zone=(id,name,points,area,fill,stroke,label)=>({id,name,points,area,fill,stroke,label:label||(points?polygonCentroid(points):[17,12])});
 return [
  zone('plot','Участок',PLOT,plotArea,'#dfe8cd55','#476c4e',[18.5,10.7]),
  zone('forest','Лесная кромка',forest,polygonArea(forest),'#6d8a6240','#5a734f',[2,10.7]),
  zone('buffer','Буфер',inner,polygonArea(inner),'none','#8fa97a',polygonCentroid(inner)),
  zone('gate','Въезд',gate,polygonArea(gate),'#c9a46a33','#b28652',polygonCentroid(gate)),
  zone('house','Дом',house,80,'#64837533','#355c46',polygonCentroid(house)),
  zone('shed','Бытовка',shed,p.shed.w*p.shed.h,'#afc0a140','#739372',polygonCentroid(shed)),
  zone('parking','Парковка',parking,p.parking.w*p.parking.h,'#c4c0a840','#8a8a6e',polygonCentroid(parking)),
  zone('yard','Открытый двор',null,yard,'#99ae8522','#99ae85',[p.house.x<15?22:10,16.5])
 ];
}
export function sceneMetrics(p,buffer=3){
 const data=metrics(p.house,buffer,{shed:p.shed,parking:p.parking,pathWidth:p.path.width}),footprints={house:footprint(p.house),shed:rectPolygon(p.shed),parking:rectPolygon(p.parking)},names={house:'Дом',shed:'Бытовка',parking:'Парковка'},warnings=[];
 for(const k of Object.keys(footprints))if(!polygonInside(footprints[k]))warnings.push(names[k]+' выходит за границу участка.');
 for(const [a,b] of [['house','shed'],['house','parking'],['shed','parking']])if(overlap(footprints[a],footprints[b]))warnings.push(names[a]+' пересекается с '+({shed:'бытовкой',parking:'парковкой'})[b]+'.');
 if(data.inside&&data.min<buffer-.01)warnings.push('Дом заходит в выбранный буфер '+buffer+' м.');
 const points=pathPoints(p),length=polylineLength(points),radius=p.path.width/2;
 if(p.path.visible){
  if(points.length<2)warnings.push('Для этих положений не удалось построить автодорожку. Проложи её вручную.');
  let outside=false,blocked=false;
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],l=dist(a,b);if(l<.001)continue;const nx=-(b[1]-a[1])/l*radius,ny=(b[0]-a[0])/l*radius;
   const strip=[[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]];
   for(let j=0;j<=8;j++){const t=j/8,q=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];for(const side of [-1,1]){const v=[q[0]+nx*side,q[1]+ny*side];if(!pointInside(v)&&pointSegment(v,GATE.a,GATE.b).distance>radius+.15)outside=true;}}
   if(overlap(strip,footprints.house)||overlap(strip,footprints.shed))blocked=true;
  }
  if(outside)warnings.push('Дорожка с учётом ширины выходит за границу участка.');if(blocked)warnings.push('Дорожка пересекает дом, террасу или бытовку.');
 }
 const zones=functionalZones(p,buffer),plotArea=750,solidArea=80+p.shed.w*p.shed.h+p.parking.w*p.parking.h;
 const zoneAreas=Object.fromEntries(zones.map(z=>[z.id,z.area]));
 return {...data,warnings,footprints,path:{points,length,area:length*p.path.width},solidArea,plotArea,zones,zoneAreas};
}
export function convexHull(points){const sorted=points.map(p=>[...p]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const half=list=>{const h=[];for(const p of list){while(h.length>=2&&cross(h[h.length-2],h[h.length-1],p)<=0)h.pop();h.push(p);}return h;};const a=half(sorted),b=half(sorted.slice().reverse());a.pop();b.pop();return a.concat(b);}
