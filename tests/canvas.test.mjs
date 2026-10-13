import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,defaultStyle} from '../src/core.mjs';
import {renderPoster} from '../src/canvas.mjs';

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
