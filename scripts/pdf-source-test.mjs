import assert from 'node:assert/strict';
import { sourcePageLabel, sourcePageNumbers } from '../src/utils/pdfSource.js';

assert.deepEqual(sourcePageNumbers({ sourcePages: [7, 3, 7] }), [3, 7]);
assert.equal(sourcePageLabel({ sourcePages: [3, 4, 5] }), '3~5쪽');
assert.equal(sourcePageLabel({ sourcePages: [3, 5] }), '3·5쪽');
assert.equal(sourcePageLabel({ evidencePage: 12 }), '12쪽');
console.log('[pdf-source-test] OK');
