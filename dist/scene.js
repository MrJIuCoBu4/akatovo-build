import {PLOT,GATE,ROAD,rad,transform,footprint,rectPolygon,inwardBuffer,sceneMetrics,functionalZones,PRESETS,direction} from './geometry.js?v=40';
import {shadowScene,sunVector,timeLabel} from './solar.js?v=15';
const fmt=(n,d=1)=>Number.isFinite(n)?n.toFixed(d).replace('.',','):'—';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const coords=p=>p.map(v=>v.map(n=>n.toFixed(4)).join(',')).join(' ');
function treesSvg(){let str='';for(let i=0;i<22;i++){const y=-1.6+i*1.14,x=-1.35-((i*7)%3)*.52,r=.63+((i*13)%7)*.05;str+=`<g><circle cx="${x}" cy="${y}" r="${r}" fill="${['#bdcdaa','#acbe96','#c4d3b2'][i%3]}" stroke="#a3b98a" stroke-width=".018"/><circle cx="${x-.14}" cy="${y-.08}" r="${r*.62}" fill="#d1ddc0" opacity=".56"/><path d="M${x-.15} ${y}h.3M${x} ${y-.15}v.3" stroke="#81996c" stroke-width=".022"/></g>`;}return str;}
function dimension(a,b,label,offset=0){const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy),nx=-dy/l*offset,ny=dx/l*offset,pa=[a[0]+nx,a[1]+ny],pb=[b[0]+nx,b[1]+ny],mid=[(pa[0]+pb[0])/2,(pa[1]+pb[1])/2];return `<g fill="none" stroke="#95a78b" stroke-width=".025"><line x1="${pa[0]}" y1="${pa[1]}" x2="${pb[0]}" y2="${pb[1]}"/><path d="M${pa[0]-.12} ${pa[1]+.15}l.24-.3M${pb[0]-.12} ${pb[1]+.15}l.24-.3"/></g><text x="${mid[0]}" y="${mid[1]-.18}" text-anchor="middle" font-size=".37" fill="#758e69" style="paint-order:stroke;stroke:#edf1e4;stroke-width:.12">${esc(label)}</text>`;}
/** Планировка Модерн 80 в локальных метрах дома: терраса −X, вход у y=−5. */
function modern80FloorPlan(){
 const room=(x,y,w,h,fill)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
 const label=(x,y,t,s=.28)=>`<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="${s}" fill="#4a5f4c" letter-spacing=".02">${t}</text>`;
 const wall=`stroke="#2f4738" stroke-width=".09" stroke-linecap="square" fill="none"`;
 return `<g class="floor-plan" pointer-events="none" aria-label="Планировка Модерн 80">
  <clipPath id="house-floor-clip"><rect x="-4" y="-5" width="8" height="10"/></clipPath>
  <g clip-path="url(#house-floor-clip)">
   ${room(-4,-5,2,10,'#c9a879')}${room(-2,-5,6,10,'#eef1e8')}
   ${room(2,-5,2,2.5,'#e4ebe3')}${room(0,-5,2,2.5,'#e8ebe4')}${room(-2,-5,2,2.5,'#ebe8e0')}
   ${room(-2,-2.5,6,5,'#f3f5ee')}
   ${room(1,2.5,3,2.5,'#e7ebe4')}${room(-2,2.5,3,2.5,'#e7ebe4')}
   <g fill="#ddd4bf" stroke="#9a8b6a" stroke-width=".02">
    <rect x="2.25" y="-4.7" width="1.5" height=".55" rx=".04"/><rect x="2.2" y="-3.95" width=".35" height=".55" rx=".03"/>
    <rect x=".25" y="-4.65" width=".7" height=".7" rx=".04"/><circle cx="1.35" cy="-4.3" r=".22" fill="none"/>
    <rect x="-1.75" y="-4.55" width="1.35" height=".35" rx=".03"/>
    <rect x="-1.7" y="-1.9" width="1.1" height="3.6" rx=".05"/><rect x="1.1" y="-.55" width="2.2" height=".9" rx=".06"/>
    <rect x="2.55" y="-2.1" width=".9" height="1.7" rx=".05"/><circle cx="3.35" cy="-1.25" r=".18" fill="none"/>
    <rect x="1.45" y="2.85" width="2.15" height="1.15" rx=".06"/><rect x="1.55" y="4.15" width=".85" height=".45" rx=".03"/>
    <rect x="-1.55" y="2.85" width="2.15" height="1.15" rx=".06"/><rect x="-.35" y="4.15" width=".85" height=".45" rx=".03"/>
    <rect x="-3.75" y="-1.2" width="1.5" height="1.8" rx=".05" fill="#d4b48a" stroke="#a88858"/>
   </g>
   <g ${wall}>
    <rect x="-2" y="-5" width="6" height="10"/>
    <path d="M-2-2.5H4M1 2.5V5M-2 2.5H1"/>
    <path d="M2-5V-2.5M0-5V-2.5"/>
    <path d="M-4-5H-2V5H-4Z" stroke="#8f7048" stroke-width=".06"/>
   </g>
   <g fill="none" stroke="#2f4738" stroke-width=".05">
    <path d="M-1.55-5A.55.55 0 0 0-1-4.45"/><path d="M-2-.4H-4" stroke-dasharray=".12 .1"/>
    <path d="M2.35-2.5A.55.55 0 0 1 2.9-1.95"/><path d="M.35-2.5A.55.55 0 0 1 .9-1.95"/>
    <path d="M-1.65-2.5A.55.55 0 0 0-1.1-1.95"/><path d="M1.55 2.5A.55.55 0 0 0 2.1 3.05"/>
    <path d="M-.45 2.5A.55.55 0 0 1 .1 3.05"/>
   </g>
   ${label(3,-3.75,'С/У',.26)}${label(1,-3.75,'Техзона',.24)}${label(-1,-3.75,'Прихожая',.24)}
   ${label(1,0,'Кухня-гостиная',.32)}${label(1,.55,'30 м²',.22)}
   ${label(2.5,3.55,'Спальня 1',.24)}${label(-.5,3.55,'Спальня 2',.24)}
   ${label(-3,0,'Терраса',.3)}${label(-3,.5,'20 м²',.22)}
  </g>
 </g>`;
}
function houseSvg(s,{interactive=false,selected=false,ghost=false,color='#648375',floor=false,bad=false,prefix='main'}={}){
 const stroke=bad?'#ba7852':'#355c46',furniture=`<g fill="#eee8d4" stroke="#8f815f" stroke-width=".025"><rect x="-3.72" y="-3.75" width=".54" height="1.48" rx=".06"/><rect x="-2.94" y="-3.75" width=".54" height="1.48" rx=".06"/><circle cx="-3.04" cy="-1.55" r=".22"/><rect x="-3.72" y="2.1" width=".54" height="1.48" rx=".06"/><rect x="-2.94" y="2.1" width=".54" height="1.48" rx=".06"/><circle cx="-3.04" cy="1.45" r=".22"/></g>`;
 const floorPlan=floor?modern80FloorPlan().replaceAll('house-floor-clip',`${prefix}-house-floor-clip`):`<g stroke="#8ba595" stroke-width=".025" opacity=".65">${Array.from({length:14},(_,i)=>`<line x1="-1.77" y1="${-4.7+i*.71}" x2="3.77" y2="${-4.7+i*.71}"/>`).join('')}<line x1="1" y1="-4.8" x2="1" y2="4.8" stroke="#a8b9a9" stroke-width=".065"/></g>`;
 let result=`<g ${interactive?'id="house" data-object="house" tabindex="0" role="button" aria-label="Дом. Стрелки сдвигают на 25 см, Shift со стрелкой — на метр. R поворачивает на 45 градусов."':''} transform="translate(${s.x} ${s.y}) rotate(${s.angle})" ${ghost?`opacity=".3" pointer-events="none"`:''}>`;
 if(ghost)return result+`<rect x="-4" y="-5" width="8" height="10" fill="${color}" fill-opacity=".15" stroke="${color}" stroke-width=".1" stroke-dasharray=".25 .15"/><line x1="-4" y1="-5" x2="-4" y2="5" stroke="${color}" stroke-width=".22"/></g>`;
 result+=`<rect x="-3.78" y="-4.76" width="8.14" height="10.14" rx=".05" fill="#536944" opacity=".17" pointer-events="none"/>`;
 if(floor)result+=`<rect x="-4" y="-5" width="8" height="10" fill="#e8ecdf" stroke="${stroke}" stroke-width=".10" pointer-events="none"/>${floorPlan}`;
 else result+=`<rect x="-4" y="-5" width="2" height="10" fill="url(#deck)" stroke="#a28359" stroke-width=".04" pointer-events="none"/><rect x="-2" y="-5" width="6" height="10" fill="${color}" stroke="${stroke}" stroke-width=".10" pointer-events="none"/>${furniture}${floorPlan}`;
 result+=`<path d="M-1.7-5h1.3" stroke="#ecd6a9" stroke-width=".15"/><path d="M-1.05-5.18v-.35m-.14.16.14-.16.14.16" fill="none" stroke="#a17c4f" stroke-width=".045"/>`;
 if(interactive)result+=`<rect id="house-hit" x="-4" y="-5" width="8" height="10" fill="transparent" style="cursor:grab"/>`;
 if(interactive&&selected)result+=`<rect x="-4.16" y="-5.16" width="8.32" height="10.32" fill="none" stroke="${stroke}" stroke-width=".03" stroke-dasharray=".22 .15" pointer-events="none"/>${[[-4,-5],[4,-5],[4,5],[-4,5]].map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r=".10" fill="#fafaf0" stroke="${stroke}" stroke-width=".04" pointer-events="none"/>`).join('')}<line x1="0" y1="-5.16" x2="0" y2="-6.7" stroke="#a6824d" stroke-width=".035" pointer-events="none"/><g id="rotate-handle" role="button" aria-label="Повернуть дом" style="cursor:crosshair"><circle cx="0" cy="-6.8" r=".53" fill="#e8d6ac" stroke="#a8844b" stroke-width=".04"/><path d="M-.22-6.73a.25.25 0 1 1 .43-.17l-.12-.03m.12.03.05-.12" fill="none" stroke="#7a663e" stroke-width=".04"/><circle cx="0" cy="-6.8" r=".65" fill="transparent"/></g>`;
 result+='</g>';
 if(!floor)result+=`<g pointer-events="none" text-anchor="middle" fill="#f0f2e7"><text x="${s.x+Math.cos(rad(s.angle))}" y="${s.y-.12}" font-size=".42" letter-spacing=".03">МОДЕРН 80</text><text x="${s.x+Math.cos(rad(s.angle))}" y="${s.y+.49}" font-size=".3" opacity=".8">10 × 6 м</text></g>`;
 return result;
}
function handles(o,key){return `<g pointer-events="none"><rect x="${-o.w/2-.12}" y="${-o.h/2-.12}" width="${o.w+.24}" height="${o.h+.24}" fill="none" stroke="#a77f40" stroke-width=".045" stroke-dasharray=".20 .12"/>${rectPolygon({x:0,y:0,w:o.w,h:o.h,angle:0}).map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r=".11" fill="#fff9e9" stroke="#a77f40" stroke-width=".035"/>`).join('')}<line x1="0" y1="${-o.h/2-.12}" x2="0" y2="${-o.h/2-1.4}" stroke="#a77f40" stroke-width=".04"/></g><g data-rotation="${key}" style="cursor:crosshair"><circle cx="0" cy="${-o.h/2-1.45}" r=".43" fill="#e8d6ac" stroke="#a8844b" stroke-width=".04"/><text x="0" y="${-o.h/2-1.3}" text-anchor="middle" font-size=".44" fill="#856c42" pointer-events="none">↻</text><circle cx="0" cy="${-o.h/2-1.45}" r=".7" fill="transparent"/></g>`;}
function objectSvg(o,key,interactive,selected,bad){
 const w=o.w,h=o.h,stroke=bad?'#bd7249':'#739372';let inside='';
 if(key==='shed'){
  inside=`<rect x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" fill="#e6dac4" stroke="${stroke}" stroke-width=".05"/>
   <line x1="${-w/2+.12}" y1="0" x2="${w/2-.12}" y2="0" stroke="#474a51" stroke-width=".1"/>`;
 }else if(key==='driveway'){
  inside=`<rect x="${-w/2+.08}" y="${-h/2+.08}" width="${w-.16}" height="${h-.16}" fill="none" stroke="#a89872" stroke-width=".04" stroke-dasharray=".2 .14" rx=".12"/>`;
 }else{const bw=Math.min(2.4,w*.42),bh=Math.min(5.2,h*.7),by=-bh/2+h*.06;inside=`<path d="M0 ${-h/2+.2}V${h/2-.2}" stroke="#bbb5a0" stroke-width=".03" stroke-dasharray=".18 .14"/>${[-1,1].map(v=>`<rect x="${v*w/4-bw/2}" y="${by}" width="${bw}" height="${bh}" fill="none" stroke="#9aa08c" stroke-width=".04" stroke-dasharray=".22 .16" rx=".08"/>`).join('')}`;}
 const title=key==='shed'?'БЫТОВКА':key==='driveway'?'ВЪЕЗД':'ПАРКОВКА';
 const sub=key==='shed'?' · барн':key==='driveway'?' · гравий':' · 2 места';
 const label=key==='shed'?'Бытовка':key==='driveway'?'Въезд':'Парковка';
 const fillC=key==='shed'?'#5a4a32':key==='driveway'?'#7a6a48':'#7d7d60';
 return `<g ${interactive?`id="${key}" data-object="${key}" tabindex="0" role="button" aria-label="${label}, можно двигать и поворачивать"`:''} transform="translate(${o.x} ${o.y}) rotate(${o.angle})"><rect x="${-w/2+.12}" y="${-h/2+.16}" width="${w}" height="${h}" fill="#526348" opacity=".10" pointer-events="none"/>${key==='shed'?'':`<rect x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" fill="url(#paving)" stroke="${stroke}" stroke-width=".055" rx="${key==='driveway'?'.2':'0'}"/>`}${inside}${interactive?`<rect x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" fill="transparent" style="cursor:grab"/>`:''}${interactive&&selected?handles(o,key):''}</g><g pointer-events="none" text-anchor="middle" fill="${fillC}"><text x="${o.x}" y="${o.y+(key==='shed'?-.06:-h*.32)}" font-size=".36" letter-spacing=".03">${title}</text><text x="${o.x}" y="${o.y+(key==='shed'?.48:-h*.32+.52)}" font-size=".29">${fmt(w)} × ${fmt(h)} м${sub}</text></g>`;
}
function pathSvg(points,path,editable,selected,selectedPoint,draft=false){
 if(points.length<2)return points.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r=".18" fill="#c49755"/>`).join('');
 const color={gravel:'#c7b797',pavers:'#bebcad',wood:'#bb9772'}[path.material];
 let str=`<g ${editable&&!draft?'data-object="path" id="path" tabindex="0" role="button" aria-label="Дорожка, можно редактировать узлы"':''}><polyline points="${coords(points)}" stroke="${color}" stroke-width="${path.width}" stroke-linejoin="miter" stroke-miterlimit="3" stroke-linecap="butt" fill="none" opacity="${draft?.65:1}"/><polyline points="${coords(points)}" stroke="${selected?'#9f7b43':'#a19377'}" stroke-width=".035" stroke-dasharray="${path.material==='pavers'?'.06 .35':'.17 .17'}" fill="none"/>${editable&&!draft?`<polyline points="${coords(points)}" fill="none" stroke="transparent" stroke-width="${Math.max(1.1,path.width)}" style="cursor:${selected?'move':'pointer'}"/>`:''}</g>`;
 return str;
}
/** Узлы, крестики удаления и «+» на отрезках — рисуются поверх всех объектов, чтобы их не перекрывали хит‑зоны парковки и дома. */
function pathHandlesSvg(points,selectedPoint){
 if(points.length<2)return '';
 // «+» на отрезках — под узлами и только на отрезках длиннее 1,6 м, чтобы не перекрывать соседние узлы
 let str=points.slice(1).map((p,i)=>{const a=points[i];if(Math.hypot(p[0]-a[0],p[1]-a[1])<1.6)return '';const x=(a[0]+p[0])/2,y=(a[1]+p[1])/2;return `<g data-insert="${i}" style="cursor:copy"><circle cx="${x}" cy="${y}" r=".30" fill="#fff9e8" stroke="#ab956d" stroke-width=".03"/><path d="M${x-.13} ${y}h.26M${x} ${y-.13}v.26" stroke="#a2814c" stroke-width=".035"/><circle cx="${x}" cy="${y}" r=".55" fill="transparent"/></g>`;}).join('');
 // узлы; выбранный — последним, чтобы его крестик был поверх соседей
 const order=points.map((_,i)=>i).sort((a,b)=>(a===selectedPoint)-(b===selectedPoint));
 str+=order.map(i=>{const p=points[i],on=i===selectedPoint;let g=`<g data-node="${i}" role="button" aria-label="Узел дорожки ${i+1}${on?', выбран':''}" style="cursor:grab"><circle cx="${p[0]}" cy="${p[1]}" r="${on?0.34:0.24}" fill="${on?'#c69a55':'#fff9e8'}" stroke="#a2814c" stroke-width=".06"/><circle cx="${p[0]}" cy="${p[1]}" r=".5" fill="transparent"/>`;if(on&&points.length>2)g+=`<g data-delete-node="${i}" role="button" aria-label="Удалить узел ${i+1}" style="cursor:pointer"><title>Удалить точку</title><circle cx="${p[0]+.55}" cy="${p[1]-.55}" r=".32" fill="#f3e2c8" stroke="#a2814c" stroke-width=".05"/><path d="M${p[0]+.42} ${p[1]-.68}l.26.26m0-.26-.26.26" stroke="#8a6840" stroke-width=".06" stroke-linecap="round"/><circle cx="${p[0]+.55}" cy="${p[1]-.55}" r=".45" fill="transparent"/></g>`;return g+'</g>';}).join('');
 return str;
}
function solarSvg(project,solar){const {sun}=shadowScene(project,solar);if(!sun.daylight)return '';const v=sunVector(sun.azimuth),h=project.house,c=[h.x,h.y],limit=Math.min(v[0]>0?(41-c[0])/v[0]:(-4.5-c[0])/v[0],v[1]>0?(23-c[1])/v[1]:(-3.6-c[1])/v[1],14);const d=Math.max(6,limit-1),start=[c[0]+v[0]*d,c[1]+v[1]*d],end=[c[0]+v[0]*5.9,c[1]+v[1]*5.9];return `<g pointer-events="none"><line x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}" stroke="#e1b964" stroke-width=".75" opacity=".19"/><line x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}" stroke="#bc8b36" stroke-width=".09" marker-end="url(#sun-arrow)" stroke-dasharray=".22 .12"/><circle cx="${start[0]}" cy="${start[1]}" r=".68" fill="#fae7b7" stroke="#b58b46" stroke-width=".035"/><circle cx="${start[0]}" cy="${start[1]}" r=".25" fill="#d5a54b"/>${Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return `<line x1="${start[0]+Math.cos(a)*.36}" y1="${start[1]+Math.sin(a)*.36}" x2="${start[0]+Math.cos(a)*.48}" y2="${start[1]+Math.sin(a)*.48}" stroke="#bd9042" stroke-width=".025"/>`;}).join('')}<text x="${start[0]}" y="${start[1]+1.08}" text-anchor="middle" font-size=".40" fill="#986a2d" style="paint-order:stroke;stroke:#f1ecd9;stroke-width:.12">${timeLabel(solar.minutes)} · ${direction(sun.azimuth)}</text></g>`;}
export function planMarkup(project,{selected='house',options={},solar={},drawing=false,draft=[],selectedPoint=-1,mini=false,interactive=true,prefix='main'}={}){
 const m=sceneMetrics(project,options.width??3),house=project.house,showSun=solar.show&&!mini,night=showSun&&!shadowScene(project,solar).sun.daylight;
 let str=`<defs><pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="#c6d4b5" stroke-width=".013" opacity=".3"/></pattern><pattern id="deck" width=".24" height=".24" patternUnits="userSpaceOnUse"><rect width=".24" height=".24" fill="#c4a67c"/><line x1="0" y1=".24" x2=".24" y2=".24" stroke="#af8e61" stroke-width=".018"/></pattern><pattern id="paving" width=".8" height=".8" patternUnits="userSpaceOnUse"><rect width=".8" height=".8" fill="#d7d4bf"/><path d="M.8 0H0V.8" stroke="#c9c6b0" stroke-width=".025" fill="none"/></pattern><clipPath id="plot-clip"><polygon points="${coords(PLOT)}"/></clipPath><marker id="sun-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 10 5 0 10Z" fill="#bc8b36"/></marker><mask id="shadow-mask"><rect x="-7" y="-6" width="53" height="34" fill="white"/><polygon points="${coords(rectPolygon({...house,x:transform([1,0],house)[0],y:transform([1,0],house)[1],w:6,h:10}))}" fill="black"/><polygon points="${coords(rectPolygon(project.shed))}" fill="black"/></mask></defs>`;
 str+=`<rect x="-7" y="-6" width="53" height="34" fill="#eff2e8"/><polygon points="${coords([...ROAD.inner,...[...ROAD.outer].reverse()])}" fill="#d6d8cd"/><polyline points="${coords(ROAD.center)}" fill="none" stroke="#e8e9e1" stroke-width=".06" stroke-dasharray=".4 .45"/>${(()=>{const [a,b]=ROAD.center,x=(a[0]+b[0])/2,y=(a[1]+b[1])/2,ang=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI-180;return `<text x="${x}" y="${y}" transform="rotate(${ang.toFixed(1)} ${x} ${y})" text-anchor="middle" dominant-baseline="middle" font-size=".40" letter-spacing=".10" fill="#8c9784">ПОДЪЕЗДНАЯ ДОРОГА</text>`;})()}`;
 str+=`<polygon points="${coords(PLOT)}" fill="#e0e8cf" stroke="#476c4e" stroke-width=".075"/><polygon points="${coords(PLOT)}" fill="url(#grid)"/>${treesSvg()}<text x="-4.1" y="10.5" text-anchor="middle" transform="rotate(-90 -4.1 10.5)" fill="#638158" font-size=".39" letter-spacing=".10">ЛЕС · ЮГО-ЗАПАД · 215°</text>`;
 if(options.zones&&!mini){const zones=functionalZones(project,options.width??3);str+=`<g class="zone-layer" pointer-events="none" clip-path="url(#plot-clip)">`;for(const z of zones){if(z.id==='plot'||z.id==='house'||z.id==='shed'||z.id==='parking')continue;if(z.points)str+=`<polygon points="${coords(z.points)}" fill="${z.fill}" stroke="${z.stroke}" stroke-width="${z.id==='buffer'?'.035':'.04'}" stroke-dasharray="${z.id==='buffer'?'.27 .20':'none'}"/>`;if(z.id==='yard'||z.id==='forest'||z.id==='gate')str+=`<text x="${z.label[0]}" y="${z.label[1]}" text-anchor="middle" fill="${z.stroke}" font-size=".36" letter-spacing=".08" opacity=".85">${esc(z.name.toUpperCase())}</text>`;}str+='</g>';}
 else if(options.buffer)str+=`<polygon points="${coords(inwardBuffer(options.width??3))}" fill="none" stroke="#8fa97a" stroke-width=".035" stroke-dasharray=".27 .20"/>`;
 if(options.buffer&&options.zones&&!mini)str+=`<polygon points="${coords(inwardBuffer(options.width??3))}" fill="none" stroke="#8fa97a" stroke-width=".035" stroke-dasharray=".27 .20" pointer-events="none"/>`;
 if(project.path.visible)str+=pathSvg(m.path.points,project.path,interactive&&!mini,selected==='path',selectedPoint);
 if(drawing)str+=pathSvg(draft,project.path,false,false,-1,true);
 if(options.ghosts&&!mini)str+=PRESETS.map(v=>houseSvg(v,{ghost:true,color:v.color,prefix})).join('');
 if(!options.zones||mini)str+=`<text x="${house.x<15?20.5:8}" y="17" text-anchor="middle" fill="#99ae85" font-size=".43" letter-spacing=".10">ОТКРЫТЫЙ ДВОР</text>`;
 if(project.driveway&&project.driveway.visible!==false)str+=objectSvg(project.driveway,'driveway',interactive&&!mini,selected==='driveway',false);
 if(project.parking.visible!==false)str+=objectSvg(project.parking,'parking',interactive&&!mini,selected==='parking',!m.footprints.parking.every(p=>p[0]>=0&&p[1]>=0));
 if(project.shed.visible!==false)str+=objectSvg(project.shed,'shed',interactive&&!mini,selected==='shed',false);
 str+=houseSvg(house,{interactive:interactive&&!mini,selected:selected==='house',floor:options.floor&&!mini,bad:!m.inside||m.collisions.length>0,prefix});
 if(showSun&&(solar.shadows||solar.forest)){str+=`<g clip-path="url(#plot-clip)" mask="url(#shadow-mask)" pointer-events="none">${shadowScene(project,solar).polys.map(p=>`<polygon points="${coords(p.points)}" fill="${p.kind==='forest'?'#48624e':'#5b6252'}" opacity="${p.kind==='forest'?'.24':'.16'}"/>`).join('')}</g>`;}
 if(night)str+=`<polygon points="${coords(PLOT)}" fill="#22323d" opacity=".14" pointer-events="none"/>`;
 if(showSun)str+=solarSvg(project,solar);
 if(options.dimensions&&!mini){str+=dimension([0,-1.1],[37,-1.1],'37,00 м')+`<text x="18.5" y="-1.85" text-anchor="middle" font-size=".26" fill="#8a9a7d">24,89 + 12,11</text>`+dimension([0,22.55],[34,22.55],'34,00 м')+`<text x="17" y="23.35" text-anchor="middle" font-size=".26" fill="#8a9a7d">24 + 10</text>`+`<text x="-.48" y="10.5" transform="rotate(-90 -.48 10.5)" text-anchor="middle" font-size=".38" fill="#7b916e">21,44 м</text>`+`<text x="34.95" y="7.5" transform="rotate(-78 34.95 7.5)" text-anchor="middle" font-size=".26" fill="#8a9a7d">15,78 + 6,09</text>`;const poly=footprint(house),p=poly.reduce((a,b)=>b[0]<a[0]?b:a,poly[0]);if(m.inside)str+=dimension([0,p[1]],p,`≈ ${fmt(m.forest)} м`);}
 str+=`<path d="M${GATE.a.join(' ')}L${GATE.b.join(' ')}" stroke="#edf1e5" stroke-width=".22"/><path d="M${GATE.a.join(' ')}L${GATE.b.join(' ')}" stroke="#b28652" stroke-width=".1"/>${[GATE.a,GATE.b].map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r=".105" fill="#55734f"/>`).join('')}<path d="M${GATE.center[0]+2.1} ${GATE.center[1]}h-2.3m.38-.25-.38.25.38.25" stroke="#a87f49" stroke-width=".04" fill="none"/><text x="${GATE.center[0]+1.5}" y="${GATE.center[1]-.65}" font-size=".36" text-anchor="middle" fill="#9c7745">ВЪЕЗД 5 м</text><g transform="translate(0 24.6)"><path d="M0 0H5" stroke="#58784b" stroke-width=".07"/><path d="M0-.12V.12M5-.12V.12" stroke="#58784b" stroke-width=".04"/><text x="0" y=".6" font-size=".28" fill="#839477">0</text><text x="5" y=".6" text-anchor="end" font-size=".28" fill="#839477">5 м</text></g><text x="34" y="24.7" font-size=".28" text-anchor="end" fill="#92a07e">750 м² · ГП-01 / РЕВ. 03</text>`;
 // узлы дорожки — самым верхним слоем, иначе их перекрывают ворота, парковка и дом
 if(project.path.visible&&interactive&&!mini&&selected==='path'&&!drawing)str+=pathHandlesSvg(m.path.points,selectedPoint);
 for(const id of ['grid','deck','paving','plot-clip','shadow-mask','sun-arrow','house-floor-clip'])str=str.replaceAll(`id="${id}"`,`id="${prefix}-${id}"`).replaceAll(`url(#${id})`,`url(#${prefix}-${id})`);
 return str;
}
