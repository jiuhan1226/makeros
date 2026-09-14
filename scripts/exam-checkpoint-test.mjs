import assert from 'node:assert/strict';
import { buildExamCheckpoint, examCheckpointMeta } from '../src/utils/examCheckpoint.js';

const questions = Array.from({ length: 1200 }, (_, index) => ({ id: `q-${index}`, question: `문제 ${index}` }));
const checkpoint = buildExamCheckpoint({ exam: { title: '전체 문제', studyScope: 'all' }, questions, answers: { 0: 1, 18: 2 }, current: 18, savedAt: 1234 });
assert.equal(checkpoint.questions.length, 1200, '전체 문제는 잘리지 않은 체크포인트로 만들어져야 합니다.');
const meta = examCheckpointMeta(checkpoint);
assert.equal(meta.total, 1200);
assert.equal(meta.answered, 2);
assert.equal(Object.hasOwn(meta, 'questions'), false, 'localStorage 메타 정보에는 전체 문제 배열을 저장하면 안 됩니다.');
assert.ok(JSON.stringify(meta).length < 1000, 'localStorage 메타 정보는 작게 유지해야 합니다.');
console.log('[exam-checkpoint-test] OK');
