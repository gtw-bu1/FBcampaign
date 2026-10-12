import {defaultStyle,parseStyle} from './core.mjs';

export const STYLE_STORAGE_KEY='fb-campaign-style-v1';

export function loadSavedStyle(storage){
 try{
  const raw=storage?.getItem(STYLE_STORAGE_KEY);
  if(!raw)return {style:defaultStyle,example:''};
  const saved=JSON.parse(raw);
  return {style:parseStyle(JSON.stringify(saved.style)),example:typeof saved.example==='string'?saved.example.slice(0,3000):''};
 }catch{return {style:defaultStyle,example:''};}
}

export function saveStyle(storage,style,example){
 try{storage?.setItem(STYLE_STORAGE_KEY,JSON.stringify({style,example:example.slice(0,3000)}));return true;}catch{return false;}
}
