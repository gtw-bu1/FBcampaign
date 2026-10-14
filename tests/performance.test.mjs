import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeHistory,durationDays,estimateParticipants,historyCsv,inferAssessment,inferDuration,loadHistory,parseHistoryCsv,saveHistory,validateRecord} from '../src/performance.mjs';

const activity={name:'中秋月兔留影會',time:'2026/09/21 維護後 ～ 2026/10/14 維護前',conditions:'穿戴中秋服裝拍照並留言，累積登入 7 天。',rewards:'限定角色 × 1'};
const rows=Array.from({length:9},(_,i)=>validateRecord({name:`歷史活動 ${i+1}`,start:`2026-0${i+1}-01`,end:`2026-0${i+1}-14`,difficulty:i%5+1,rewardValue:(i+2)%5+1,season:['淡季','平季','旺季'][i%3],participants:100+i*85,conditions:'留言、登入',rewards:'角色獎勵'}));

test('campaign dates and editable initial assessment are derived without inventing a season',()=>{
 assert.equal(inferDuration(activity.time),24);
 assert.equal(durationDays('2026-02-28','2026-03-01'),2);
 assert.equal(durationDays('2026-02-30','2026-03-01'),null);
 const assessment=inferAssessment(activity);
 assert.equal(assessment.duration,24);
 assert.equal(assessment.difficulty,5);
 assert.equal(assessment.rewardValue,5);
 assert.equal(assessment.season,'');
});
test('CSV template, quoting, import validation and browser persistence',()=>{
 const csv=historyCsv([{...rows[0],name:'活動,「測試」',conditions:'先登入\n再留言'}]);
 const imported=parseHistoryCsv(csv);
 assert.equal(imported[0].name,'活動,「測試」');
 assert.equal(imported[0].conditions,'先登入\n再留言');
 assert.throws(()=>parseHistoryCsv(historyCsv([])),/至少填入/);
 assert.throws(()=>validateRecord({...rows[0],participants:''}),/參與人數/);
 const values=new Map();const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 assert.equal(saveHistory(storage,rows),true);
 assert.deepEqual(loadHistory(storage),rows);
});
test('forecast waits for enough actual records and shows an empirical range',()=>{
 const target={difficulty:3,rewardValue:4,duration:14,season:'平季'};
 assert.equal(estimateParticipants(rows.slice(0,4),target).status,'insufficient');
 assert.equal(estimateParticipants(rows,{...target,season:''}).status,'invalid');
 const estimate=estimateParticipants(rows,target);
 assert.equal(estimate.status,'ready');
 assert.equal(estimate.similar.length,3);
 assert.ok(estimate.low<=estimate.center&&estimate.center<=estimate.high);
 assert.ok(estimate.high>estimate.low);
 const analysis=analyzeHistory(rows);
 assert.equal(analysis.trends.length,3);
 assert.match(analysis.message,/關聯/);
});
