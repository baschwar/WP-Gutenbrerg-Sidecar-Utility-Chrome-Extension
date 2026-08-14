const assert = require('node:assert/strict');
const test = require('node:test');

const emailLink = require('../wp-bulk-editor-extension/email-link.js');

test('builds action-and-recipient text from a dot-separated personal address', () => {
  assert.deepEqual(
    emailLink.replacementForLink('kathleen.finch@wsu.edu', 'mailto:kathleen.finch@wsu.edu'),
    {
      address: 'kathleen.finch@wsu.edu',
      recipient: 'Kathleen Finch',
      text: 'Email Kathleen Finch'
    }
  );
});

test('preserves mailto query parameters while deriving the recipient from the address', () => {
  assert.equal(
    emailLink.replacementForLink('Email', 'mailto:kathleen.finch@wsu.edu?subject=Vancouver%20MN%2FDNP')?.text,
    'Email Kathleen Finch'
  );
});

test('adds the email action when the visible link is only the recipient name', () => {
  assert.equal(
    emailLink.replacementForLink('Kathleen Finch', 'mailto:kathleen.finch@wsu.edu')?.text,
    'Email Kathleen Finch'
  );
});

test('does not change an already descriptive email link', () => {
  assert.equal(
    emailLink.replacementForLink('Email Kathleen Finch', 'mailto:kathleen.finch@wsu.edu'),
    null
  );
});

test('uses a capitalized mailbox name for department and business addresses', () => {
  assert.equal(
    emailLink.replacementForLink('development@wsu.edu', 'mailto:development@wsu.edu')?.text,
    'Email Development'
  );
  assert.equal(
    emailLink.replacementForLink('nursing@wsu.edu', 'mailto:nursing@wsu.edu')?.text,
    'Email Nursing'
  );
});

test('does not rewrite meaningful custom link text', () => {
  assert.equal(
    emailLink.replacementForLink('Schedule an advising appointment', 'mailto:kathleen.finch@wsu.edu'),
    null
  );
});
