import {contain} from './core.mjs';
function lines(ctx,text,width){let out=[];for(const p of text.split('\n')){let line='';for(const c of p){if(ctx.measureText(line+c).width>width&&line){out.push(line);line='';}line+=c;}out.push(line);}return out;}
function fitText(ctx,text,x,y,width,height,size,color,weight=600){let ls;for(;size>=12;size--){ctx.font=`${weight} ${size}px "Microsoft JhengHei", sans-serif`;ls=lines(ctx,text,width);if(ls.length*size*1.4<=height)break;}if(ls.length*size*1.4>height)throw Error('圖片文字過長，請縮短後再下載。');ctx.fillStyle=color;ctx.textBaseline='top';ls.forEach((l,i)=>ctx.fillText(l,x,y+i*size*1.4));}
export async function renderPoster(canvas,a,assets,style,size){const [w,h]=size.split('x').map(Number);canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');const wide=h<800;const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#fff7df');g.addColorStop(.6,'#ffe0b1');g.addColorStop(1,style.accent);c.fillStyle=g;c.fillRect(0,0,w,h);c.strokeStyle='#ffffff66';c.lineWidth=3;for(let r=230;r<850;r+=140){c.beginPath();c.arc(w*.8,h*.55,r,0,Math.PI*2);c.stroke();}c.fillStyle='#ffffff44';c.beginPath();c.arc(w*.9,h*.14,110,0,7);c.fill();
 const left=60, textWidth=wide?510:1080;
 fitText(c,'LIMITED EVENT  /  限時活動',left,wide?36:58,700,40,22,'#864e30');
 fitText(c,a.headline||a.name,left,wide?94:132,textWidth,wide?175:220,wide?62:88,'#33271f',800);
 fitText(c,a.time,left,wide?275:369,textWidth,58,26,'#704a34');
 const box=wide?{x:650,y:76,w:490,h:380}:{x:70,y:455,w:1060,h:370};
 const visible=assets;const cols=visible.length<=2?Math.max(1,visible.length):Math.ceil(Math.sqrt(visible.length));const rows=Math.max(1,Math.ceil(visible.length/cols));
 if(!visible.length){c.fillStyle='#fff9ecb0';c.beginPath();c.roundRect(box.x,box.y,box.w,box.h,32);c.fill();fitText(c,'原廠素材展示區',box.x+35,box.y+box.h/2-34,box.w-70,65,32,'#9d7450');fitText(c,'上傳角色、道具或獎勵圖片',box.x+35,box.y+box.h/2+22,box.w-70,50,20,'#9d7450');}
 for(let i=0;i<visible.length;i++){const asset=visible[i];const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('素材無法載入，請重新上傳。'));im.src=asset.url;});const cw=box.w/cols,ch=box.h/rows;const x=box.x+(i%cols)*cw,y=box.y+Math.floor(i/cols)*ch;const b=contain(img.width,img.height,x+12,y+8,cw-24,ch-44);c.drawImage(img,b.x,b.y,b.w,b.h);fitText(c,asset.label,x+12,y+ch-32,cw-24,30,20,'#60432d');}
 fitText(c,a.rewards,left,wide?353:867,wide?510:740,wide?104:140,wide?26:32,'#513724');
 c.fillStyle='#382d26';const by=wide?524:1072;const bw=wide?400:440;c.beginPath();c.roundRect(left,by,bw,72,36);c.fill();fitText(c,a.cta,left+32,by+18,bw-64,42,27,'#fff8ed');
 fitText(c,'活動詳情請見貼文',wide?650:780,wide?550:1096,350,36,22,'#644532');
 return canvas;
}
