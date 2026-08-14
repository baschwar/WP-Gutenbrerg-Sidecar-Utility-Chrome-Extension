(() => {
  if (window.__WSU_WDS_PAGE_BRIDGE__) {
    return;
  }

  window.__WSU_WDS_PAGE_BRIDGE__ = true;

  function getEditorBlocks() {
    const blockEditor = window.wp?.data?.select('core/block-editor');
    return blockEditor?.getBlocks?.() || [];
  }

  function collectBlocks(blocks, predicate, matches = []) {
    blocks.forEach((block) => {
      if (predicate(block)) {
        matches.push(block);
      }

      if (block.innerBlocks?.length) {
        collectBlocks(block.innerBlocks, predicate, matches);
      }
    });

    return matches;
  }

  function editorValueToText(value) {
    if (typeof value === 'string') {
      return getTextContentFromHtml(value);
    }

    if (value && typeof value === 'object') {
      return getTextContentFromHtml(value.raw || value.rendered || '');
    }

    return '';
  }

  function collectTaxonomyDocumentText(blocks, result = { headings: [], body: [] }) {
    const textAttributeKeys = ['body', 'caption', 'citation', 'content', 'description', 'text', 'value'];

    blocks.forEach((block) => {
      const values = textAttributeKeys.map((key) => block.attributes?.[key]).filter((value) => typeof value === 'string');
      const blockText = values.map(editorValueToText).filter(Boolean).join(' ');

      if (block.name === 'core/heading' && blockText) {
        result.headings.push(blockText);
      } else if (blockText) {
        result.body.push(blockText);
      }

      if (block.innerBlocks?.length) {
        collectTaxonomyDocumentText(block.innerBlocks, result);
      }
    });

    return result;
  }

  function getRedirectMeta(meta) {
    if (!meta || typeof meta !== 'object') {
      return null;
    }

    return Object.entries(meta).find(([key, value]) => {
      return /(?:redirect|external(?:_|-)url|links?(?:_|-)to)/i.test(key)
        && typeof value === 'string'
        && /^https?:\/\//i.test(value.trim());
    }) || null;
  }

  function getTaxonomyAnalysisDocument() {
    const editorSelect = window.wp?.data?.select('core/editor');
    const postType = editorSelect?.getCurrentPostType?.() || '';
    const blockText = collectTaxonomyDocumentText(getEditorBlocks());
    const redirectMeta = getRedirectMeta(editorSelect?.getEditedPostAttribute?.('meta'));

    return {
      postType,
      title: editorValueToText(editorSelect?.getEditedPostAttribute?.('title')),
      excerpt: editorValueToText(editorSelect?.getEditedPostAttribute?.('excerpt')),
      headings: blockText.headings,
      body: blockText.body.join(' '),
      isRedirect: Boolean(redirectMeta),
      redirectMetaKey: redirectMeta?.[0] || ''
    };
  }

  function getTaxonomyFields(config) {
    const labels = new Map((config?.managedTaxonomies || []).map((item) => [item.slug, item.label]));
    const fields = new Map();

    document.querySelectorAll('select[name^="tax_input["]').forEach((select) => {
      const match = select.name.match(/^tax_input\[([^\]]+)\]/);
      const taxonomy = match?.[1] || '';

      if (!labels.has(taxonomy)) {
        return;
      }

      fields.set(taxonomy, {
        taxonomy,
        label: labels.get(taxonomy) || taxonomy,
        select,
        options: Array.from(select.options)
      });
    });

    return fields;
  }

  function getDocumentSources(document) {
    return {
      title: document.title || '',
      headings: (document.headings || []).join(' '),
      excerpt: document.excerpt || '',
      body: document.body || ''
    };
  }

  function scoreTermNames(document, names, classifier) {
    const sources = getDocumentSources(document);
    const matches = [];
    let score = 0;

    (names || []).forEach((name) => {
      Object.entries(sources).forEach(([source, text]) => {
        if (!classifier.includesPhrase(text, name)) {
          return;
        }

        const weight = classifier.SOURCE_WEIGHTS?.[source] || 1;
        score += weight;
        matches.push({ name, source, weight });
      });
    });

    return { score, matches };
  }

  function optionName(option) {
    return (option?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function findOptionByName(field, name, classifier) {
    const normalizedName = classifier.normalizeText(name);
    return field?.options.find((option) => classifier.normalizeText(optionName(option)) === normalizedName) || null;
  }

  function getExistingTaxonomyAssignments(fields) {
    const existing = [];

    fields.forEach((field) => {
      field.options.filter((option) => option.selected).forEach((option) => {
        existing.push({
          taxonomy: field.taxonomy,
          taxonomyLabel: field.label,
          name: optionName(option),
          termKey: String(option.value)
        });
      });
    });

    return existing;
  }

  function addTaxonomyCandidate(state, candidate) {
    const field = state.fields.get(candidate.taxonomy);
    const option = findOptionByName(field, candidate.termName, state.classifier);

    if (!field || !option) {
      state.missing.add(candidate.taxonomy + ': ' + candidate.termName);
      return;
    }

    const key = candidate.taxonomy + ':' + String(option.value);

    if (state.seen.has(key)) {
      const existingCandidate = state.suggestions.find((item) => item.key === key);
      if (existingCandidate && candidate.checked) {
        existingCandidate.checked = true;
      }
      return;
    }

    if (option.selected && !state.replaceExisting && !candidate.showWhenAssigned) {
      return;
    }

    state.seen.add(key);
    state.suggestions.push({
      key,
      taxonomy: candidate.taxonomy,
      taxonomyLabel: field.label,
      name: optionName(option),
      termKey: String(option.value),
      score: candidate.score || 0,
      reason: candidate.reason || 'Matched a reviewed local rule.',
      checked: candidate.checked !== false,
      alreadyAssigned: option.selected
    });
  }

  function addConfiguredDefaults(state, config, postType) {
    (config.defaults || []).filter((item) => (
      !item.postTypes?.length || item.postTypes.includes(postType)
    )).forEach((item) => {
      addTaxonomyCandidate(state, {
        taxonomy: item.taxonomy,
        termName: item.termName,
        score: 100,
        reason: item.reason,
        checked: true
      });
    });
  }

  function addUniversityCategoryMatches(state, document) {
    const field = state.fields.get('wsuwp_university_category');

    if (!field) {
      return;
    }

    const nameCounts = new Map();
    field.options.forEach((option) => {
      const normalized = state.classifier.normalizeText(optionName(option));
      nameCounts.set(normalized, (nameCounts.get(normalized) || 0) + 1);
    });

    field.options.forEach((option) => {
      const name = optionName(option);
      const normalized = state.classifier.normalizeText(name);

      if (!name || nameCounts.get(normalized) !== 1) {
        return;
      }

      const result = scoreTermNames(document, [name], state.classifier);
      const wordCount = normalized.split(' ').filter(Boolean).length;
      const threshold = wordCount === 1 ? 3 : 2;

      if (result.score < threshold) {
        return;
      }

      addTaxonomyCandidate(state, {
        taxonomy: field.taxonomy,
        termName: name,
        score: result.score,
        reason: result.matches.map((match) => (
          'Matched “' + match.name + '” in ' + match.source + ' (+' + match.weight + ')'
        )).join('; '),
        checked: true
      });
    });
  }

  function addLocationAndOrganizationMatches(state, document, config) {
    const locationField = state.fields.get('wsuwp_university_location');
    const defaultLocationNames = new Set((config.defaults || []).filter((item) => (
      item.taxonomy === 'wsuwp_university_location'
    )).map((item) => state.classifier.normalizeText(item.termName)));

    locationField?.options.forEach((option) => {
      const name = optionName(option);

      if (defaultLocationNames.has(state.classifier.normalizeText(name))) {
        return;
      }

      const aliases = config.locationAliases?.[name] || [name];
      const result = scoreTermNames(document, aliases, state.classifier);

      if (!result.score) {
        return;
      }

      addTaxonomyCandidate(state, {
        taxonomy: locationField.taxonomy,
        termName: name,
        score: result.score,
        reason: result.matches.map((match) => (
          'Matched location “' + match.name + '” in ' + match.source
        )).join('; '),
        checked: true
      });
    });

    const organizationField = state.fields.get('wsuwp_university_org');
    const defaultOrganizationNames = new Set((config.defaults || []).filter((item) => (
      item.taxonomy === 'wsuwp_university_org'
    )).map((item) => state.classifier.normalizeText(item.termName)));

    organizationField?.options.forEach((option) => {
      const name = optionName(option);

      if (defaultOrganizationNames.has(state.classifier.normalizeText(name))) {
        return;
      }

      const result = scoreTermNames(document, [name], state.classifier);

      if (!result.score) {
        return;
      }

      addTaxonomyCandidate(state, {
        taxonomy: organizationField.taxonomy,
        termName: name,
        score: result.score,
        reason: 'Matched the full organization name in the open post.',
        checked: true
      });
    });
  }

  function addHomepageAudienceCandidates(state, classification, existing, config, enabled, postType) {
    if (!enabled || postType !== 'post') {
      return;
    }

    const existingCategoryNames = new Set(existing.filter((item) => item.taxonomy === 'category').map((item) => (
      state.classifier.normalizeText(item.name)
    )));
    const matchedCategoryNames = new Set(classification.suggestions.filter((item) => item.taxonomy === 'category').map((item) => (
      state.classifier.normalizeText(item.configuredLabel)
    )));
    const existingTagNames = new Set(existing.filter((item) => item.taxonomy === 'post_tag').map((item) => (
      state.classifier.normalizeText(item.name)
    )));

    (config.homepageAudiences || []).forEach((audience) => {
      const categoryName = state.classifier.normalizeText(audience.categoryName);
      const tagName = state.classifier.normalizeText(audience.tagName);
      const inferred = existingCategoryNames.has(categoryName) || matchedCategoryNames.has(categoryName);
      const alreadyTagged = existingTagNames.has(tagName);

      addTaxonomyCandidate(state, {
        taxonomy: 'post_tag',
        termName: audience.tagName,
        score: inferred ? 100 : 0,
        reason: inferred
          ? audience.categoryName + ' is assigned or suggested as a Site Category for the homepage News feed.'
          : 'Homepage News is enabled. Check this audience only if it applies.',
        checked: inferred || alreadyTagged,
        showWhenAssigned: true
      });
    });
  }

  function hasVisibleRedirectValue() {
    return Array.from(document.querySelectorAll('input, textarea')).some((field) => {
      const identity = [field.id, field.name, field.getAttribute('aria-label')].filter(Boolean).join(' ');
      return /(?:redirect|links?(?:_|\s|-)to)/i.test(identity) && /^https?:\/\//i.test((field.value || '').trim());
    });
  }

  async function analyzeTaxonomySuggestions(payload) {
    const classifier = window.WSU_WDS_TAXONOMY_CLASSIFIER;
    const config = window.WSU_WDS_TAXONOMY_CONFIG;

    if (!window.wp?.data || !classifier?.classifyDocument || !Array.isArray(config?.rules)) {
      return {
        ok: false,
        message: 'The local category and tag analyzer is unavailable.',
        suggestions: []
      };
    }

    const document = getTaxonomyAnalysisDocument();
    document.isRedirect = document.isRedirect || hasVisibleRedirectValue();

    if (!document.postType) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.', suggestions: [] };
    }

    const classification = classifier.classifyDocument(document, config.rules);

    if (classification.skipped) {
      return {
        ok: true,
        message: 'No category or tag suggestions were made for this redirect post.',
        suggestions: [],
        details: classification.reason + (document.redirectMetaKey ? '\nDetected field: ' + document.redirectMetaKey : '')
      };
    }

    const fields = getTaxonomyFields(config);

    if (!fields.size) {
      return {
        ok: false,
        message: 'Could not find the WSU taxonomy panels in this editor.',
        suggestions: [],
        details: 'Reload the WordPress editor tab after reloading the extension.'
      };
    }

    const existing = getExistingTaxonomyAssignments(fields);
    const state = {
      classifier,
      fields,
      missing: new Set(),
      replaceExisting: Boolean(payload?.replaceExisting),
      seen: new Set(),
      suggestions: []
    };

    classification.suggestions.forEach((suggestion) => {
      addTaxonomyCandidate(state, {
        taxonomy: suggestion.taxonomy,
        termName: suggestion.configuredLabel,
        score: suggestion.score,
        reason: suggestion.reason,
        checked: true
      });
    });
    addConfiguredDefaults(state, config, document.postType);
    addUniversityCategoryMatches(state, document);
    addLocationAndOrganizationMatches(state, document, config);
    addHomepageAudienceCandidates(
      state,
      classification,
      existing,
      config,
      Boolean(payload?.homepageNews),
      document.postType
    );

    state.suggestions.sort((left, right) => (
      right.score - left.score
      || left.taxonomyLabel.localeCompare(right.taxonomyLabel)
      || left.name.localeCompare(right.name)
    ));

    const details = [];

    if (existing.length) {
      details.push((state.replaceExisting
        ? 'Existing assignments will be cleared unless represented by a checked suggestion below:\n'
        : 'Existing assignments preserved:\n') + existing.map((item) => (
        '- ' + item.taxonomyLabel + ': ' + item.name
      )).join('\n'));
    }

    if (state.missing.size) {
      details.push('Reviewed terms not available in the visible taxonomy panels:\n- ' + Array.from(state.missing).join('\n- '));
    }

    if (!state.suggestions.length) {
      details.push(classification.reason || 'All matched terms are already assigned or unavailable.');
    }

    return {
      ok: true,
      message: state.suggestions.length
        ? 'Found ' + state.suggestions.length + ' existing taxonomy suggestion' + (state.suggestions.length === 1 ? '' : 's') + '. Review before applying.'
        : 'No new category or tag suggestions met the reviewed rules.',
      suggestions: state.suggestions,
      existing,
      details: details.join('\n\n')
    };
  }

  async function applyTaxonomySuggestions(payload) {
    const config = window.WSU_WDS_TAXONOMY_CONFIG;
    const selections = Array.isArray(payload?.selections) ? payload.selections.slice(0, 50) : [];
    const replaceExisting = Boolean(payload?.replaceExisting);

    if (!window.wp?.data || !Array.isArray(config?.rules)) {
      return { ok: false, message: 'The local category and tag analyzer is unavailable.' };
    }

    if (!selections.length) {
      return {
        ok: false,
        message: replaceExisting
          ? 'Replacement requires at least one checked suggestion.'
          : 'No checked category or tag suggestions to apply.'
      };
    }

    if (replaceExisting && payload?.replacementConfirmation !== 'REPLACE_EXISTING_TAXONOMIES') {
      return { ok: false, message: 'Replacement was not confirmed. Existing taxonomy selections were preserved.' };
    }

    const fields = getTaxonomyFields(config);
    const targets = new Set();

    selections.forEach((selection) => {
      const field = fields.get(selection?.taxonomy);
      const option = field?.options.find((item) => (
        String(item.value) === String(selection?.termKey)
        && optionName(item) === selection?.name
      ));

      if (option) {
        targets.add(field.taxonomy + ':' + String(option.value));
      }
    });

    const added = [];
    const removed = [];

    fields.forEach((field) => {
      let fieldChanged = false;

      field.options.forEach((option) => {
        const key = field.taxonomy + ':' + String(option.value);
        const shouldSelect = targets.has(key) || (!replaceExisting && option.selected);

        if (option.selected === shouldSelect) {
          return;
        }

        if (shouldSelect) {
          added.push(field.label + ': ' + optionName(option));
        } else {
          removed.push(field.label + ': ' + optionName(option));
        }

        option.selected = shouldSelect;
        fieldChanged = true;
      });

      if (fieldChanged) {
        field.select.dispatchEvent(new Event('input', { bubbles: true }));
        field.select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    if (!added.length && !removed.length) {
      return {
        ok: true,
        message: 'No taxonomy selections changed.',
        details: 'The checked terms were already selected or unavailable. Post was not saved.'
      };
    }

    const details = [];

    if (added.length) {
      details.push('Selected:\n' + added.map((change) => '- ' + change).join('\n'));
    }

    if (removed.length) {
      details.push('Cleared:\n' + removed.map((change) => '- ' + change).join('\n'));
    }

    return {
      ok: true,
      message: (replaceExisting ? 'Replaced' : 'Updated') + ' taxonomy selections in the open editor. Post was not saved.',
      details: details.join('\n\n') + '\n\nReview the visible WordPress taxonomy panels and save when ready.'
    };
  }

  function makeAllHeadingsH2() {
    if (!window.wp?.data) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.' };
    }

    const headingBlocks = collectBlocks(getEditorBlocks(), (block) => block.name === 'core/heading');
    const changedBlocks = headingBlocks.filter((block) => block.attributes?.level !== 2);

    changedBlocks.forEach((block) => {
      window.wp.data.dispatch('core/block-editor').updateBlockAttributes(block.clientId, { level: 2 });
    });

    return {
      ok: true,
      message: `Changed ${changedBlocks.length} heading block${changedBlocks.length === 1 ? '' : 's'} to H2.`,
      details: `Found ${headingBlocks.length} heading block${headingBlocks.length === 1 ? '' : 's'} in post content. Post title was not touched.`
    };
  }

  function isHeadingLevel(value) {
    return Number.isInteger(value) && value >= 1 && value <= 6;
  }

  function getHeadingLevel(block) {
    return block.attributes?.level || 2;
  }

  function changeHeadingLevel(payload) {
    if (!window.wp?.data) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.' };
    }

    const fromLevel = Number.parseInt(payload?.fromLevel, 10);
    const toLevel = Number.parseInt(payload?.toLevel, 10);

    if (!isHeadingLevel(fromLevel) || !isHeadingLevel(toLevel)) {
      return { ok: false, message: 'Choose heading levels from H1 through H6.' };
    }

    if (fromLevel === toLevel) {
      return { ok: true, message: 'No heading levels changed.', details: 'From and To are both H' + fromLevel + '.' };
    }

    const headingBlocks = collectBlocks(getEditorBlocks(), (block) => block.name === 'core/heading');
    const matchingBlocks = headingBlocks.filter((block) => getHeadingLevel(block) === fromLevel);

    matchingBlocks.forEach((block) => {
      window.wp.data.dispatch('core/block-editor').updateBlockAttributes(block.clientId, {
        level: toLevel
      });
    });

    return {
      ok: true,
      message: 'Changed ' + matchingBlocks.length + ' H' + fromLevel + ' heading' + (matchingBlocks.length === 1 ? '' : 's') + ' to H' + toLevel + '.',
      details: matchingBlocks.length
        ? matchingBlocks.map((block) => 'Changed: ' + getTextContentFromHtml(block.attributes?.content || 'Heading')).join('\n')
        : 'No H' + fromLevel + ' heading blocks were found. Post title was not touched.'
    };
  }

  function scanHeadingBlocks() {
    if (!window.wp?.data) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.', items: [] };
    }

    const headingBlocks = collectBlocks(getEditorBlocks(), (block) => block.name === 'core/heading');
    const items = headingBlocks.map((block) => ({
      clientId: block.clientId,
      level: getHeadingLevel(block),
      text: getTextContentFromHtml(block.attributes?.content || 'Heading')
    }));

    return {
      ok: true,
      message: 'Found ' + items.length + ' heading block' + (items.length === 1 ? '' : 's') + '.',
      items,
      details: items.length
        ? items.map((item) => 'H' + item.level + ': ' + item.text).join('\n')
        : 'No heading blocks were found in post content. Post title was not included.'
    };
  }

  function changeSelectedHeadingBlocks(payload) {
    if (!window.wp?.data) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.' };
    }

    const targetLevel = Number.parseInt(payload?.targetLevel, 10);
    const clientIds = Array.isArray(payload?.clientIds) ? payload.clientIds : [];

    if (!isHeadingLevel(targetLevel)) {
      return { ok: false, message: 'Choose a heading level from H1 through H6.' };
    }

    if (!clientIds.length) {
      return { ok: true, message: 'No checked heading blocks to change.' };
    }

    const targetIds = new Set(clientIds);
    const headingBlocks = collectBlocks(getEditorBlocks(), (block) => {
      return block.name === 'core/heading' && targetIds.has(block.clientId);
    });

    const changes = headingBlocks.map((block) => ({
      fromLevel: getHeadingLevel(block),
      text: getTextContentFromHtml(block.attributes?.content || 'Heading')
    }));

    headingBlocks.forEach((block) => {
      window.wp.data.dispatch('core/block-editor').updateBlockAttributes(block.clientId, {
        level: targetLevel
      });
    });

    return {
      ok: true,
      message: 'Changed ' + headingBlocks.length + ' selected heading block' + (headingBlocks.length === 1 ? '' : 's') + ' to H' + targetLevel + '.',
      details: changes.length
        ? changes.map((change) => 'H' + change.fromLevel + ' -> H' + targetLevel + ': ' + change.text).join('\n')
        : 'No matching checked heading blocks were found. Scan again if the editor content changed.'
    };
  }

  function applyH2FontSize(payload) {
    const fontSize = payload?.fontSize || '';
    const wsuFontSizeClass = /(?:^|\s)wsu-font-size--[^\s]+/g;

    function toClassSuffix(value) {
      return value ? value.toLowerCase() : '';
    }

    function updateClassName(className, value) {
      const withoutFontSize = (className || '').replace(wsuFontSizeClass, ' ').trim();
      const nextFontSizeClass = value ? `wsu-font-size--${toClassSuffix(value)}` : '';
      return [withoutFontSize, nextFontSizeClass].filter(Boolean).join(' ');
    }

    if (!window.wp?.data) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.' };
    }

    const h2Blocks = collectBlocks(
      getEditorBlocks(),
      (block) => block.name === 'core/heading' && block.attributes?.level === 2
    );

    h2Blocks.forEach((block) => {
      window.wp.data.dispatch('core/block-editor').updateBlockAttributes(block.clientId, {
        className: updateClassName(block.attributes?.className, fontSize)
      });
    });

    return {
      ok: true,
      message: `Updated ${h2Blocks.length} H2 block${h2Blocks.length === 1 ? '' : 's'}.`,
      details: fontSize
        ? `Updated Advanced class: wsu-font-size--${toClassSuffix(fontSize)}`
        : 'Removed WSU font-size class from H2 blocks.'
    };
  }

  function inspectSelectedBlock() {
    const wsuFontSizeClass = /(?:^|\s)wsu-font-size--[^\s]+/g;

    if (!window.wp?.data) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.', details: '' };
    }

    const block = window.wp.data.select('core/block-editor')?.getSelectedBlock?.();

    if (!block) {
      return { ok: false, message: 'Select one heading block first.', details: '' };
    }

    return {
      ok: true,
      message: `Selected block: ${block.name}`,
      details: JSON.stringify({
        name: block.name,
        clientId: block.clientId,
        fontSizeClasses: (block.attributes?.className || '').match(wsuFontSizeClass) || [],
        className: block.attributes?.className || '',
        attributes: block.attributes
      }, null, 2)
    };
  }

  const richTextAttributeKeys = [
    'body',
    'caption',
    'citation',
    'content',
    'foot',
    'head',
    'html',
    'text',
    'value'
  ];

  function getTextReplaceEngine() {
    return window.WSU_WDS_TEXT_REPLACE;
  }

  function textSearchOptions(payload = {}) {
    return {
      caseSensitive: Boolean(payload.caseSensitive),
      wholeWord: Boolean(payload.wholeWord)
    };
  }

  function replaceVisibleText(value, search, replacement, options = {}) {
    const engine = getTextReplaceEngine();

    if (!engine || typeof value !== 'string') {
      return { value, count: 0, changedCount: 0 };
    }

    if (!/<[a-z!/][^>]*>/i.test(value)) {
      return engine.replaceText(value, search, replacement, options);
    }

    const template = document.createElement('template');
    template.innerHTML = value;
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    let count = 0;
    let changedCount = 0;
    let node = walker.nextNode();

    while (node) {
      const result = engine.replaceText(node.nodeValue || '', search, replacement, options);

      if (result.changedCount) {
        node.nodeValue = result.value;
      }

      count += result.count;
      changedCount += result.changedCount;

      node = walker.nextNode();
    }

    return { value: changedCount ? template.innerHTML : value, count, changedCount };
  }

  function replaceVisibleTextOccurrence(value, search, replacement, occurrenceIndex, options = {}) {
    const engine = getTextReplaceEngine();

    if (!engine || typeof value !== 'string') {
      return { value, count: 0, changedCount: 0 };
    }

    if (!/<[a-z!/][^>]*>/i.test(value)) {
      const result = engine.replaceOccurrence(value, search, replacement, occurrenceIndex, options);
      return {
        ...result,
        count: result.changedCount,
        matched: result.count
      };
    }

    const template = document.createElement('template');
    template.innerHTML = value;
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    let remainingIndex = occurrenceIndex;
    let node = walker.nextNode();

    while (node) {
      const nodeValue = node.nodeValue || '';
      const nodeCount = engine.countMatches(nodeValue, search, options);

      if (remainingIndex < nodeCount) {
        const result = engine.replaceOccurrence(nodeValue, search, replacement, remainingIndex, options);

        if (result.count) {
          if (result.changedCount) {
            node.nodeValue = result.value;
          }
          return {
            value: result.changedCount ? template.innerHTML : value,
            count: result.changedCount,
            matched: 1,
            changedCount: result.changedCount
          };
        }
      }

      remainingIndex -= nodeCount;
      node = walker.nextNode();
    }

    return { value, count: 0, matched: 0, changedCount: 0 };
  }

  function walkTextLeafValues(value, visitor, path = []) {
    if (typeof value === 'string') {
      visitor(value, path);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => walkTextLeafValues(item, visitor, [...path, index]));
      return;
    }

    if (value && typeof value === 'object') {
      Object.keys(value).forEach((key) => walkTextLeafValues(value[key], visitor, [...path, key]));
    }
  }

  function transformSelectedTextLeaves(value, selectedPaths, search, replacement, options, path = []) {
    if (typeof value === 'string') {
      if (!selectedPaths.has(JSON.stringify(path))) {
        return { value, count: 0 };
      }

      return replaceVisibleText(value, search, replacement, options);
    }

    if (Array.isArray(value)) {
      let count = 0;
      const nextValue = value.map((item, index) => {
        const result = transformSelectedTextLeaves(item, selectedPaths, search, replacement, options, [...path, index]);
        count += result.changedCount ?? result.count;
        return result.value;
      });
      return { value: count ? nextValue : value, count };
    }

    if (value && typeof value === 'object') {
      let count = 0;
      const nextValue = { ...value };

      Object.keys(value).forEach((key) => {
        const result = transformSelectedTextLeaves(value[key], selectedPaths, search, replacement, options, [...path, key]);
        count += result.changedCount ?? result.count;
        nextValue[key] = result.value;
      });
      return { value: count ? nextValue : value, count };
    }

    return { value, count: 0 };
  }

  function textMatchPreviews(value, search, options) {
    let segments = [value];

    if (/<[a-z!/][^>]*>/i.test(value)) {
      const template = document.createElement('template');
      template.innerHTML = value;
      const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
      segments = [];
      let node = walker.nextNode();

      while (node) {
        segments.push(node.nodeValue || '');
        node = walker.nextNode();
      }
    }

    return segments.flatMap((segment) => {
      const matcher = getTextReplaceEngine()?.createMatcher(search, options);
      const previews = [];
      let match = matcher?.exec(segment);

      while (match) {
        const start = Math.max(0, match.index - 45);
        const end = Math.min(segment.length, match.index + match[0].length + 75);
        const preview = segment.slice(start, end).replace(/\s+/g, ' ');
        previews.push((start ? '…' : '') + preview + (end < segment.length ? '…' : ''));
        match = matcher.exec(segment);
      }

      return previews;
    });
  }

  function scanTextReplacements(payload = {}) {
    if (!window.wp?.data || !getTextReplaceEngine()) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.', candidates: [] };
    }

    const search = typeof payload.search === 'string' ? payload.search : '';

    if (!search.length) {
      return { ok: false, message: 'Enter text to find first.', candidates: [] };
    }

    const options = textSearchOptions(payload);
    const candidates = [];
    const editorSelect = window.wp.data.select('core/editor');

    ['title', 'excerpt'].forEach((field) => {
      const value = editorSelect?.getEditedPostAttribute?.(field);

      if (typeof value !== 'string') {
        return;
      }

      const result = replaceVisibleText(value, search, search, options);

      if (result.count) {
        const previews = textMatchPreviews(value, search, options);
        candidates.push({
          target: 'post',
          field,
          label: field === 'title' ? 'Page/post title' : 'Excerpt',
          count: result.count,
          preview: previews[0],
          previews
        });
      }
    });

    const blocks = collectBlocks(getEditorBlocks(), () => true);
    blocks.forEach((block, blockIndex) => {
      const attributes = block.attributes || {};

      richTextAttributeKeys.forEach((attribute) => {
        if (!(attribute in attributes)) {
          return;
        }

        walkTextLeafValues(attributes[attribute], (value, path) => {
          const result = replaceVisibleText(value, search, search, options);

          if (!result.count) {
            return;
          }

          const previews = textMatchPreviews(value, search, options);

          candidates.push({
            target: 'block',
            clientId: block.clientId,
            blockName: block.name,
            attribute,
            path,
            label: `${block.name || 'Block'} ${blockIndex + 1}`,
            count: result.count,
            preview: previews[0],
            previews
          });
        });
      });
    });

    const matchCount = candidates.reduce((sum, candidate) => sum + candidate.count, 0);
    return {
      ok: true,
      message: `Found ${matchCount} match${matchCount === 1 ? '' : 'es'} in ${candidates.length} editable item${candidates.length === 1 ? '' : 's'}.`,
      candidates,
      details: 'Preview only. No editor content was changed.'
    };
  }

  function applyTextReplacements(payload = {}) {
    if (!window.wp?.data || !getTextReplaceEngine()) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.' };
    }

    const search = typeof payload.search === 'string' ? payload.search : '';
    const replacement = typeof payload.replacement === 'string' ? payload.replacement : '';
    const targets = Array.isArray(payload.targets) ? payload.targets : [];

    if (!search.length) {
      return { ok: false, message: 'Enter text to find first.' };
    }

    if (!targets.length) {
      return { ok: false, message: 'No text matches were selected for replacement.' };
    }

    const options = textSearchOptions(payload);
    const postUpdates = {};
    let replacementCount = 0;
    let changedItems = 0;

    targets.filter((target) => target.target === 'post').forEach((target) => {
      if (!['title', 'excerpt'].includes(target.field)) {
        return;
      }

      const currentValue = window.wp.data.select('core/editor')?.getEditedPostAttribute?.(target.field);
      const result = replaceVisibleText(currentValue, search, replacement, options);

      if (result.changedCount) {
        postUpdates[target.field] = result.value;
        replacementCount += result.changedCount;
        changedItems += 1;
      }
    });

    if (Object.keys(postUpdates).length) {
      window.wp.data.dispatch('core/editor').editPost(postUpdates);
    }

    const blockTargets = new Map();
    targets.filter((target) => target.target === 'block' && target.clientId && target.attribute).forEach((target) => {
      const key = `${target.clientId}\n${target.attribute}`;

      if (!blockTargets.has(key)) {
        blockTargets.set(key, { ...target, paths: new Set() });
      }

      blockTargets.get(key).paths.add(JSON.stringify(Array.isArray(target.path) ? target.path : []));
    });

    const blocksById = new Map(collectBlocks(getEditorBlocks(), () => true).map((block) => [block.clientId, block]));
    blockTargets.forEach((target) => {
      const block = blocksById.get(target.clientId);
      const currentValue = block?.attributes?.[target.attribute];
      const result = transformSelectedTextLeaves(currentValue, target.paths, search, replacement, options);

      if (!result.count) {
        return;
      }

      window.wp.data.dispatch('core/block-editor').updateBlockAttributes(target.clientId, {
        [target.attribute]: result.value
      });
      replacementCount += result.count;
      changedItems += target.paths.size;
    });

    return {
      ok: true,
      message: `Replaced ${replacementCount} match${replacementCount === 1 ? '' : 'es'} in ${changedItems} editable item${changedItems === 1 ? '' : 's'}. Post was not saved.`,
      details: replacementCount
        ? 'Review the changes in WordPress, then save or update when ready.'
        : 'No matching text remained in the checked items. Nothing was changed or saved.'
    };
  }

  function applySingleTextReplacement(payload = {}) {
    if (!window.wp?.data || !getTextReplaceEngine()) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.' };
    }

    const search = typeof payload.search === 'string' ? payload.search : '';
    const replacement = typeof payload.replacement === 'string' ? payload.replacement : '';
    const target = payload.target;
    const occurrenceIndex = Number.parseInt(payload.occurrenceIndex, 10);

    if (!search.length || !target || !Number.isInteger(occurrenceIndex) || occurrenceIndex < 0) {
      return { ok: false, message: 'Find a current match before replacing it.' };
    }

    const options = textSearchOptions(payload);
    let result = { count: 0 };

    if (target.target === 'post' && ['title', 'excerpt'].includes(target.field)) {
      const currentValue = window.wp.data.select('core/editor')?.getEditedPostAttribute?.(target.field);
      result = replaceVisibleTextOccurrence(currentValue, search, replacement, occurrenceIndex, options);

      if (result.count) {
        window.wp.data.dispatch('core/editor').editPost({ [target.field]: result.value });
      }
    } else if (target.target === 'block' && target.clientId && target.attribute) {
      const block = collectBlocks(getEditorBlocks(), () => true).find((item) => item.clientId === target.clientId);
      const selectedPath = JSON.stringify(Array.isArray(target.path) ? target.path : []);

      function replaceAtPath(value, path = []) {
        if (typeof value === 'string') {
          return JSON.stringify(path) === selectedPath
            ? replaceVisibleTextOccurrence(value, search, replacement, occurrenceIndex, options)
            : { value, count: 0 };
        }

        if (Array.isArray(value)) {
          const nextValue = [...value];

          for (let index = 0; index < value.length; index += 1) {
            const child = replaceAtPath(value[index], [...path, index]);

            if (child.count) {
              nextValue[index] = child.value;
              return { value: nextValue, count: child.count };
            }
          }
        } else if (value && typeof value === 'object') {
          const nextValue = { ...value };

          for (const key of Object.keys(value)) {
            const child = replaceAtPath(value[key], [...path, key]);

            if (child.count) {
              nextValue[key] = child.value;
              return { value: nextValue, count: child.count };
            }
          }
        }

        return { value, count: 0 };
      }

      result = replaceAtPath(block?.attributes?.[target.attribute]);

      if (result.count) {
        window.wp.data.dispatch('core/block-editor').updateBlockAttributes(target.clientId, {
          [target.attribute]: result.value
        });
      }
    }

    return {
      ok: true,
      message: result.count ? 'Replaced the current match. Post was not saved.' : 'The current match changed or no longer exists. Find again.',
      replaced: result.count,
      details: result.count ? 'Review the change in WordPress, then save or update when ready.' : 'Nothing was changed or saved.'
    };
  }

  const textReplacementHighlightName = 'wsu-wds-find-match';
  const textReplacementHighlightStyleId = 'wsu-wds-find-highlight-style';

  function ensureTextReplacementHighlightStyle() {
    if (document.getElementById(textReplacementHighlightStyleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = textReplacementHighlightStyleId;
    style.textContent = `
      ::highlight(${textReplacementHighlightName}) {
        color: #111827;
        background-color: #ffeb3b;
      }
      .wsu-wds-find-input-selection::selection {
        color: #111827;
        background-color: #ffeb3b;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function clearTextReplacementHighlight() {
    window.CSS?.highlights?.delete?.(textReplacementHighlightName);

    if (window.__WSU_WDS_FIND_INPUT__) {
      const input = window.__WSU_WDS_FIND_INPUT__;
      const caret = input.selectionEnd || 0;
      input.setSelectionRange?.(caret, caret);
      input.classList?.remove('wsu-wds-find-input-selection');
      window.__WSU_WDS_FIND_INPUT__ = null;
    }

    if (window.__WSU_WDS_FIND_USED_SELECTION__) {
      window.getSelection?.()?.removeAllRanges();
      window.__WSU_WDS_FIND_USED_SELECTION__ = false;
    }

    return { ok: true, message: 'Cleared the current text highlight.' };
  }

  function highlightTextNodeOccurrence(scope, search, occurrenceIndex, options) {
    if (!scope || !search.length || !Number.isInteger(occurrenceIndex) || occurrenceIndex < 0) {
      return false;
    }

    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    let remainingIndex = occurrenceIndex;
    let node = walker.nextNode();

    while (node) {
      const matcher = getTextReplaceEngine()?.createMatcher(search, options);
      let match = matcher?.exec(node.nodeValue || '');

      while (match) {
        if (remainingIndex === 0) {
          const range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);

          if (window.CSS?.highlights && typeof window.Highlight === 'function') {
            window.CSS.highlights.set(textReplacementHighlightName, new window.Highlight(range));
          } else {
            const selection = window.getSelection?.();
            selection?.removeAllRanges();
            selection?.addRange(range);
            window.__WSU_WDS_FIND_USED_SELECTION__ = true;
          }

          node.parentElement?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
          return true;
        }

        remainingIndex -= 1;
        match = matcher.exec(node.nodeValue || '');
      }

      node = walker.nextNode();
    }

    return false;
  }

  function highlightInputOccurrence(input, search, occurrenceIndex, options) {
    if (!input || typeof input.setSelectionRange !== 'function') {
      return false;
    }

    const matcher = getTextReplaceEngine()?.createMatcher(search, options);
    let remainingIndex = occurrenceIndex;
    let match = matcher?.exec(input.value || '');

    while (match) {
      if (remainingIndex === 0) {
        input.classList.add('wsu-wds-find-input-selection');
        window.__WSU_WDS_FIND_INPUT__ = input;
        input.focus();
        input.setSelectionRange(match.index, match.index + match[0].length);
        input.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
        return true;
      }

      remainingIndex -= 1;
      match = matcher.exec(input.value || '');
    }

    return false;
  }

  function focusTextReplacementCandidate(payload = {}) {
    const target = payload.target;

    if (!target) {
      return { ok: false, message: 'No current text match to focus.' };
    }

    clearTextReplacementHighlight();
    ensureTextReplacementHighlightStyle();
    const search = typeof payload.search === 'string' ? payload.search : '';
    const occurrenceIndex = Number.parseInt(payload.renderedOccurrenceIndex, 10) || 0;
    const options = textSearchOptions(payload);
    let highlighted = false;

    if (target.target === 'block' && target.clientId) {
      window.wp?.data?.dispatch('core/block-editor')?.selectBlock?.(target.clientId);
      const escapedClientId = window.CSS?.escape ? window.CSS.escape(target.clientId) : target.clientId;
      const blockElement = document.querySelector(`[data-block="${escapedClientId}"]`);
      blockElement?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      highlighted = highlightTextNodeOccurrence(blockElement, search, occurrenceIndex, options);
    } else if (target.target === 'post' && target.field === 'title') {
      const titleElement = document.querySelector('.editor-post-title__input, .editor-post-title, [data-type="core/post-title"], [aria-label="Add title"]');
      highlighted = highlightInputOccurrence(titleElement, search, occurrenceIndex, options)
        || highlightTextNodeOccurrence(titleElement, search, occurrenceIndex, options);
    } else if (target.target === 'post' && target.field === 'excerpt') {
      const excerptElement = document.querySelector('.editor-post-excerpt__textarea, textarea[name="excerpt"], [data-wp-component="PostExcerpt"] textarea');
      highlighted = highlightInputOccurrence(excerptElement, search, occurrenceIndex, options)
        || highlightTextNodeOccurrence(excerptElement, search, occurrenceIndex, options);
    }

    return {
      ok: true,
      highlighted,
      message: highlighted ? 'Highlighted the current text match.' : 'Focused the current block; an exact rendered-text highlight was unavailable.'
    };
  }

  function walkRichTextValue(value, visitor, attribute) {
    if (typeof value === 'string') {
      if (value.includes('<a')) {
        visitor(attribute, value);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => walkRichTextValue(item, visitor, attribute));
      return;
    }

    if (value && typeof value === 'object') {
      Object.values(value).forEach((item) => walkRichTextValue(item, visitor, attribute));
    }
  }

  function walkRichTextStrings(block, visitor) {
    const attributes = block.attributes || {};
    richTextAttributeKeys.forEach((key) => {
      if (key in attributes) {
        walkRichTextValue(attributes[key], visitor, key);
      }
    });
  }

  function transformRichTextValue(value, transformer) {
    if (typeof value === 'string') {
      if (!value.includes('<a')) {
        return { value, changes: [] };
      }

      const result = transformer(value);
      return {
        value: result.changes.length ? result.html : value,
        changes: result.changes
      };
    }

    if (Array.isArray(value)) {
      let changed = false;
      const changes = [];
      const nextValue = value.map((item) => {
        const result = transformRichTextValue(item, transformer);
        changed = changed || result.value !== item;
        changes.push(...result.changes);
        return result.value;
      });

      return { value: changed ? nextValue : value, changes };
    }

    if (value && typeof value === 'object') {
      let changed = false;
      const changes = [];
      const nextValue = { ...value };

      Object.keys(value).forEach((key) => {
        const result = transformRichTextValue(value[key], transformer);
        changed = changed || result.value !== value[key];
        changes.push(...result.changes);
        nextValue[key] = result.value;
      });

      return { value: changed ? nextValue : value, changes };
    }

    return { value, changes: [] };
  }

  function transformRichTextAttributes(block, transformer) {
    const attributes = block.attributes || {};
    const updates = {};
    const changes = [];

    richTextAttributeKeys.forEach((key) => {
      if (!(key in attributes)) {
        return;
      }

      const result = transformRichTextValue(attributes[key], transformer);

      if (result.changes.length) {
        updates[key] = result.value;
        changes.push(...result.changes);
      }
    });

    return { updates, changes };
  }

  function normalizeHref(href) {
    try {
      return new URL(href, window.location.href).href;
    } catch (_error) {
      return '';
    }
  }

  function linkNeedsTitle(text, href) {
    const cleanText = (text || '').replace(/\s+/g, ' ').trim();

    if (/^https?:\/\//i.test(cleanText)) {
      return true;
    }

    if (!href) {
      return false;
    }

    try {
      const parsed = new URL(href);
      const withoutProtocol = cleanText.replace(/^www\./i, '');
      const urlishText = [parsed.hostname, parsed.pathname, parsed.search]
        .join('')
        .replace(/^www\./i, '');

      return cleanText.length > 35 && urlishText.includes(withoutProtocol.slice(0, 20));
    } catch (_error) {
      return false;
    }
  }

  function isGenericLinkText(text) {
    const cleanText = (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const genericTexts = new Set([
      'click here',
      'here',
      'learn more',
      'read more',
      'more',
      'this link',
      'link',
      'click this link',
      'click the link',
      'view more',
      'see more',
      'continue reading',
      'download',
      'download here',
      'visit website',
      'website'
    ]);

    return genericTexts.has(cleanText);
  }

  function linkTextNeedsTitle(text, href, mode) {
    return mode === 'generic' ? isGenericLinkText(text) : linkNeedsTitle(text, href);
  }

  function getLinkCandidates(html, mode = 'url') {
    const template = document.createElement('template');
    template.innerHTML = html;

    return Array.from(template.content.querySelectorAll('a[href]'))
      .map((anchor) => ({
        href: normalizeHref(anchor.getAttribute('href')),
        text: anchor.textContent || ''
      }))
      .filter((link) => link.href && linkTextNeedsTitle(link.text, link.href, mode));
  }

  function scanLinkTextForTitles(payload = {}) {
    if (!window.wp?.data) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.', candidates: [] };
    }

    const candidates = [];
    const blocks = collectBlocks(getEditorBlocks(), () => true);

    blocks.forEach((block) => {
      walkRichTextStrings(block, (attribute, value) => {
        getLinkCandidates(value, payload?.mode || 'url').forEach((link) => {
          candidates.push({
            clientId: block.clientId,
            blockName: block.name,
            attribute,
            href: link.href,
            text: link.text
          });
        });
      });
    });

    return {
      ok: true,
      message: `Found ${candidates.length} link text item${candidates.length === 1 ? '' : 's'}.`,
      candidates,
      details: candidates.map((candidate) => `${candidate.text} -> ${candidate.href}`).join('\n')
    };
  }

  function replaceLinksInHtml(html, titleMap, mode = 'url') {
    const template = document.createElement('template');
    template.innerHTML = html;
    const changes = [];

    Array.from(template.content.querySelectorAll('a[href]')).forEach((anchor) => {
      const href = normalizeHref(anchor.getAttribute('href'));
      const title = href ? titleMap[href] : '';
      const oldText = anchor.textContent || '';

      if (!title || !linkTextNeedsTitle(oldText, href, mode)) {
        return;
      }

      anchor.textContent = title;
      changes.push(`${oldText} -> ${title}`);
    });

    return {
      html: template.innerHTML,
      changes
    };
  }

  function applyLinkTextTitles(payload) {
    if (!window.wp?.data) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.' };
    }

    const titleMap = payload?.titleMap || {};
    const blocks = collectBlocks(getEditorBlocks(), () => true);
    const changes = [];
    let changedBlocks = 0;

    blocks.forEach((block) => {
      const result = transformRichTextAttributes(block, (value) => {
        return replaceLinksInHtml(value, titleMap, payload?.mode || 'url');
      });

      if (Object.keys(result.updates).length) {
        window.wp.data.dispatch('core/block-editor').updateBlockAttributes(block.clientId, result.updates);
        changes.push(...result.changes);
        changedBlocks += 1;
      }
    });

    return {
      ok: true,
      message: `Updated ${changes.length} link text item${changes.length === 1 ? '' : 's'}.`,
      details: changes.length ? changes.join('\n') : `Changed ${changedBlocks} block${changedBlocks === 1 ? '' : 's'}.`
    };
  }

  function replaceEmailLinkTextInHtml(html) {
    const helper = window.WSU_WDS_EMAIL_LINK;
    const template = document.createElement('template');
    template.innerHTML = html;
    const changes = [];

    if (!helper?.replacementForLink) {
      return { html, changes };
    }

    Array.from(template.content.querySelectorAll('a[href^="mailto:" i]')).forEach((anchor) => {
      const replacement = helper.replacementForLink(anchor.textContent, anchor.getAttribute('href'));

      if (!replacement) {
        return;
      }

      const oldText = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
      anchor.textContent = replacement.text;
      anchor.removeAttribute('aria-label');
      anchor.removeAttribute('aria-labelledby');
      changes.push(`${oldText} -> ${replacement.text}`);
    });

    return { html: template.innerHTML, changes };
  }

  function fixEmailLinkText() {
    if (!window.wp?.data) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.' };
    }

    const blocks = collectBlocks(getEditorBlocks(), () => true);
    const changes = [];

    blocks.forEach((block) => {
      const result = transformRichTextAttributes(block, replaceEmailLinkTextInHtml);

      if (Object.keys(result.updates).length) {
        window.wp.data.dispatch('core/block-editor').updateBlockAttributes(block.clientId, result.updates);
        changes.push(...result.changes);
      }
    });

    return {
      ok: true,
      message: changes.length
        ? `Updated ${changes.length} email link${changes.length === 1 ? '' : 's'}. Post was not saved.`
        : 'No email links with exposed addresses, recipient-only text, or generic text were found.',
      details: changes.length ? changes.join('\n') : 'The label is derived from the mailbox name before the @ symbol; meaningful custom link text is left unchanged.'
    };
  }


  function removeBoldMarkupFromHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html || '';

    Array.from(template.content.querySelectorAll('strong, b')).forEach((element) => {
      element.replaceWith(...Array.from(element.childNodes));
    });

    return template.innerHTML;
  }

  function unboldHeadingBlocks() {
    if (!window.wp?.data) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.' };
    }

    const headingBlocks = collectBlocks(getEditorBlocks(), (block) => block.name === 'core/heading');
    const changes = [];

    headingBlocks.forEach((block) => {
      const content = block.attributes?.content;

      if (typeof content !== 'string' || !/<\/?(?:strong|b)\b/i.test(content)) {
        return;
      }

      const nextContent = removeBoldMarkupFromHtml(content);

      if (nextContent === content) {
        return;
      }

      window.wp.data.dispatch('core/block-editor').updateBlockAttributes(block.clientId, {
        content: nextContent
      });
      changes.push(getTextContentFromHtml(nextContent) || 'Heading');
    });

    return {
      ok: true,
      message: 'Unbolded ' + changes.length + ' heading block' + (changes.length === 1 ? '' : 's') + '.',
      details: changes.length
        ? changes.map((text) => 'Unbolded: ' + text).join('\n')
        : 'No heading blocks with bold markup were found.'
    };
  }

  function getTextContentFromHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    return (template.content.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function isEntireHtmlBold(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    let hasText = false;
    let node = walker.nextNode();

    while (node) {
      if (node.textContent.trim()) {
        hasText = true;

        if (!hasBoldAncestor(node, template.content)) {
          return false;
        }
      }

      node = walker.nextNode();
    }

    return hasText;
  }

  function hasBoldAncestor(textNode, root) {
    let node = textNode.parentElement;

    while (node && node !== root) {
      const tagName = node.tagName?.toLowerCase();

      if (tagName === 'strong' || tagName === 'b') {
        return true;
      }

      node = node.parentElement;
    }

    return false;
  }

  function unwrapBoldRootElements(html) {
    const template = document.createElement('template');
    template.innerHTML = html;

    Array.from(template.content.querySelectorAll('strong, b')).forEach((element) => {
      element.replaceWith(...Array.from(element.childNodes));
    });

    return template.innerHTML;
  }

  function unboldLongAllBoldParagraphs(payload) {
    if (!window.wp?.data) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.' };
    }

    const minChars = Number.parseInt(payload?.minChars, 10) || 120;
    const paragraphBlocks = collectBlocks(getEditorBlocks(), (block) => block.name === 'core/paragraph');
    const changes = [];
    const skippedShort = [];

    paragraphBlocks.forEach((block) => {
      const content = block.attributes?.content;

      if (typeof content !== 'string' || !content.trim()) {
        return;
      }

      const text = getTextContentFromHtml(content);

      if (!text || !isEntireHtmlBold(content)) {
        return;
      }

      if (text.length <= minChars) {
        skippedShort.push(text);
        return;
      }

      window.wp.data.dispatch('core/block-editor').updateBlockAttributes(block.clientId, {
        content: unwrapBoldRootElements(content)
      });
      changes.push(text);
    });

    return {
      ok: true,
      message: `Unbolded ${changes.length} paragraph${changes.length === 1 ? '' : 's'}.`,
      details: changes.length
        ? changes.map((text) => `"${text}"`).join('\n')
        : skippedShort.length
          ? `Found ${skippedShort.length} all-bold paragraph${skippedShort.length === 1 ? '' : 's'} at or below ${minChars} characters. Lower the cutoff to include them.`
          : `No all-bold paragraph blocks found over ${minChars} characters.`
    };
  }


  function decodeTrackedHref(href) {
    let parsed;

    try {
      parsed = new URL(href, window.location.href);
    } catch (_error) {
      return '';
    }

    const hostname = parsed.hostname.toLowerCase();

    if (hostname.endsWith('urldefense.com')) {
      const match = parsed.href.match(/\/v\d+\/__(.*?)__/i);

      if (!match?.[1]) {
        return '';
      }

      try {
        return decodeURIComponent(match[1]);
      } catch (_error) {
        return match[1];
      }
    }

    if (hostname.endsWith('safelinks.protection.outlook.com')) {
      const wrappedUrl = parsed.searchParams.get('url');

      if (!wrappedUrl) {
        return '';
      }

      try {
        return decodeURIComponent(wrappedUrl);
      } catch (_error) {
        return wrappedUrl;
      }
    }

    return '';
  }

  function unwrapUrlDefenseLinksInHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    const changes = [];

    Array.from(template.content.querySelectorAll('a[href]')).forEach((anchor) => {
      const oldHref = anchor.getAttribute('href') || '';
      const decodedHref = decodeTrackedHref(oldHref);

      if (!decodedHref) {
        return;
      }

      anchor.setAttribute('href', decodedHref);
      changes.push(oldHref + ' -> ' + decodedHref);
    });

    return {
      html: template.innerHTML,
      changes
    };
  }

  function unwrapUrlDefenseLinks() {
    if (!window.wp?.data) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.' };
    }

    const blocks = collectBlocks(getEditorBlocks(), () => true);
    const changes = [];
    let changedBlocks = 0;

    blocks.forEach((block) => {
      const result = transformRichTextAttributes(block, unwrapUrlDefenseLinksInHtml);

      if (Object.keys(result.updates).length) {
        window.wp.data.dispatch('core/block-editor').updateBlockAttributes(block.clientId, result.updates);
        changes.push(...result.changes);
        changedBlocks += 1;
      }
    });

    return {
      ok: true,
      message: 'Unwrapped ' + changes.length + ' tracked link' + (changes.length === 1 ? '' : 's') + '.',
      details: changes.length
        ? changes.join('\n')
        : 'No URLDefense or Outlook Safe Links were found.'
    };
  }

  function removeNewTabAttributesFromHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    const changes = [];

    Array.from(template.content.querySelectorAll('a[target]')).forEach((anchor) => {
      if ((anchor.getAttribute('target') || '').toLowerCase() !== '_blank') {
        return;
      }

      const label = (anchor.textContent || anchor.getAttribute('href') || '').replace(/\s+/g, ' ').trim();
      anchor.removeAttribute('target');

      const relTokens = (anchor.getAttribute('rel') || '')
        .split(/\s+/)
        .filter(Boolean)
        .filter((token) => !['noopener', 'noreferrer'].includes(token.toLowerCase()));

      if (relTokens.length) {
        anchor.setAttribute('rel', relTokens.join(' '));
      } else {
        anchor.removeAttribute('rel');
      }

      changes.push(label || anchor.href || 'Link');
    });

    return {
      html: template.innerHTML,
      changes
    };
  }

  function removeNewTabFromLinks() {
    if (!window.wp?.data) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.' };
    }

    const blocks = collectBlocks(getEditorBlocks(), () => true);
    const changes = [];
    let changedBlocks = 0;

    blocks.forEach((block) => {
      const result = transformRichTextAttributes(block, removeNewTabAttributesFromHtml);

      if (Object.keys(result.updates).length) {
        window.wp.data.dispatch('core/block-editor').updateBlockAttributes(block.clientId, result.updates);
        changes.push(...result.changes);
        changedBlocks += 1;
      }
    });

    return {
      ok: true,
      message: `Updated ${changes.length} link${changes.length === 1 ? '' : 's'}.`,
      details: changes.length
        ? changes.map((label) => `Removed new-tab behavior: ${label}`).join('\n')
        : 'No rich-text links set to open in a new tab were found.'
    };
  }


  function isImageFileUrl(url) {
    try {
      const parsed = new URL(url, window.location.href);
      return /\.(avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i.test(parsed.pathname);
    } catch (_error) {
      return false;
    }
  }

  function imageFilenameFromUrl(url) {
    try {
      const parsed = new URL(url, window.location.href);
      return decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
    } catch (_error) {
      return '';
    }
  }

  function imageFileTypeFromUrl(url) {
    const filename = imageFilenameFromUrl(url);
    const extension = (filename.match(/\.([^.]+)$/)?.[1] || 'image').toUpperCase();

    return extension === 'JPEG' ? 'JPG' : extension;
  }

  function fileDestinationLabel(url, fallbackText) {
    const filenameDescription = imageFilenameFromUrl(url)
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const cleanedFallback = (fallbackText || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const description = cleanedFallback || filenameDescription || 'image';

    return 'Full-size ' + imageFileTypeFromUrl(url) + ' of ' + description;
  }

  function linkedImageHrefFromAttributes(attrs) {
    const href = attrs.href || attrs.linkUrl || attrs.linkDestinationUrl || '';

    if (href && isImageFileUrl(href)) {
      return href;
    }

    if (attrs.linkDestination === 'media' && attrs.url && isImageFileUrl(attrs.url)) {
      return attrs.url;
    }

    return '';
  }

  function setLinkedImageAltToDestination() {
    if (!window.wp?.data) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.' };
    }

    const blocks = collectBlocks(getEditorBlocks(), () => true);
    const changes = [];
    const skipped = [];
    let candidateCount = 0;

    blocks.forEach((block) => {
      const attrs = block.attributes || {};

      if (block.name === 'core/image') {
        const href = linkedImageHrefFromAttributes(attrs);

        if (!href) {
          return;
        }

        candidateCount += 1;
        const nextAlt = fileDestinationLabel(href, attrs.title || attrs.caption || attrs.alt);

        if ((attrs.alt || '') === nextAlt) {
          skipped.push(nextAlt);
          return;
        }

        window.wp.data.dispatch('core/block-editor').updateBlockAttributes(block.clientId, {
          alt: nextAlt
        });
        changes.push(nextAlt);
        return;
      }

      if (block.name === 'core/gallery' && Array.isArray(attrs.images)) {
        let changedImages = false;
        const nextImages = attrs.images.map((image) => {
          const href = linkedImageHrefFromAttributes(image || {});

          if (!href) {
            return image;
          }

          candidateCount += 1;
          const nextAlt = fileDestinationLabel(href, image.title || image.caption || image.alt);

          if ((image.alt || '') === nextAlt) {
            skipped.push(nextAlt);
            return image;
          }

          changedImages = true;
          changes.push(nextAlt);
          return { ...image, alt: nextAlt };
        });

        if (changedImages) {
          window.wp.data.dispatch('core/block-editor').updateBlockAttributes(block.clientId, {
            images: nextImages
          });
        }
      }
    });

    return {
      ok: true,
      message: 'Updated ' + changes.length + ' linked image alt text value' + (changes.length === 1 ? '' : 's') + '.',
      details: changes.length
        ? changes.map((value) => 'Alt: ' + value).join('\n')
        : skipped.length
          ? 'Found ' + skipped.length + ' linked image' + (skipped.length === 1 ? '' : 's') + ', but their alt text already matched the stricter destination format.'
          : candidateCount
            ? 'Found linked image candidates, but no alt text updates were needed.'
            : 'No image or gallery blocks linked directly to image files were found.'
    };
  }

  function cleanText(value) {
    const template = document.createElement('template');
    template.innerHTML = value || '';
    return (template.content.textContent || value || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function imageBasenameFromUrl(url) {
    return imageFilenameFromUrl(url)
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function shouldSuggestAlt(alt) {
    const value = cleanText(alt).toLowerCase();

    if (!value) {
      return true;
    }

    return /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(value)
      || /^image( of)?\b/.test(value)
      || value.length > 160;
  }

  function altSuggestionForImage(attrs, context = {}) {
    const caption = cleanText(attrs.caption || context.caption || '');
    const title = cleanText(attrs.title || context.title || '');
    const filename = imageBasenameFromUrl(attrs.url || attrs.href || attrs.linkUrl || context.url || '');
    const currentAlt = cleanText(attrs.alt || '');
    const source = caption || title || filename || currentAlt;

    if (!source) {
      return '';
    }

    return source
      .replace(/^image of\s+/i, '')
      .replace(/^photo of\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 150);
  }

  function imageSuggestionLabel(attrs, fallback) {
    return cleanText(attrs.caption || attrs.title || attrs.alt) || imageFilenameFromUrl(attrs.url || attrs.href || attrs.linkUrl) || fallback;
  }

  function prefixAltWithPageTitle(suggestion, pageTitle, includePageTitle) {
    if (!includePageTitle || !pageTitle || !suggestion) {
      return suggestion;
    }

    const cleanPageTitle = cleanText(pageTitle).replace(/\s+/g, ' ').trim();
    const cleanSuggestion = cleanText(suggestion);

    if (!cleanPageTitle || cleanSuggestion.toLowerCase().startsWith(cleanPageTitle.toLowerCase() + ':')) {
      return cleanSuggestion;
    }

    return (cleanPageTitle + ': ' + cleanSuggestion).slice(0, 170);
  }

  function suggestImageAltText(payload = {}) {
    if (!window.wp?.data) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.', suggestions: [] };
    }

    const suggestions = [];
    const blocks = collectBlocks(getEditorBlocks(), () => true);
    const editorSelect = window.wp.data.select('core/editor');
    const pageTitle = cleanText(editorSelect?.getEditedPostAttribute?.('title') || editorSelect?.getCurrentPostAttribute?.('title') || '');
    const includePageTitle = Boolean(payload?.includePageTitle);

    blocks.forEach((block) => {
      const attrs = block.attributes || {};

      if (block.name === 'core/image') {
        if (!shouldSuggestAlt(attrs.alt)) {
          return;
        }

        const suggestion = prefixAltWithPageTitle(altSuggestionForImage(attrs), pageTitle, includePageTitle);

        if (!suggestion) {
          return;
        }

        suggestions.push({
          target: { type: 'block', clientId: block.clientId },
          label: imageSuggestionLabel(attrs, 'Image block'),
          filename: imageFilenameFromUrl(attrs.url || attrs.href || attrs.linkUrl),
          currentAlt: cleanText(attrs.alt || ''),
          suggestion,
          reason: (includePageTitle && pageTitle ? 'Includes page title. ' : '') + (attrs.caption ? 'Suggested from caption.' : attrs.title ? 'Suggested from media title.' : 'Suggested from filename.')
        });
        return;
      }

      if (block.name === 'core/gallery' && Array.isArray(attrs.images)) {
        attrs.images.forEach((image, imageIndex) => {
          if (!shouldSuggestAlt(image?.alt)) {
            return;
          }

          const suggestion = prefixAltWithPageTitle(altSuggestionForImage(image || {}), pageTitle, includePageTitle);

          if (!suggestion) {
            return;
          }

          suggestions.push({
            target: { type: 'galleryImage', clientId: block.clientId, imageIndex },
            label: imageSuggestionLabel(image || {}, 'Gallery image ' + (imageIndex + 1)),
            filename: imageFilenameFromUrl(image?.url || image?.href || image?.linkUrl),
            currentAlt: cleanText(image?.alt || ''),
            suggestion,
            reason: (includePageTitle && pageTitle ? 'Includes page title. ' : '') + (image?.caption ? 'Suggested from caption.' : image?.title ? 'Suggested from media title.' : 'Suggested from filename.')
          });
        });
      }
    });

    return {
      ok: true,
      message: 'Found ' + suggestions.length + ' image alt suggestion' + (suggestions.length === 1 ? '' : 's') + '.',
      suggestions,
      details: suggestions.length
        ? suggestions.map((item) => item.label + ' -> ' + item.suggestion).join('\\n')
        : 'No empty or suspicious image alt text values found.'
    };
  }

  function applyImageAltTextSuggestions(payload) {
    if (!window.wp?.data) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.' };
    }

    const updates = Array.isArray(payload?.updates) ? payload.updates : [];
    const blocksByClientId = new Map(collectBlocks(getEditorBlocks(), () => true).map((block) => [block.clientId, block]));
    const changes = [];

    updates.forEach((update) => {
      const alt = cleanText(update?.alt || '');
      const target = update?.target || {};

      if (!alt || !target.clientId) {
        return;
      }

      const block = blocksByClientId.get(target.clientId);

      if (!block) {
        return;
      }

      if (target.type === 'block') {
        window.wp.data.dispatch('core/block-editor').updateBlockAttributes(target.clientId, { alt });
        changes.push(alt);
        return;
      }

      if (target.type === 'galleryImage' && Array.isArray(block.attributes?.images)) {
        const index = Number.parseInt(target.imageIndex, 10);

        if (!Number.isInteger(index) || !block.attributes.images[index]) {
          return;
        }

        const nextImages = block.attributes.images.map((image, imageIndex) => {
          return imageIndex === index ? { ...image, alt } : image;
        });

        window.wp.data.dispatch('core/block-editor').updateBlockAttributes(target.clientId, {
          images: nextImages
        });
        changes.push(alt);
      }
    });

    return {
      ok: true,
      message: 'Applied ' + changes.length + ' image alt suggestion' + (changes.length === 1 ? '' : 's') + '.',
      details: changes.length ? changes.map((alt) => 'Alt: ' + alt).join('\\n') : 'No image alt suggestions were applied.'
    };
  }

  function getWordCount(text) {
    return (text.match(/\b[\w’'-]+\b/g) || []).length;
  }

  function convertShortAllBoldParagraphsToH2(payload) {
    if (!window.wp?.data || !window.wp?.blocks) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.' };
    }

    const maxWords = Number.parseInt(payload?.maxWords, 10) || 4;
    const fontSize = payload?.fontSize || 'xMedium';
    const fontSizeClass = fontSize ? `wsu-font-size--${fontSize.toLowerCase()}` : '';
    const paragraphBlocks = collectBlocks(getEditorBlocks(), (block) => block.name === 'core/paragraph');
    const changes = [];
    const skippedLong = [];

    paragraphBlocks.forEach((block) => {
      const content = block.attributes?.content;

      if (typeof content !== 'string' || !content.trim()) {
        return;
      }

      const text = getTextContentFromHtml(content);

      if (!text || !isEntireHtmlBold(content)) {
        return;
      }

      const wordCount = getWordCount(text);

      if (wordCount > maxWords) {
        skippedLong.push(`${text} (${wordCount} words)`);
        return;
      }

      const headingBlock = window.wp.blocks.createBlock('core/heading', {
        content: unwrapBoldRootElements(content),
        level: 2,
        className: fontSizeClass
      });

      window.wp.data.dispatch('core/block-editor').replaceBlock(block.clientId, headingBlock);
      changes.push(text);
    });

    return {
      ok: true,
      message: `Converted ${changes.length} paragraph${changes.length === 1 ? '' : 's'} to H2.`,
      details: changes.length
        ? changes.map((text) => `"${text}" -> H2 ${fontSize}`).join('\n')
        : skippedLong.length
          ? `Found ${skippedLong.length} all-bold paragraph${skippedLong.length === 1 ? '' : 's'} over ${maxWords} words. Raise the word limit to include them.`
          : `No all-bold paragraph blocks found at or below ${maxWords} words.`
    };
  }

  function getLeadingBoldLineSplit(content) {
    const template = document.createElement('template');
    template.innerHTML = content;
    const nodes = Array.from(template.content.childNodes);
    const firstMeaningfulIndex = nodes.findIndex((node) => {
      return node.nodeType !== Node.TEXT_NODE || node.textContent.trim();
    });

    if (firstMeaningfulIndex === -1) {
      return null;
    }

    const firstNode = nodes[firstMeaningfulIndex];

    if (firstNode.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const tagName = firstNode.tagName.toLowerCase();

    if (tagName !== 'strong' && tagName !== 'b') {
      return null;
    }

    const childNodes = Array.from(firstNode.childNodes);
    const brInsideIndex = childNodes.findIndex((node) => {
      return node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() === 'br';
    });

    if (brInsideIndex !== -1) {
      const headingTemplate = document.createElement('template');
      childNodes.slice(0, brInsideIndex).forEach((node) => headingTemplate.content.appendChild(node.cloneNode(true)));
      const headingContent = headingTemplate.innerHTML.trim();
      const headingText = getTextContentFromHtml(headingContent);

      if (!headingText) {
        return null;
      }

      const remainingTemplate = document.createElement('template');
      childNodes.slice(brInsideIndex + 1).forEach((node) => remainingTemplate.content.appendChild(node.cloneNode(true)));
      nodes.slice(firstMeaningfulIndex + 1).forEach((node) => remainingTemplate.content.appendChild(node.cloneNode(true)));
      const remainingContent = remainingTemplate.innerHTML.trim();

      if (!getTextContentFromHtml(remainingContent)) {
        return null;
      }

      return {
        headingContent,
        headingText,
        remainingContent
      };
    }

    const nextNode = nodes[firstMeaningfulIndex + 1];

    if (!nextNode || nextNode.nodeType !== Node.ELEMENT_NODE || nextNode.tagName.toLowerCase() !== 'br') {
      return null;
    }

    const headingText = (firstNode.textContent || '').replace(/\s+/g, ' ').trim();

    if (!headingText) {
      return null;
    }

    const remainingNodes = nodes.slice(firstMeaningfulIndex + 2);
    const remainingTemplate = document.createElement('template');
    remainingNodes.forEach((node) => remainingTemplate.content.appendChild(node.cloneNode(true)));
    const remainingContent = remainingTemplate.innerHTML.trim();

    if (!getTextContentFromHtml(remainingContent)) {
      return null;
    }

    return {
      headingContent: firstNode.innerHTML,
      headingText,
      remainingContent
    };
  }

  function splitLeadingBoldLineToH2(payload) {
    if (!window.wp?.data || !window.wp?.blocks) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.' };
    }

    const maxWords = Number.parseInt(payload?.maxWords, 10) || 4;
    const fontSize = payload?.fontSize || 'xMedium';
    const fontSizeClass = fontSize ? 'wsu-font-size--' + fontSize.toLowerCase() : '';
    const paragraphBlocks = collectBlocks(getEditorBlocks(), (block) => block.name === 'core/paragraph');
    const changes = [];
    const skippedLong = [];

    paragraphBlocks.forEach((block) => {
      const content = block.attributes?.content;

      if (typeof content !== 'string' || !content.trim()) {
        return;
      }

      const split = getLeadingBoldLineSplit(content);

      if (!split) {
        return;
      }

      const wordCount = getWordCount(split.headingText);

      if (wordCount > maxWords) {
        skippedLong.push(split.headingText + ' (' + wordCount + ' words)');
        return;
      }

      const headingBlock = window.wp.blocks.createBlock('core/heading', {
        content: split.headingContent,
        level: 2,
        className: fontSizeClass
      });
      const paragraphBlock = window.wp.blocks.createBlock('core/paragraph', {
        content: split.remainingContent
      });

      window.wp.data.dispatch('core/block-editor').replaceBlocks(block.clientId, [headingBlock, paragraphBlock]);
      changes.push(split.headingText);
    });

    return {
      ok: true,
      message: 'Split ' + changes.length + ' paragraph' + (changes.length === 1 ? '' : 's') + '.',
      details: changes.length
        ? changes.map((text) => '"' + text + '" -> H2 ' + fontSize).join('\n')
        : skippedLong.length
          ? 'Found ' + skippedLong.length + ' leading bold line' + (skippedLong.length === 1 ? '' : 's') + ' over ' + maxWords + ' words. Raise the word limit to include them.'
          : 'No paragraph blocks found with a leading bold line, soft return, and following text.'
    };
  }

  function getAccessibilityPanelText() {
    const toggles = Array.from(document.querySelectorAll('.components-panel__body-toggle, .components-panel__body-title button, button'));
    const accessibilityToggle = toggles.find((toggle) => {
      return /accessibility\s*&\s*usability/i.test((toggle.textContent || '').replace(/\s+/g, ' '));
    });
    const panel = accessibilityToggle?.closest('.components-panel__body')
      || accessibilityToggle?.parentElement?.closest('.components-panel__body')
      || accessibilityToggle?.closest('[class*="panel"]');

    if (panel) {
      return (panel.textContent || '').replace(/\s+/g, ' ').trim();
    }

    const bodyText = (document.body?.textContent || '').replace(/\s+/g, ' ').trim();
    const match = bodyText.match(/Accessibility\s*&\s*Usability[\s\S]{0,2500}/i);

    return match?.[0] || '';
  }

  function scanVisibleAccessibilityIssues() {
    const panelText = getAccessibilityPanelText();
    const knownIssuePatterns = [
      /missing page title/ig,
      /links? with missing or invalid hrefs?/ig,
      /linked image missing alt text/ig,
      /links?\s+(?:is|are)?\s*set\s+to\s+open\s+in\s+a\s+new\s+tab/ig,
      /links? with generic text/ig,
      /(?:email links? with (?:generic text|email addresses? as (?:the )?link text)|email addresses? used as link text)/ig,
      /incorrect heading order/ig,
      /links? with urldefense\.com in the URL/ig,
      /(?:link text containing the URL protocol|links? containing the URL protocol|URL protocol[^.]*link text)/ig,
      /(?:link text containing a long URL|links? may contain a long URL|long URL[^.]*link text)/ig,
      /images? missing alt text/ig,
      /images? where alt text should be the destination/ig,
      /paragraphs? (?:contains?|with) only bold(?:ed)? text/ig
    ];
    const issues = [];

    knownIssuePatterns.forEach((pattern) => {
      const matches = panelText.match(pattern) || [];
      matches.forEach((match) => issues.push(match));
    });

    return {
      ok: true,
      message: 'Detected ' + issues.length + ' Accessibility & Usability issue text item' + (issues.length === 1 ? '' : 's') + '.',
      issueText: panelText,
      issueCount: issues.length,
      issues: Array.from(new Set(issues))
    };
  }

  function getAccessibilityColumnIndex() {
    const headers = Array.from(document.querySelectorAll('.wp-list-table thead th, .wp-list-table thead td'));
    const index = headers.findIndex((header) => {
      return (header.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase().includes('accessibility');
    });

    return index === -1 ? null : index;
  }

  function scanAccessibilityNoDataRows() {
    const table = document.querySelector('.wp-list-table');

    if (!table) {
      return { ok: false, message: 'Open this on a WordPress Posts or Pages list screen first.', items: [] };
    }

    const columnIndex = getAccessibilityColumnIndex();

    if (columnIndex === null) {
      return { ok: false, message: 'Could not find an Accessibility column on this list screen.', items: [] };
    }

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const items = rows.map((row) => {
      const cells = Array.from(row.children);
      const accessibilityCell = cells[columnIndex];
      const accessibilityText = (accessibilityCell?.textContent || '').replace(/\s+/g, ' ').trim();

      if (!/\bno data\b/i.test(accessibilityText)) {
        return null;
      }

      const editLink = row.querySelector('a.row-title[href*="post.php"], .row-actions .edit a[href*="post.php"], a[href*="post.php"][href*="action=edit"]');

      if (!editLink?.href) {
        return null;
      }

      return {
        title: (editLink.textContent || '').replace(/\s+/g, ' ').trim(),
        url: editLink.href
      };
    }).filter(Boolean);

    return {
      ok: true,
      message: 'Found ' + items.length + ' visible No Data item' + (items.length === 1 ? '' : 's') + '.',
      items,
      details: items.length
        ? items.map((item) => item.title || item.url).join('\n')
        : 'No visible rows in the Accessibility column contained No Data.'
    };
  }

  function getVisibleListRows() {
    const table = document.querySelector('.wp-list-table');

    if (!table) {
      return null;
    }

    return Array.from(table.querySelectorAll('tbody tr')).map((row) => {
      const editLink = row.querySelector('a.row-title[href*="post.php"], .row-actions .edit a[href*="post.php"], a[href*="post.php"][href*="action=edit"]');

      if (!editLink?.href) {
        return null;
      }

      return {
        title: (editLink.textContent || '').replace(/\s+/g, ' ').trim(),
        url: editLink.href
      };
    }).filter(Boolean);
  }

  function scanVisibleListRows() {
    const items = getVisibleListRows();

    if (!items) {
      return { ok: false, message: 'Open this on a WordPress list screen first.', items: [] };
    }

    return {
      ok: true,
      message: 'Found ' + items.length + ' visible editable item' + (items.length === 1 ? '' : 's') + '.',
      items,
      details: items.length
        ? items.map((item) => item.title || item.url).join('\n')
        : 'No visible editable rows were found on this list screen.'
    };
  }

  function waitForEditorSaveToFinish() {
    return new Promise((resolve) => {
      const editorSelect = window.wp?.data?.select('core/editor');
      let sawSaving = false;
      const startedAt = Date.now();
      const unsubscribe = window.wp.data.subscribe(() => {
        const isSaving = Boolean(editorSelect?.isSavingPost?.());
        const isAutosaving = Boolean(editorSelect?.isAutosavingPost?.());

        if (isSaving || isAutosaving) {
          sawSaving = true;
          return;
        }

        if (sawSaving || Date.now() - startedAt > 12000) {
          unsubscribe();
          resolve();
        }
      });

      setTimeout(() => {
        unsubscribe();
        resolve();
      }, 20000);
    });
  }

  async function saveCurrentPostForAccessibilityRefresh() {
    if (!window.wp?.data) {
      return { ok: false, message: 'Open this on a WordPress block editor page first.' };
    }

    const editorDispatch = window.wp.data.dispatch('core/editor');
    const editorSelect = window.wp.data.select('core/editor');
    const title = editorSelect?.getEditedPostAttribute?.('title') || document.title || 'Post';
    const status = editorSelect?.getEditedPostAttribute?.('status')
      || editorSelect?.getCurrentPostAttribute?.('status')
      || 'unknown';
    const draftLikeStatuses = ['auto-draft', 'draft', 'pending'];
    const statusLabel = status === 'publish'
      ? 'published'
      : status === 'unknown'
        ? 'current status'
        : status;

    if (!editorDispatch?.savePost) {
      const saveButton = draftLikeStatuses.includes(status)
        ? document.querySelector('.editor-post-save-draft, button[aria-label="Save draft"]')
        : document.querySelector('.editor-post-publish-button, button[aria-label="Update"], button[aria-label="Save"]');

      if (!saveButton) {
        return { ok: false, message: 'Could not find a WordPress save/update control for a post with status: ' + status + '.' };
      }

      saveButton.click();
      return { ok: true, message: 'Clicked save/update for ' + title + ' and kept status as ' + statusLabel + '.' };
    }

    const saveResult = editorDispatch.savePost();

    if (saveResult?.then) {
      await saveResult;
    } else {
      await waitForEditorSaveToFinish();
    }

    return { ok: true, message: 'Saved ' + title + ' and kept status as ' + statusLabel + '.' };
  }

  const actions = {
    analyzeTaxonomySuggestions,
    applyTaxonomySuggestions,
    scanTextReplacements,
    applyTextReplacements,
    applySingleTextReplacement,
    focusTextReplacementCandidate,
    clearTextReplacementHighlight,
    makeAllHeadingsH2,
    applyH2FontSize,
    changeHeadingLevel,
    scanHeadingBlocks,
    changeSelectedHeadingBlocks,
    unboldHeadingBlocks,
    inspectSelectedBlock,
    scanLinkTextForTitles,
    applyLinkTextTitles,
    fixEmailLinkText,
    unwrapUrlDefenseLinks,
    unboldLongAllBoldParagraphs,
    removeNewTabFromLinks,
    setLinkedImageAltToDestination,
    suggestImageAltText,
    applyImageAltTextSuggestions,
    convertShortAllBoldParagraphsToH2,
    splitLeadingBoldLineToH2,
    scanAccessibilityNoDataRows,
    scanVisibleListRows,
    scanVisibleAccessibilityIssues,
    saveCurrentPostForAccessibilityRefresh
  };

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.data?.source !== 'WSU_WDS_CONTENT') {
      return;
    }

    const action = actions[event.data.action];
    let response;

    try {
      response = action
        ? await action(event.data.payload || {})
        : { ok: false, message: `Unknown action: ${event.data.action}` };
    } catch (error) {
      response = { ok: false, message: error.message || 'Page bridge action failed.', details: String(error?.stack || error) };
    }

    window.postMessage({
      source: 'WSU_WDS_PAGE',
      id: event.data.id,
      response
    }, '*');
  });
})();
