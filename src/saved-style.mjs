import {defaultStyle,parseStyle} from './core.mjs';

export const STYLE_STORAGE_KEY='fb-campaign-style-v1';

export function browserStorage(){try{return window.localStorage;}catch{return null;}}

export function loadSavedStyle(storage){
 try{
  const raw=storage?.getItem(STYLE_STORAGE_KEY);
  if(!raw)return {style:defaultStyle,example:'',generationIndex:0,recentOpenings:[]};
  const saved=JSON.parse(raw);
  const style=parseStyle(JSON.stringify(saved.style));
  if(style.hashtags==='#秋日冒險 #限時活動')style.hashtags='';
  return {style,example:typeof saved.example==='string'?saved.example.slice(0,3000):'',generationIndex:Number.isSafeInteger(saved.generationIndex)&&saved.generationIndex>=0?saved.generationIndex:0,recentOpenings:Array.isArray(saved.recentOpenings)?saved.recentOpenings.filter(x=>typeof x==='string'&&x.length<500).slice(-90):[]};
 }catch{return {style:defaultStyle,example:'',generationIndex:0,recentOpenings:[]};}
}

export function saveStyle(storage,style,example,generationIndex=0,recentOpenings=[]){
 try{if(!storage)return false;storage.setItem(STYLE_STORAGE_KEY,JSON.stringify({style,example:example.slice(0,3000),generationIndex,recentOpenings:recentOpenings.slice(-90)}));return true;}catch{return false;}
}
