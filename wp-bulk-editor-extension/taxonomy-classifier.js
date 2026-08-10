((root, factory) => {
  const classifier = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = classifier;
  } else {
    root.WSU_WDS_TAXONOMY_CLASSIFIER = classifier;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const SOURCE_WEIGHTS = {
    title: 4,
    headings: 3,
    excerpt: 2,
    body: 1
  };

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function includesPhrase(text, phrase) {
    const normalizedText = ` ${normalizeText(text)} `;
    const normalizedPhrase = normalizeText(phrase);
    return Boolean(normalizedPhrase) && normalizedText.includes(` ${normalizedPhrase} `);
  }

  function classifyDocument(document, rules, options = {}) {
    const postType = document?.postType || '';

    if (document?.isRedirect) {
      return {
        skipped: true,
        reason: 'A redirect field is set. Destination content was not analyzed.',
        suggestions: []
      };
    }

    const sources = {
      title: document?.title || '',
      headings: Array.isArray(document?.headings) ? document.headings.join(' ') : '',
      excerpt: document?.excerpt || '',
      body: document?.body || ''
    };
    const suggestions = [];

    (Array.isArray(rules) ? rules : []).forEach((rule) => {
      if (!rule?.taxonomy || !rule?.slug) {
        return;
      }

      if (Array.isArray(rule.postTypes) && rule.postTypes.length && !rule.postTypes.includes(postType)) {
        return;
      }

      const combinedText = Object.values(sources).join(' ');
      const excludedBy = (rule.excludePhrases || []).find((phrase) => includesPhrase(combinedText, phrase));

      if (excludedBy) {
        return;
      }

      const matches = [];
      let score = rule.always ? 100 : 0;

      (rule.phrases || []).forEach((phrase) => {
        Object.entries(sources).forEach(([source, text]) => {
          if (!includesPhrase(text, phrase)) {
            return;
          }

          const weight = SOURCE_WEIGHTS[source] || 1;
          score += weight;
          matches.push({ phrase, source, weight });
        });
      });

      const threshold = Number.isFinite(rule.threshold) ? rule.threshold : 4;

      if (!rule.always && score < threshold) {
        return;
      }

      const reason = rule.reason || matches.map((match) => (
        `Matched “${match.phrase}” in ${match.source} (+${match.weight})`
      )).join('; ');

      suggestions.push({
        taxonomy: rule.taxonomy,
        slug: rule.slug,
        configuredLabel: rule.label || rule.slug,
        parentSlug: rule.parentSlug || '',
        score,
        reason,
        matches
      });
    });

    suggestions.sort((left, right) => (
      right.score - left.score
      || left.taxonomy.localeCompare(right.taxonomy)
      || left.configuredLabel.localeCompare(right.configuredLabel)
    ));

    return {
      skipped: false,
      reason: suggestions.length ? '' : (options.noMatchReason || 'No reviewed rule met its threshold.'),
      suggestions
    };
  }

  return {
    SOURCE_WEIGHTS,
    classifyDocument,
    includesPhrase,
    normalizeText
  };
});
