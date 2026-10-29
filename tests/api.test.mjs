import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { composeCopy, validateRequest } from '../api/generate.js';
import { initial, defaultStyle } from '../src/core.mjs';

const body = { activity: initial, style: defaultStyle, size: '1200x1200' };
function response() {
  return { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(value) { this.body = value; return this; } };
}

test('request accepts supported content and rejects unknown size', () => {
  assert.equal(validateRequest(body), '');
  assert.equal(validateRequest({...body,activity:{...initial,cta:''}}),'');
  assert.match(validateRequest({ ...body, size: '4000x4000' }), /尺寸/);
  assert.equal(validateRequest({...body,posterMode:'full-ai',referencePoster:'data:image/jpeg;base64,AQID'}),'');
  assert.match(validateRequest({...body,posterMode:'full-ai'}),/參考圖/);
  assert.equal(validateRequest({...body,action:'generate-size',posterMode:'full-ai',referencePoster:'data:image/jpeg;base64,AQID',visualDirection:'月光與暖色節慶'}),'');
});

test('AI hook cannot replace exact activity facts', () => {
  const copy = composeCopy(initial, {...defaultStyle,selectedHashtags:['#限時好禮'],hashtags:'#自訂活動'}, '一起展開新的冒險！');
  for (const key of ['time', 'rewards', 'conditions', 'cta']) assert.ok(copy.includes(initial[key]));
  assert.ok(copy.endsWith('#CSO絕對武力 #限時好禮 #自訂活動'));
});

test('public copy has a fixed title, readable opening, polished participation and closing',()=>{
  const copy=composeCopy(initial,defaultStyle,'秋天的驚喜來了！快跟朋友一起看看吧！','每天完成任務，再累積登入 7 天，就能領取好禮唷！','快約朋友一起展開秋日冒險吧！');
  assert.match(copy,/^【秋日冒險・好禮集結】限定冒險禮盒送給你！\n秋天的驚喜來了！\n快跟朋友一起看看吧！ ✨/u);
  assert.match(copy,/🌟 參加方式\n每天完成任務，再累積登入 7 天/);
  assert.doesNotMatch(copy,/🌟 參加方式\n活動期間完成每日任務，累積登入/);
  assert.match(copy,/💛 快約朋友一起展開秋日冒險吧！/);
});

test('API refuses requests before a server key is configured', async () => {
  const oldKey = process.env.OPENAI_API_KEY, oldGeminiKey = process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const result = response();
    await handler({ method: 'POST', headers: {}, body }, result);
    assert.equal(result.statusCode, 503);
    assert.match(result.body.error, /尚未啟用/);
  } finally { if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey; if (oldGeminiKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldGeminiKey; }
});

test('server authenticates and sends text only to image generation', async () => {
  const oldKey = process.env.OPENAI_API_KEY, oldGeminiKey = process.env.GEMINI_API_KEY, oldCode = process.env.FB_CAMPAIGN_ACCESS_CODE, oldFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = 'test-key';
  delete process.env.GEMINI_API_KEY;
  process.env.FB_CAMPAIGN_ACCESS_CODE = 'test-access-code-at-least-24-chars';
  const sent = [];
  globalThis.fetch = async (url, options) => {
    sent.push({ url, body: JSON.parse(options.body) });
    const payload = url.endsWith('/responses')
      ? { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ hook: '好禮等你拿！', participation:'活動期間記得完成每日任務，累積登入 7 天後就能領取唷！',closing:'快來開啟秋日冒險，把好禮帶回家吧！', visual_direction: '柔和暖橘光影' }) }] }] }
      : { data: [{ b64_json: 'AQID' }] };
    return { ok: true, json: async () => payload };
  };
  try {
    const denied = response();
    await handler({ method: 'POST', headers: { 'x-access-code': 'wrong' }, body }, denied);
    assert.equal(denied.statusCode, 401);
    assert.equal(sent.length, 0);
    const accepted = response();
    await handler({ method: 'POST', headers: { 'x-access-code': process.env.FB_CAMPAIGN_ACCESS_CODE }, body: { ...body, assets: ['PRIVATE_ORIGINAL_ASSET'] } }, accepted);
    assert.equal(accepted.statusCode, 200);
    assert.equal(accepted.body.mode, 'live');
    assert.ok(accepted.body.backgroundDataUrl.startsWith('data:image/jpeg;base64,'));
    assert.equal(sent.length, 2);
    assert.ok(!JSON.stringify(sent).includes('PRIVATE_ORIGINAL_ASSET'));
    assert.equal(sent[1].body.size, '1024x1024');
    assert.match(accepted.body.copy,/【秋日冒險・好禮集結】限定冒險禮盒送給你！/);
    assert.match(accepted.body.copy,/累積登入 7 天/);
    assert.doesNotMatch(accepted.body.copy,/📌 參加方式\n活動期間完成每日任務/);
    const wide = response();
    await handler({ method: 'POST', headers: { 'x-access-code': process.env.FB_CAMPAIGN_ACCESS_CODE }, body: { ...body, size: '1200x628' } }, wide);
    assert.equal(wide.statusCode, 200);
    assert.equal(sent[3].body.size, '1536x800');
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
    if (oldGeminiKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldGeminiKey;
    if (oldCode === undefined) delete process.env.FB_CAMPAIGN_ACCESS_CODE; else process.env.FB_CAMPAIGN_ACCESS_CODE = oldCode;
  }
});

test('Gemini key stays server-side and original assets never reach either model', async () => {
  const oldKey=process.env.GEMINI_API_KEY, oldOpenAI=process.env.OPENAI_API_KEY, oldCode=process.env.FB_CAMPAIGN_ACCESS_CODE, oldFetch=globalThis.fetch;
  process.env.GEMINI_API_KEY='gemini-test-key';
  process.env.OPENAI_API_KEY='unused-openai-key';
  process.env.FB_CAMPAIGN_ACCESS_CODE='test-access-code-at-least-24-chars';
  const sent=[];
  globalThis.fetch=async (url,options)=>{
    sent.push({url,headers:options.headers,body:JSON.parse(options.body)});
    const payload=url.includes('gemini-3.8-flash:')
      ? {candidates:[{content:{parts:[{text:JSON.stringify({hook:'一起來拿好禮吧！',participation:'每天完成任務，再累積登入 7 天，就能開心領取獎勵！',closing:'邀請朋友一起展開秋日冒險吧！',visual_direction:'柔和星空與暖光'})}]}}]}
      : {candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:'AQID'}}]}}]};
    return {ok:true,json:async()=>payload};
  };
  try{
    const denied=response();
    await handler({method:'POST',headers:{'x-access-code':'wrong'},body},denied);
    assert.equal(denied.statusCode,401);
    assert.equal(sent.length,0);
    const accepted=response();
    await handler({method:'POST',headers:{'x-access-code':process.env.FB_CAMPAIGN_ACCESS_CODE},body:{...body,assets:['PRIVATE_ORIGINAL_ASSET']}},accepted);
    assert.equal(accepted.statusCode,200);
    assert.equal(accepted.body.provider,'gemini');
    assert.equal(sent.length,2);
    assert.ok(sent.every(x=>x.headers['x-goog-api-key']==='gemini-test-key'));
    assert.ok(!JSON.stringify(sent).includes('PRIVATE_ORIGINAL_ASSET'));
    assert.match(sent[0].url,/\/v1beta\/models\/gemini-3\.8-flash:generateContent$/);
    assert.equal(sent[0].body.generationConfig.thinkingConfig.thinkingLevel,'low');
    assert.equal(sent[0].body.generationConfig.maxOutputTokens,4096);
    assert.deepEqual(sent[0].body.generationConfig.responseFormat.text.schema.required,['hook','participation','closing','visual_direction']);
    assert.equal(sent[1].body.generationConfig.imageConfig.aspectRatio,'1:1');
    assert.match(accepted.body.copy,/每天完成任務，再累積登入 7 天/);
    assert.match(accepted.body.copy,/邀請朋友一起展開秋日冒險吧/);
    const wide=response();
    await handler({method:'POST',headers:{'x-access-code':process.env.FB_CAMPAIGN_ACCESS_CODE},body:{...body,size:'1200x628'}},wide);
    assert.equal(wide.statusCode,200);
    assert.equal(sent[3].body.generationConfig.imageConfig.aspectRatio,'16:9');
  }finally{
    globalThis.fetch=oldFetch;
    if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;
    if(oldOpenAI===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldOpenAI;
    if(oldCode===undefined)delete process.env.FB_CAMPAIGN_ACCESS_CODE;else process.env.FB_CAMPAIGN_ACCESS_CODE=oldCode;
  }
});

test('Gemini token cutoff reports an actionable message without requesting an image', async()=>{
  const oldKey=process.env.GEMINI_API_KEY,oldCode=process.env.FB_CAMPAIGN_ACCESS_CODE,oldFetch=globalThis.fetch;
  process.env.GEMINI_API_KEY='gemini-test-key';
  process.env.FB_CAMPAIGN_ACCESS_CODE='test-access-code-at-least-24-chars';
  let calls=0;
  globalThis.fetch=async()=>{calls++;return{ok:true,json:async()=>({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[]}}]})};};
  try{
    const result=response();
    await handler({method:'POST',headers:{'x-access-code':process.env.FB_CAMPAIGN_ACCESS_CODE},body},result);
    assert.equal(result.statusCode,502);
    assert.match(result.body.error,/輸出中斷/);
    assert.equal(calls,1);
  }finally{
    globalThis.fetch=oldFetch;
    if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;
    if(oldCode===undefined)delete process.env.FB_CAMPAIGN_ACCESS_CODE;else process.env.FB_CAMPAIGN_ACCESS_CODE=oldCode;
  }
});

test('full AI poster sends only a compressed composition and returns a finished image',async()=>{
  const oldKey=process.env.GEMINI_API_KEY,oldCode=process.env.FB_CAMPAIGN_ACCESS_CODE,oldFetch=globalThis.fetch;
  process.env.GEMINI_API_KEY='gemini-test-key';
  process.env.FB_CAMPAIGN_ACCESS_CODE='test-access-code-at-least-24-chars';
  const sent=[];
  globalThis.fetch=async(url,options)=>{
    sent.push({url,body:JSON.parse(options.body)});
    return {ok:true,json:async()=>url.includes('gemini-3.8-flash:')
      ? {candidates:[{content:{parts:[{text:JSON.stringify({hook:'月光灑下來，今晚的驚喜正等著大家一起收藏！',participation:'活動期間先完成每日任務，再累積登入 7 天，獎勵就等你領取！',closing:'快邀朋友一起來收藏秋日好禮吧！',visual_direction:'月光與暖色節慶'} )}]}}]}
      : {candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:'AQID'}}]}}]}};
  };
  try{
    const result=response();
    await handler({method:'POST',headers:{'x-access-code':process.env.FB_CAMPAIGN_ACCESS_CODE},body:{...body,posterMode:'full-ai',referencePoster:'data:image/jpeg;base64,AQID',assetReferences:[{role:'角色',label:'主角',dataUrl:'data:image/jpeg;base64,BAUG'}],assets:['ORIGINAL_ASSET_BYTES']}},result);
    assert.equal(result.statusCode,200);
    assert.equal(result.body.backgroundDataUrl,undefined);
    assert.equal(result.body.posterDataUrl,'data:image/png;base64,AQID');
    assert.equal(sent.length,2);
    assert.equal(sent[1].body.contents[0].parts[1].inlineData.data,'AQID');
    assert.equal(sent[1].body.contents[0].parts[2].inlineData.data,'BAUG');
    assert.match(sent[1].body.contents[0].parts[0].text,/hero asset visibly larger/);
    assert.match(sent[1].body.contents[0].parts[0].text,/FINISHED advertisement/);
    assert.ok(!JSON.stringify(sent).includes('ORIGINAL_ASSET_BYTES'));
  }finally{
    globalThis.fetch=oldFetch;
    if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;
    if(oldCode===undefined)delete process.env.FB_CAMPAIGN_ACCESS_CODE;else process.env.FB_CAMPAIGN_ACCESS_CODE=oldCode;
  }
});

test('preserved character mode asks AI to leave room without redrawing a costume',async()=>{
  const oldKey=process.env.GEMINI_API_KEY,oldCode=process.env.FB_CAMPAIGN_ACCESS_CODE,oldFetch=globalThis.fetch;
  process.env.GEMINI_API_KEY='gemini-test-key';process.env.FB_CAMPAIGN_ACCESS_CODE='test-access-code-at-least-24-chars';
  const sent=[];globalThis.fetch=async(url,options)=>{sent.push({url,body:JSON.parse(options.body)});return{ok:true,json:async()=>url.includes('gemini-3.8-flash:')?{candidates:[{content:{parts:[{text:JSON.stringify({hook:'秋日驚喜來了！快一起看看吧！',participation:'每天完成任務，累積登入 7 天就能領取！',closing:'快來展開秋日冒險吧！',visual_direction:'暖色光影'})}]}}]}:{candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:'AQID'}}]}}]}};};
  try{const result=response();await handler({method:'POST',headers:{'x-access-code':process.env.FB_CAMPAIGN_ACCESS_CODE},body:{...body,posterMode:'full-ai',preserveCharacter:true,referencePoster:'data:image/jpeg;base64,AQID'}},result);assert.equal(result.statusCode,200);assert.match(sent[1].body.contents[0].parts[0].text,/Do not draw, redraw, modify, or invent any character/);assert.equal(sent[1].body.contents[0].parts.length,2);}finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;if(oldCode===undefined)delete process.env.FB_CAMPAIGN_ACCESS_CODE;else process.env.FB_CAMPAIGN_ACCESS_CODE=oldCode;}
});

test('AI opening alternatives return three editable copies without an image call',async()=>{
  const oldKey=process.env.GEMINI_API_KEY,oldCode=process.env.FB_CAMPAIGN_ACCESS_CODE,oldFetch=globalThis.fetch;
  process.env.GEMINI_API_KEY='gemini-test-key';
  process.env.FB_CAMPAIGN_ACCESS_CODE='test-access-code-at-least-24-chars';
  const sent=[];
  globalThis.fetch=async(url,options)=>{sent.push({url,body:JSON.parse(options.body)});return{ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({hooks:['月光帶來驚喜，讓我們一起收藏這份好禮！','這次的小驚喜，正等著大家來揭開序幕～','好禮悄悄登場，快跟我們一起看看吧！']})}]}}]})};};
  try{
    const result=response();
    await handler({method:'POST',headers:{'x-access-code':process.env.FB_CAMPAIGN_ACCESS_CODE},body:{...body,action:'copy-alternatives',currentHook:'舊開場'}},result);
    assert.equal(result.statusCode,200);
    assert.equal(result.body.drafts.length,3);
    assert.equal(result.body.posterDataUrl,undefined);
    assert.equal(sent.length,1);
    assert.ok(result.body.drafts.every(x=>x.opening && !x.copy));
  }finally{
    globalThis.fetch=oldFetch;
    if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;
    if(oldCode===undefined)delete process.env.FB_CAMPAIGN_ACCESS_CODE;else process.env.FB_CAMPAIGN_ACCESS_CODE=oldCode;
  }
});

test('image refinement edits the existing poster without generating new copy',async()=>{
  const oldKey=process.env.GEMINI_API_KEY,oldCode=process.env.FB_CAMPAIGN_ACCESS_CODE,oldFetch=globalThis.fetch;
  process.env.GEMINI_API_KEY='gemini-test-key';
  process.env.FB_CAMPAIGN_ACCESS_CODE='test-access-code-at-least-24-chars';
  const sent=[];
  globalThis.fetch=async(url,options)=>{sent.push({url,body:JSON.parse(options.body)});return{ok:true,json:async()=>({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:'AQID'}}]}}]})};};
  try{
    const result=response();
    await handler({method:'POST',headers:{'x-access-code':process.env.FB_CAMPAIGN_ACCESS_CODE},body:{...body,action:'edit-image',posterMode:'full-ai',referencePoster:'data:image/jpeg;base64,AQID',editInstruction:'把角色放大'}},result);
    assert.equal(result.statusCode,200);
    assert.equal(result.body.posterDataUrl,'data:image/png;base64,AQID');
    assert.equal(result.body.copy,undefined);
    assert.equal(sent.length,1);
    assert.match(sent[0].body.contents[0].parts[0].text,/把角色放大/);
    assert.equal(sent[0].body.contents[0].parts[1].inlineData.data,'AQID');
  }finally{
    globalThis.fetch=oldFetch;
    if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;
    if(oldCode===undefined)delete process.env.FB_CAMPAIGN_ACCESS_CODE;else process.env.FB_CAMPAIGN_ACCESS_CODE=oldCode;
  }
});

test('second size generates its own layout without replacing copy',async()=>{
  const oldKey=process.env.GEMINI_API_KEY,oldCode=process.env.FB_CAMPAIGN_ACCESS_CODE,oldFetch=globalThis.fetch;
  process.env.GEMINI_API_KEY='gemini-test-key';process.env.FB_CAMPAIGN_ACCESS_CODE='test-access-code-at-least-24-chars';
  const sent=[];
  globalThis.fetch=async(url,options)=>{sent.push({url,body:JSON.parse(options.body)});return{ok:true,json:async()=>({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:'AQID'}}]}}]})};};
  try{
    const result=response();
    await handler({method:'POST',headers:{'x-access-code':process.env.FB_CAMPAIGN_ACCESS_CODE},body:{...body,action:'generate-size',posterMode:'full-ai',size:'1200x628',referencePoster:'data:image/jpeg;base64,AQID',visualDirection:'月光與暖色節慶'}},result);
    assert.equal(result.statusCode,200);
    assert.equal(result.body.posterDataUrl,'data:image/png;base64,AQID');
    assert.equal(result.body.copy,undefined);
    assert.equal(sent.length,1);
    assert.equal(sent[0].body.generationConfig.imageConfig.aspectRatio,'16:9');
    assert.match(sent[0].body.contents[0].parts[0].text,/companion wide landscape/);
    const fresh=response();
    await handler({method:'POST',headers:{'x-access-code':process.env.FB_CAMPAIGN_ACCESS_CODE},body:{...body,action:'generate-size',posterMode:'full-ai',size:'1200x628',referencePoster:'data:image/jpeg;base64,AQID',visualDirection:'月光與暖色節慶',preserveCharacter:true,freshVariation:true}},fresh);
    assert.equal(fresh.statusCode,200);
    assert.match(sent[1].body.contents[0].parts[0].text,/NEW, distinct design variation/);
    assert.match(sent[1].body.contents[0].parts[0].text,/Do not draw, redraw, alter or invent any character/);
  }finally{
    globalThis.fetch=oldFetch;
    if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;
    if(oldCode===undefined)delete process.env.FB_CAMPAIGN_ACCESS_CODE;else process.env.FB_CAMPAIGN_ACCESS_CODE=oldCode;
  }
});

test('second size can generate an AI background without assets or poster reference',async()=>{
  const oldKey=process.env.GEMINI_API_KEY,oldCode=process.env.FB_CAMPAIGN_ACCESS_CODE,oldFetch=globalThis.fetch;
  process.env.GEMINI_API_KEY='gemini-test-key';process.env.FB_CAMPAIGN_ACCESS_CODE='test-access-code-at-least-24-chars';
  let prompt='';globalThis.fetch=async(_url,options)=>{const body=JSON.parse(options.body);prompt=body.contents[0].parts[0].text;return{ok:true,json:async()=>({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:'AQID'}}]}}]})};};
  try{const result=response();await handler({method:'POST',headers:{'x-access-code':process.env.FB_CAMPAIGN_ACCESS_CODE},body:{...body,action:'generate-size',posterMode:'composite',size:'1200x628',visualDirection:'秋日暖光',freshVariation:true}},result);assert.equal(result.statusCode,200);assert.equal(result.body.backgroundDataUrl,'data:image/png;base64,AQID');assert.equal(result.body.posterDataUrl,undefined);assert.match(prompt,/Absolutely NO people, characters/);}finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;if(oldCode===undefined)delete process.env.FB_CAMPAIGN_ACCESS_CODE;else process.env.FB_CAMPAIGN_ACCESS_CODE=oldCode;}
});

test('remembered sign-in uses an HttpOnly cookie and can be forgotten',async()=>{
  const oldKey=process.env.GEMINI_API_KEY,oldCode=process.env.FB_CAMPAIGN_ACCESS_CODE,oldFetch=globalThis.fetch;
  process.env.GEMINI_API_KEY='gemini-test-key';process.env.FB_CAMPAIGN_ACCESS_CODE='test-access-code-at-least-24-chars';
  globalThis.fetch=async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({hooks:['開場一，歡迎來到秋日的冒險！','開場二，驚喜正在悄悄登場！','開場三，好禮正在等著大家！']})}]}}]})});
  try{
    const login=response();
    await handler({method:'POST',headers:{'x-access-code':process.env.FB_CAMPAIGN_ACCESS_CODE},body:{...body,action:'copy-alternatives'}},login);
    assert.equal(login.statusCode,200);
    const cookie=login.headers['Set-Cookie'];
    assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);
    assert.ok(!cookie.includes(process.env.FB_CAMPAIGN_ACCESS_CODE));
    const cookieHeader=cookie.split(';')[0];
    const status=response();await handler({method:'GET',headers:{cookie:cookieHeader}},status);
    assert.equal(status.body.remembered,true);
    const accepted=response();await handler({method:'POST',headers:{cookie:cookieHeader},body:{...body,action:'copy-alternatives'}},accepted);
    assert.equal(accepted.statusCode,200);
    const logout=response();await handler({method:'DELETE',headers:{cookie:cookieHeader}},logout);
    assert.match(logout.headers['Set-Cookie'],/Max-Age=0/);
  }finally{
    globalThis.fetch=oldFetch;
    if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;
    if(oldCode===undefined)delete process.env.FB_CAMPAIGN_ACCESS_CODE;else process.env.FB_CAMPAIGN_ACCESS_CODE=oldCode;
  }
});

