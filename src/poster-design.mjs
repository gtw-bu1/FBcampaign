const FONTS=['editorial','modern','soft','neon'];
const COLORS=['gold','ivory','rose','ice'];
const ORNAMENTS=['sparkles','petals','light-trails','minimal'];
export const defaultPosterDesign={
  '1200x1200':{font:'editorial',color:'gold',ornament:'sparkles',titleAlign:'center',textSide:'left'},
  '1200x628':{font:'editorial',color:'gold',ornament:'sparkles',titleAlign:'left',textSide:'left'}
};
export function normalizePosterDesign(input){const result={};for(const size of ['1200x1200','1200x628']){const raw=input?.[size]||{},fallback=defaultPosterDesign[size];result[size]={font:FONTS.includes(raw.font)?raw.font:fallback.font,color:COLORS.includes(raw.color)?raw.color:fallback.color,ornament:ORNAMENTS.includes(raw.ornament)?raw.ornament:fallback.ornament,titleAlign:['left','center'].includes(raw.titleAlign)?raw.titleAlign:fallback.titleAlign,textSide:['left','right'].includes(raw.textSide)?raw.textSide:fallback.textSide};}return result;}

