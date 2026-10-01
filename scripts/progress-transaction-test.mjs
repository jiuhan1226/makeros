// Exercise the production Firestore adapter with a transaction double; no live credentials.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeLearningProgress, resolveLearningType } from '../src/utils/learningEngine.js';
import { normalizeQuestionTopic } from '../src/utils/topicClassifier.js';
const source=readFileSync(new URL('../src/firebase.js',import.meta.url),'utf8');
const body=source.slice(source.indexOf('export async function saveQuestionProgress('),source.indexOf('export async function getTodayReviewProgress(')).replace('export ','');
const documents=new Map();
let failCommit=false;
let retryTransaction=false;
let queue=Promise.resolve();
const runTransaction=(_db, callback)=> {
  const run=async()=>{
    const execute=async()=>{
      const writes=[];
      const result=await callback({
        get:async key=>{assert.equal(writes.length,0,'모든 읽기는 쓰기 전');return {exists:()=>documents.has(key),data:()=>documents.get(key)};},
        set:(key,value)=>writes.push([key,value]),
      });
      return {result,writes};
    };
    if(retryTransaction) {retryTransaction=false;await execute();}
    const {result,writes}=await execute();
    if(failCommit) throw new Error('commit failed');
    writes.forEach(([key,value])=>documents.set(key,value));
    return result;
  };
  const promise=queue.catch(()=>{}).then(run);queue=promise;return promise;
};
const timestamp=n=>({seconds:n/1000,toMillis:()=>n});
const deps={db:{},doc:(_db,...parts)=>parts.join('/'),normalizeQuestionTopic,resolveLearningType,mergeLearningProgress,
  sanitizeDocumentId:x=>x,runTransaction,Timestamp:{fromMillis:timestamp},serverTimestamp:()=>timestamp(Date.now())};
const save=new Function(...Object.keys(deps),`${body};return saveQuestionProgress;`)(...Object.values(deps));
const question={id:'q1',question:'전류를 구하는 식은?',choices:['V/R','V*R'],answerIndex:0,subject:'회로'};
const payload={uid:'test-user',question,exam:{id:'exam',certificateId:'c1'},mode:'연습모드',attemptId:'a',selectedAnswerIndex:1,isCorrect:false,confidence:'low'};
await save(payload);
const key='users/test-user/cbtPracticeProgress/q1';
assert.equal(documents.size,2,'문제 집계와 원본 풀이를 함께 저장');
assert.equal(documents.get(key).wrongCount,1);
retryTransaction=true;
await save({...payload,isCorrect:true,selectedAnswerIndex:0,confidence:'high'});
assert.equal(documents.get(key).attemptCount,1);
assert.equal(documents.get(key).correctCount,1);
assert.equal(documents.get(key).wrongCount,0);
assert.equal(documents.get(key).question,question.question,'계정 기록에도 내용·보기·이미지 정보를 보존');
await Promise.all([save({...payload,attemptId:'b'}),save({...payload,attemptId:'c'})]);
assert.equal(documents.get(key).attemptCount,3);
const beforeReplay=documents.get(key);
await save(payload);
assert.strictEqual(documents.get(key),beforeReplay,'이전 attempt 재전송은 집계를 수정하지 않는다');
failCommit=true;
await assert.rejects(save({...payload,attemptId:'d'}),/commit failed/);
assert.strictEqual(documents.get(key),beforeReplay);
assert.ok(!documents.has('users/test-user/cbtAttempts/d'),'집계 또는 풀이 이벤트 하나만 저장되는 부분 성공 금지');
console.log('[progress-transaction] adapter retry, replay, atomic failure, shared grading passed (mock Firestore)');
