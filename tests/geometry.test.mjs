import test from 'node:test';
import assert from 'node:assert/strict';
import {PRESETS,PLOT,GATE,SHED,PARKING,metrics,footprint,rectPolygon,pointInside,segmentRectInterior,segmentInside,dist,transform,direction,bearing,validState} from '../dist/geometry.js';

test('the latest forest-side placement retains a 5 m terrace-to-boundary gap',()=>{
 const m=metrics(PRESETS[0]);assert.equal(m.forest,5);assert.equal(m.min,4.5);assert.equal(m.bearing,215);assert.equal(m.inside,true);assert.deepEqual(m.warnings,[]);
 assert.equal(dist(GATE.a,GATE.b).toFixed(8),'5.00000000');
});
test('all starting scenarios fit and offer distinct orientations or distances',()=>{
 for(const s of PRESETS){const m=metrics(s,3);assert(m.inside);assert(m.min>=3);assert.deepEqual(m.collisions,[]);assert(m.route);assert.equal(m.warnings.length,0);}
 assert.equal(bearing(PRESETS[1]),180);assert.equal(direction(bearing(PRESETS[1])),'Ю');assert(metrics(PRESETS[2]).forest>metrics(PRESETS[0]).forest);assert(metrics(PRESETS[2]).route.length<metrics(PRESETS[0]).route.length);
});
test('walking routes remain inside the plot and avoid the expanded house and shed',()=>{
 for(const angle of [0,-35,45,90,180,-90]){
  const s={x:14,y:11,angle},m=metrics(s,0);assert(m.route,`route for ${angle}`);
  const pad=.8,r=m.route.points,blocks=[{x:s.x,y:s.y,w:8+pad*2,h:10+pad*2,angle:s.angle},{...SHED,w:SHED.w+pad*2,h:SHED.h+pad*2}];
  for(let i=1;i<r.length-1;i++){assert(segmentInside(r[i-1],r[i]));assert(!blocks.some(b=>segmentRectInterior(r[i-1],r[i],b)),`blocked segment at ${angle}`);}
  assert(m.route.length>=dist(GATE.center,transform([-1.05,-5],s)));
 }
});
test('rotation, outside placement, and object collisions are reported',()=>{
 assert(metrics({x:3,y:10,angle:45}).warnings.some(x=>x.includes('выходит')));
 assert(metrics({...SHED,angle:0}).collisions.includes('бытовкой'));
 assert(metrics({...PARKING,angle:0}).collisions.includes('зоной парковки'));
 assert(metrics(PRESETS[0],6).warnings.some(x=>x.includes('буфер')));
 assert(!pointInside([35,15.4]));assert(!segmentInside([36.8,.2],[33.9,21]));
});
test('input validation rejects non-finite and unreasonable coordinates',()=>{
 assert(validState(PRESETS[0]));for(const bad of [{x:NaN,y:1,angle:0},{x:0,y:Infinity,angle:0},{x:100,y:10,angle:0},{x:10,y:10,angle:500},null])assert(!validState(bad));
});
