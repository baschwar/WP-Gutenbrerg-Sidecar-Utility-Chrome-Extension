(function initTextReplace(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.WSU_WDS_TEXT_REPLACE = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function createMatcher(search, options = {}) {
    if (typeof search !== 'string' || !search.length) {
      return null;
    }

    const escaped = escapeRegExp(search);
    const wordCharacter = /[\p{L}\p{N}_]/u;
    const prefix = options.wholeWord && wordCharacter.test(search[0]) ? '(?<![\\p{L}\\p{N}_])' : '';
    const suffix = options.wholeWord && wordCharacter.test(search.at(-1)) ? '(?![\\p{L}\\p{N}_])' : '';
    return new RegExp(prefix + escaped + suffix, options.caseSensitive ? 'gu' : 'giu');
  }

  function replaceText(value, search, replacement, options = {}) {
    const matcher = createMatcher(search, options);

    if (!matcher || typeof value !== 'string') {
      return { value, count: 0, changedCount: 0 };
    }

    let count = 0;
    let changedCount = 0;
    const nextValue = value.replace(matcher, (match) => {
      count += 1;
      changedCount += Number(match !== replacement);
      return replacement;
    });

    return { value: nextValue, count, changedCount };
  }

  function countMatches(value, search, options = {}) {
    return replaceText(value, search, search, options).count;
  }

  function replaceOccurrence(value, search, replacement, occurrenceIndex, options = {}) {
    const matcher = createMatcher(search, options);

    if (!matcher || typeof value !== 'string' || !Number.isInteger(occurrenceIndex) || occurrenceIndex < 0) {
      return { value, count: 0, changedCount: 0 };
    }

    let seen = 0;
    let count = 0;
    let changedCount = 0;
    const nextValue = value.replace(matcher, (match) => {
      if (seen++ !== occurrenceIndex) {
        return match;
      }

      count = 1;
      changedCount = Number(match !== replacement);
      return replacement;
    });

    return { value: nextValue, count, changedCount };
  }

  return { countMatches, createMatcher, replaceOccurrence, replaceText };
});
