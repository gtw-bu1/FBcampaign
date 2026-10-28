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
});

test('AI hook cannot replace exact activity facts', () => {
  const copy = composeCopy(initial, {...defaultStyle,selectedHashtags:['#限時好禮'],hashtags:'#自訂活動'}, '一起展開新的冒險！');
  for (const key of ['time', 'rewards', 'conditions', 'cta']) assert.ok(copy.includes(initial[key]));
  assert.ok(copy.endsWith('#CSO絕對武力 #限時好禮 #自訂活動'));
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
      ? { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ hook: '好禮等你拿！', visual_direction: '柔和暖橘光影' }) }] }] }
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
    assert.ok(accepted.body.copy.includes(initial.conditions));
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
      ? {candidates:[{content:{parts:[{text:JSON.stringify({hook:'一起來拿好禮吧！',visual_direction:'柔和星空與暖光'})}]}}]}
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
    assert.deepEqual(sent[0].body.generationConfig.responseFormat.text.schema.required,['hook','visual_direction']);
    assert.equal(sent[1].body.generationConfig.imageConfig.aspectRatio,'1:1');
    assert.ok(accepted.body.copy.includes(initial.conditions));
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
      ? {candidates:[{content:{parts:[{text:JSON.stringify({hook:'月光灑下來，今晚的驚喜正等著大家一起收藏！',visual_direction:'月光與暖色節慶'} )}]}}]}
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
    assert.match(sent[1].body.contents[0].parts[0].text,/dominant focal point/);
    assert.match(sent[1].body.contents[0].parts[0].text,/FINISHED advertisement/);
    assert.ok(!JSON.stringify(sent).includes('ORIGINAL_ASSET_BYTES'));
  }finally{
    globalThis.fetch=oldFetch;
    if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;
    if(oldCode===undefined)delete process.env.FB_CAMPAIGN_ACCESS_CODE;else process.env.FB_CAMPAIGN_ACCESS_CODE=oldCode;
  }
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
