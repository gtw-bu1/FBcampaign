import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,defaultStyle} from '../src/core.mjs';
import {renderPoster,renderGeneratedPoster} from '../src/canvas.mjs';

function fakeCanvas(){
 const written=[];
 const gradient={addColorStop(){}};
 const ctx=new Proxy({}, {get(_target,key){if(key==='measureText')return text=>({width:String(text).length*11});if(key==='fillText')return text=>written.push(String(text));if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>gradient;return ()=>{};},set(){return true;}});
 return {written,canvas:{width:0,height:0,getContext:()=>ctx}};
}

test('empty uploads produce a real universal poster without placeholder text or optional CTA',async()=>{
 const {written,canvas}=fakeCanvas();
 await renderPoster(canvas,{...initial,subtitle:'一起收藏小驚喜',cta:''},[],defaultStyle,'1200x1200');
 assert.equal(canvas.width,1200);assert.equal(canvas.height,1200);
 assert.ok(written.includes('一起收藏小驚喜'));
 assert.ok(!written.includes('原廠素材展示區'));
 assert.ok(!written.includes('立即參加'));
});

test('asset name is drawn only when requested',async()=>{
 const oldImage=globalThis.Image;
 globalThis.Image=class{width=100;height=100;set src(_value){this.onload();}};
 try{
  const asset=[{url:'test:asset',label:'my-original.png'}];
  const hidden=fakeCanvas();await renderPoster(hidden.canvas,{...initial,showAssetNames:false},asset,defaultStyle,'1200x628');
  const shown=fakeCanvas();await renderPoster(shown.canvas,{...initial,showAssetNames:true},asset,defaultStyle,'1200x628');
  assert.equal(hidden.canvas.height,628);
  assert.ok(!hidden.written.includes('my-original.png'));
  assert.ok(shown.written.includes('my-original.png'));
 }finally{globalThis.Image=oldImage;}
});

test('finished AI poster is drawn directly without program text overlays',async()=>{
 const oldImage=globalThis.Image;
 globalThis.Image=class{width=1024;height=1024;set src(_value){this.onload();}};
 try{
  const {written,canvas}=fakeCanvas();
  await renderGeneratedPoster(canvas,'1200x1200','data:image/png;base64,AQID');
  assert.equal(canvas.width,1200);
  assert.equal(canvas.height,1200);
  assert.deepEqual(written,[]);
 }finally{globalThis.Image=oldImage;}
});

test('original character image is placed unchanged after AI art on both sizes',async()=>{
 const oldImage=globalThis.Image,draws=[];
 globalThis.Image=class{width=100;height=200;set src(value){this.source=value;this.onload();}};
 try{for(const size of ['1200x1200','1200x628']){const canvas={width:0,height:0,getContext:()=>({drawImage:(image,...box)=>draws.push({size,source:image.source,box})})};await renderGeneratedPoster(canvas,size,'data:image/png;base64,AQID',[{role:'角色',url:'original:character-a'},{role:'角色',url:'original:character-b'}]);}
  assert.deepEqual(draws.map(x=>x.source),['data:image/png;base64,AQID','original:character-a','original:character-b','data:image/png;base64,AQID','original:character-a','original:character-b']);
  assert.ok(draws.filter(x=>x.source.startsWith('original:')).every(x=>x.box[2]>0&&x.box[3]>0));
 }finally{globalThis.Image=oldImage;}
});

