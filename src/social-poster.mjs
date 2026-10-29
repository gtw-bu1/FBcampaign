import {contain} from './core.mjs';

function loaded(src,label){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error(`${label}無法載入，請重新上傳。`));image.src=src;});}
function textLines(ctx,value,maxWidth){const rows=[];for(const paragraph of String(value||'').split('\n')){let row='';for(const char of paragraph){if(row&&ctx.measureText(row+char).width>maxWidth){rows.push(row);row='';}row+=char;}rows.push(row);}return rows;}
function drawText(ctx,value,x,y,w,h,maxSize,minSize,color,weight=700){let size=maxSize,rows=[];for(;size>=minSize;size--){ctx.font=`${weight} ${size}px "Microsoft JhengHei", "Noto Sans TC", sans-serif`;rows=textLines(ctx,value,w);if(rows.length*size*1.28<=h)break;}if(rows.length*size*1.28>h)throw Error('圖片文字太多，請縮短主標或獎勵後再試。');ctx.fillStyle=color;ctx.textBaseline='top';rows.forEach((row,index)=>ctx.fillText(row,x,y+index*size*1.28));}
function rounded(ctx,x,y,w,h,r,fill,stroke=''){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
async function asset(ctx,item,box){const img=await loaded(item.url,'素材');const placed=contain(img.width,img.height,box.x,box.y,box.w,box.h);ctx.drawImage(img,placed.x,placed.y,placed.w,placed.h);return placed;}

export async function renderSocialPoster(canvas,activity,assets,style,size,backgroundDataUrl=''){
  const [w,h]=size.split('x').map(Number),wide=h<800;canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
  if(backgroundDataUrl){const image=await loaded(backgroundDataUrl,'AI 背景');const scale=Math.max(w/image.width,h/image.height),dw=image.width*scale,dh=image.height*scale;ctx.drawImage(image,(w-dw)/2,(h-dh)/2,dw,dh);}else{const base=ctx.createLinearGradient(0,0,w,h);base.addColorStop(0,'#2d3449');base.addColorStop(.58,'#6b5976');base.addColorStop(1,'#b38b80');ctx.fillStyle=base;ctx.fillRect(0,0,w,h);}
  const veil=ctx.createLinearGradient(0,0,w,0);veil.addColorStop(0,'rgba(20,23,35,.91)');veil.addColorStop(wide?.55:.48,'rgba(20,23,35,.68)');veil.addColorStop(1,'rgba(20,23,35,.18)');ctx.fillStyle=veil;ctx.fillRect(0,0,w,h);
  const bottom=ctx.createLinearGradient(0,h*.55,0,h);bottom.addColorStop(0,'rgba(15,18,28,0)');bottom.addColorStop(1,'rgba(15,18,28,.63)');ctx.fillStyle=bottom;ctx.fillRect(0,0,w,h);
  const chars=assets.filter(x=>x.role==='角色'),others=assets.filter(x=>x.role!=='角色'&&x.role!=='Logo'),logos=assets.filter(x=>x.role==='Logo');
  rounded(ctx,wide?60:68,wide?42:62,wide?176:192,wide?36:40,19,'rgba(255,255,255,.18)','rgba(255,255,255,.32)');
  drawText(ctx,'限時活動',wide?76:84,wide?51:72,wide?148:164,26,18,14,'#fff4d9',700);
  drawText(ctx,activity.headline?.trim()||activity.name,wide?60:68,wide?112:134,wide?590:1050,wide?142:165,wide?64:78,32,'#fff7e8',800);
  if(activity.subtitle?.trim())drawText(ctx,activity.subtitle,wide?62:70,wide?266:302,wide?570:930,wide?45:52,wide?28:34,18,'#fce3ba',600);
  rounded(ctx,wide?60:68,wide?326:366,wide?535:550,wide?41:47,12,'rgba(255,255,255,.15)');
  drawText(ctx,`📅  ${activity.time}`,wide?78:88,wide?335:377,wide?500:510,wide?25:28,wide?22:24,16,'#fff9ed',600);
  const card=wide?{x:60,y:390,w:590,h:126}:{x:68,y:860,w:560,h:160};
  rounded(ctx,card.x,card.y,card.w,card.h,22,'rgba(255,250,239,.94)','rgba(255,255,255,.6)');
  drawText(ctx,'🎁 活動獎勵',card.x+22,card.y+17,250,26,20,18,'#8b572e',800);
  drawText(ctx,activity.rewards,card.x+22,card.y+(wide?49:52),others.length?card.w-180:card.w-44,card.h-(wide?58:66),wide?27:30,15,'#3b302b',700);
  if(others.length){await asset(ctx,others[0],{x:card.x+card.w-147,y:card.y+16,w:125,h:card.h-32});if(activity.showAssetNames&&others[0].label)drawText(ctx,others[0].label,card.x+card.w-147,card.y+card.h-24,125,20,15,12,'#715b4c',500);}
  if(chars.length){const zone=wide?{x:678,y:38,w:480,h:555}:{x:640,y:355,w:500,h:700};const cols=chars.length<=2?chars.length:Math.ceil(Math.sqrt(chars.length)),rows=Math.ceil(chars.length/cols);for(let i=0;i<chars.length;i++)await asset(ctx,chars[i],{x:zone.x+(i%cols)*zone.w/cols,y:zone.y+Math.floor(i/cols)*zone.h/rows,w:zone.w/cols,h:zone.h/rows});}
  else if(others.length>1){await asset(ctx,others[1],wide?{x:720,y:90,w:370,h:390}:{x:710,y:365,w:390,h:380});}
  if(logos.length)await asset(ctx,logos[0],wide?{x:1045,y:28,w:105,h:80}:{x:990,y:55,w:130,h:95});
  if(activity.cta?.trim()){const x=wide?60:68,y=wide?544:1064,bw=wide?290:390,bh=wide?56:66;rounded(ctx,x,y,bw,bh,bh/2,style.accent||'#ef743c');drawText(ctx,activity.cta,x+28,y+(wide?14:18),bw-56,wide?30:34,wide?25:28,16,'#ffffff',800);}
  return canvas;
}

