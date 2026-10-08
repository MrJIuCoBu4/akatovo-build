import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultProject,sceneMetrics,pathPoints,normalizeProject,validProject,walkingRoute} from '../dist/geometry.js';
import {SOLAR_DEFAULT,solarDay,solarPosition,facadeLight,shadowPolygon,timeLabel,shadowScene} from '../dist/solar.js';
import {planMarkup} from '../dist/scene.js';
test('editable auxiliary objects participate in collisions and automatic path clearance',()=>{
 const p=defaultProject();assert.deepEqual(sceneMetrics(p).warnings,[]);p.shed.x=9;p.shed.y=10;assert(sceneMetrics(p).warnings.some(v=>v.includes('пересекается с бытовкой')));
 const q=defaultProject();q.path.width=3;assert(pathPoints(q).length>=2);assert(!sceneMetrics(q).warnings.some(v=>v.includes('Дорожка пересекает')));
 q.parking.x=36;assert(sceneMetrics(q).warnings.some(v=>v.includes('Парковка выходит')));
});
test('manually drawn path length and covering estimate reflect width; invalid paths are flagged',()=>{
 const p=defaultProject();p.path={mode:'manual',points:[[20,8],[23,8],[23,12]],width:2,material:'pavers',visible:true};const m=sceneMetrics(p);assert.equal(m.path.length,7);assert.equal(m.path.area,14);assert.deepEqual(m.warnings,[]);
 p.path.points=[[2,10],[10,10],[20,10]];assert(sceneMetrics(p).warnings.some(v=>v.includes('Дорожка пересекает')));
 p.path.points=[[10,23],[30,23]];assert(sceneMetrics(p).warnings.some(v=>v.includes('Дорожка с учётом ширины выходит')));
 assert(validProject(normalizeProject(defaultProject())));
});
test('solar calculations have sane local times, seasonal heights, and north-based directions',()=>{
 const summer=solarDay(SOLAR_DEFAULT);assert(summer.sunrise>200&&summer.sunrise<260);assert(summer.sunset>1260&&summer.sunset<1320);
 const noon=solarPosition('2026-06-21',12*60+35);assert(noon.altitude>56&&noon.altitude<59);assert(noon.azimuth>177&&noon.azimuth<184);
 assert(solarPosition('2026-12-21',12*60+30).altitude<12);assert(solarPosition('2026-06-21',0).altitude<0);assert.equal(timeLabel(960),'16:00');
 const equator=solarPosition('2026-03-21',12*60,0,0,0);assert(equator.altitude>87);
});
test('projected shadows oppose the light and facade hours are distinct from forest shading',()=>{
 const poly=[[0,0],[1,0],[1,1],[0,1]],shadow=shadowPolygon(poly,10,{altitude:45,azimuth:215});assert(Math.max(...shadow.map(p=>p[0]))>10);assert(Math.min(...shadow.map(p=>p[0]))>=0);assert.equal(shadowPolygon(poly,10,{altitude:-1,azimuth:215}).length,0);
 const p=defaultProject(),a=shadowScene(p,SOLAR_DEFAULT);assert(a.front);assert(a.shadeFraction>0);assert(facadeLight(p.house,SOLAR_DEFAULT).minutes>0);
 const b=shadowScene(p,{...SOLAR_DEFAULT,forest:false});assert(b.shadeFraction<a.shadeFraction);const forestOnly=shadowScene(p,{...SOLAR_DEFAULT,shadows:false,forest:true});assert.equal(forestOnly.polys.length,1);assert.equal(forestOnly.polys[0].kind,'forest');
});
test('SVG contains editable object targets and daylight only appears as an explicit solar layer',()=>{
 const p=defaultProject(),s=planMarkup(p,{selected:'shed',options:{compass:true,dimensions:true},solar:SOLAR_DEFAULT});assert.match(s,/data-object="house"/);assert.match(s,/data-object="shed"/);assert.match(s,/data-object="parking"/);assert.match(s,/data-rotation="shed"/);assert.match(s,/id="main-shadow-mask"/);assert.match(s,/16:00/);
 assert.doesNotMatch(planMarkup(p,{selected:'path',solar:{...SOLAR_DEFAULT,show:false},options:{}}),/16:00/);
});
