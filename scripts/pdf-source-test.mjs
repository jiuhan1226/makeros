import assert from 'node:assert/strict';
import { sourcePageLabel, sourcePageNumbers } from '../src/utils/pdfSource.js';
import { readPdfLibrary, upsertPdfDocument } from '../src/utils/studyPlatform.js';

assert.deepEqual(sourcePageNumbers({ sourcePages: [7, 3, 7] }), [3, 7]);
assert.equal(sourcePageLabel({ sourcePages: [3, 4, 5] }), '3~5쪽');
assert.equal(sourcePageLabel({ sourcePages: [3, 5] }), '3·5쪽');
assert.equal(sourcePageLabel({ evidencePage: 12 }), '12쪽');
const values = new Map();
globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
globalThis.window = { dispatchEvent: () => {} };
upsertPdfDocument({ id: 'first', name: '교재.pdf', pages: [{ page: 1, text: '첫 번째 내용' }] });
upsertPdfDocument({ id: 'second', name: '교재.pdf', pages: [{ page: 1, text: '두 번째 내용' }] });
assert.equal(readPdfLibrary().length, 2, '이름이 같은 서로 다른 PDF는 모두 남아야 합니다.');
delete globalThis.window;
delete globalThis.localStorage;
console.log('[pdf-source-test] OK');
