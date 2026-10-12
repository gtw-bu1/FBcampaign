import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultStyle} from '../src/core.mjs';
import {STYLE_STORAGE_KEY,loadSavedStyle,saveStyle} from '../src/saved-style.mjs';

test('saved FB references and unfinished paste survive a page reload',()=>{
 const values=new Map();
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const style={...defaultStyle,examples:['第一篇可愛文案💕']};
 assert.equal(saveStyle(storage,style,'第二篇還在貼上中'),true);
 assert.ok(values.has(STYLE_STORAGE_KEY));
 assert.deepEqual(loadSavedStyle(storage),{style,example:'第二篇還在貼上中'});
});

test('damaged browser storage falls back safely',()=>{
 const storage={getItem:()=>'{broken'};
 assert.deepEqual(loadSavedStyle(storage),{style:defaultStyle,example:''});
});
