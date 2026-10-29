import test from 'node:test';
import assert from 'node:assert/strict';
import {renderSocialPoster} from '../src/social-poster.mjs';
import {initial,defaultStyle} from '../src/core.mjs';
import {normalizePosterDesign} from '../src/poster-design.mjs';

test('AI layout choices are limited to supported fonts and colors',()=>{const result=normalizePosterDesign({'1200x1200':{font:'unknown',color:'gold',ornament:'petals',titleAlign:'center',textSide:'left'}});assert.equal(result['1200x1200'].font,'editorial');assert.equal(result['1200x1200'].ornament,'petals');assert.equal(result['1200x628'].font,'editorial');});

test('both social layouts print exact campaign text and use original source images',async()=>{
 const oldImage=globalThis.Image,drawn=[],words=[];
 globalThis.Image=class{width=400;height=800;set src(value){this.source=value;this.onload();}};
 const gradient={addColorStop(){}};
 const ctx={createLinearGradient:()=>gradient,drawImage:(image)=>drawn.push(image.source),fillRect(){},beginPath(){},roundRect(){},fill(){},stroke(){},moveTo(){},lineTo(){},arc(){},ellipse(){},measureText:value=>({width:String(value).length*15}),fillText:value=>words.push(String(value))};
 try{for(const size of ['1200x1200','1200x628']){const canvas={width:0,height:0,getContext:()=>ctx};await renderSocialPoster(canvas,initial,[{role:'角色',url:'original:character'},{role:'獎勵 ICON',url:'original:reward'}],defaultStyle,size,'data:image/png;base64,AQID');assert.equal(canvas.width,1200);assert.equal(canvas.height,Number(size.split('x')[1]));}
  assert.equal(drawn.filter(x=>x==='original:character').length,2);
  assert.equal(drawn.filter(x=>x==='original:reward').length,2);
  assert.ok(words.includes('限定冒險禮盒 × 1'));
  assert.ok(words.includes('立即參加'));
  assert.ok(words.some(x=>x.includes('秋日冒險')));
 }finally{globalThis.Image=oldImage;}
});

