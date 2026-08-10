const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const classifier = require('../wp-bulk-editor-extension/taxonomy-classifier.js');
const config = require('../wp-bulk-editor-extension/taxonomy-rules.js');

const fixturePath = path.join(__dirname, 'fixtures', 'taxonomy-examples.json');
const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

fixtures.forEach((fixture) => {
  test(fixture.name, () => {
    const result = classifier.classifyDocument(fixture.document, config.rules);
    const keys = result.suggestions.map((suggestion) => suggestion.taxonomy + ':' + suggestion.slug);

    fixture.expected.forEach((key) => {
      assert.ok(keys.includes(key), `Expected ${key}; received ${keys.join(', ')}`);
    });

    fixture.excluded.forEach((key) => {
      assert.ok(!keys.includes(key), `Did not expect ${key}; received ${keys.join(', ')}`);
    });

    if (fixture.document.isRedirect) {
      assert.equal(result.skipped, true);
      assert.deepEqual(result.suggestions, []);
    }
  });
});

test('normalization is case and punctuation insensitive without substring matching', () => {
  assert.equal(classifier.includesPhrase('A PMHNP opportunity', 'pmhnp'), true);
  assert.equal(classifier.includesPhrase('Undergraduate researchers', 'graduate'), false);
});
