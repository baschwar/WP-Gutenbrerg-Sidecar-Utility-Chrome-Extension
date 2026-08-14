const assert = require('node:assert/strict');
const test = require('node:test');

const textReplace = require('../wp-bulk-editor-extension/text-replace.js');

test('literal replacement treats regular-expression characters as ordinary text', () => {
  const result = textReplace.replaceText('Use (draft) and (draft).', '(draft)', 'final');

  assert.equal(result.value, 'Use final and final.');
  assert.equal(result.count, 2);
});

test('matching is case-insensitive by default and can match case exactly', () => {
  assert.equal(textReplace.countMatches('Nursing nursing NURSING', 'nursing'), 3);
  assert.equal(textReplace.countMatches('Nursing nursing NURSING', 'nursing', { caseSensitive: true }), 1);
});

test('whole-word matching does not replace text inside a longer word', () => {
  const result = textReplace.replaceText('post postdoctoral post', 'post', 'page', { wholeWord: true });

  assert.equal(result.value, 'page postdoctoral page');
  assert.equal(result.count, 2);
});

test('whole-word matching supports searches that begin or end with punctuation', () => {
  const result = textReplace.replaceText('(draft) draft', '(draft)', 'final', { wholeWord: true });

  assert.equal(result.value, 'final draft');
  assert.equal(result.count, 1);
});

test('replaceOccurrence changes only the selected zero-based match', () => {
  const result = textReplace.replaceOccurrence('one ONE one', 'one', 'two', 1);

  assert.equal(result.value, 'one two one');
  assert.equal(result.count, 1);
  assert.equal(result.changedCount, 1);
});

test('a replacement identical to the matched text is counted but not marked changed', () => {
  const result = textReplace.replaceText('same same', 'same', 'same', { caseSensitive: true });

  assert.equal(result.count, 2);
  assert.equal(result.changedCount, 0);
});
