const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const classifier = require('../wp-bulk-editor-extension/taxonomy-classifier.js');
const config = require('../wp-bulk-editor-extension/taxonomy-rules.js');

function makeOption(value, name, selected = false) {
  return { value: String(value), textContent: name, selected };
}

function makeSelect(taxonomy, options, calls) {
  return {
    name: `tax_input[${taxonomy}][]`,
    options,
    dispatchEvent(event) {
      calls.events.push({ taxonomy, type: event.type });
      return true;
    }
  };
}

function makeBridgeFixture(options = {}) {
  const calls = { editPost: [], events: [], savePost: 0 };
  const selects = [
    makeSelect('category', [
      makeOption(4, 'Research', Boolean(options.researchSelected)),
      makeOption(420, 'Alumni News'),
      makeOption(421, 'Faculty News'),
      makeOption(422, 'Donor News'),
      makeOption(423, 'Student News', options.studentNewsSelected !== false),
      makeOption(500, 'Staff News')
    ], calls),
    makeSelect('post_tag', [
      makeOption('Rural Health', 'Rural Health'),
      makeOption('Rural Nursing Pathway', 'Rural Nursing Pathway'),
      makeOption('Alumni News', 'Alumni News'),
      makeOption('Donor News', 'Donor News'),
      makeOption('Faculty News', 'Faculty News'),
      makeOption('Staff News', 'Staff News'),
      makeOption('Student News', 'Student News', Boolean(options.studentTagSelected)),
      makeOption('Old Tag', 'Old Tag', Boolean(options.oldTagSelected))
    ], calls),
    makeSelect('wsuwp_university_category', [
      makeOption(17, 'Nursing'),
      makeOption(331, 'Research', Boolean(options.universityResearchSelected)),
      makeOption(400, 'Old University Category', Boolean(options.oldUniversityCategorySelected))
    ], calls),
    makeSelect('wsuwp_university_location', [
      makeOption(16, 'WSU Spokane', options.spokaneSelected !== false),
      makeOption(19, 'WSU Tri-Cities'),
      makeOption(20, 'WSU Vancouver'),
      makeOption(282, 'WSU Pullman')
    ], calls),
    makeSelect('wsuwp_university_org', [
      makeOption(15, 'College of Nursing', options.nursingOrgSelected !== false),
      makeOption(347, 'Elson S. Floyd College of Medicine', Boolean(options.medicineSelected))
    ], calls)
  ];
  const editedAttributes = {
    title: options.title || 'College expands Rural Nursing Pathway with health partnership',
    excerpt: options.excerpt || 'A rural health partnership for nursing students.',
    meta: options.meta || {},
    categories: [],
    tags: []
  };
  let messageListener;
  let responseResolver;

  const editorSelectors = {
    getCurrentPostType: () => options.postType || 'post',
    getEditedPostAttribute: (name) => editedAttributes[name]
  };
  const blockSelectors = {
    getBlocks: () => [
      {
        name: 'core/paragraph',
        attributes: { content: options.body || 'The Rural Nursing Pathway supports workforce development.' },
        innerBlocks: []
      }
    ]
  };
  const redirectFields = options.redirectUrl ? [{
    id: 'redirect_to',
    name: 'redirect_to',
    value: options.redirectUrl,
    getAttribute: () => ''
  }] : [];
  const document = {
    createElement: () => {
      const template = {
        content: { textContent: '' },
        set innerHTML(value) {
          this.content.textContent = String(value || '').replace(/<[^>]*>/g, ' ');
        }
      };
      return template;
    },
    querySelectorAll: (selector) => {
      if (selector === 'select[name^="tax_input["]') {
        return selects;
      }

      if (selector === 'input, textarea') {
        return redirectFields;
      }

      return [];
    },
    body: { textContent: '' }
  };
  const context = {
    console,
    document,
    Event: class Event {
      constructor(type) {
        this.type = type;
      }
    },
    Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
    setTimeout,
    clearTimeout,
    WSU_WDS_TAXONOMY_CLASSIFIER: classifier,
    WSU_WDS_TAXONOMY_CONFIG: config
  };

  context.window = context;
  context.wp = {
    data: {
      select: (store) => ({
        'core/editor': editorSelectors,
        'core/block-editor': blockSelectors
      })[store],
      dispatch: (store) => {
        if (store === 'core/editor') {
          return {
            editPost: (updates) => calls.editPost.push(updates),
            savePost: () => {
              calls.savePost += 1;
            }
          };
        }

        return {};
      }
    }
  };
  context.addEventListener = (type, listener) => {
    if (type === 'message') {
      messageListener = listener;
    }
  };
  context.postMessage = (data) => {
    if (data?.source === 'WSU_WDS_PAGE' && responseResolver) {
      const resolve = responseResolver;
      responseResolver = null;
      resolve(data.response);
    }
  };

  vm.createContext(context);
  const windowRef = vm.runInContext('window', context);
  const bridgePath = path.join(__dirname, '..', 'wp-bulk-editor-extension', 'page-bridge.js');
  vm.runInContext(fs.readFileSync(bridgePath, 'utf8'), context, { filename: bridgePath });

  return {
    calls,
    selects,
    selected(taxonomy) {
      const select = selects.find((item) => item.name.includes(`[${taxonomy}]`));
      return select.options.filter((option) => option.selected).map((option) => option.textContent);
    },
    send(action, payload = {}) {
      return new Promise((resolve) => {
        responseResolver = resolve;
        messageListener({
          source: windowRef,
          data: { source: 'WSU_WDS_CONTENT', id: action, action, payload }
        });
      });
    }
  };
}

test('analysis includes all five taxonomy panels, defaults, and additional content locations', async () => {
  const fixture = makeBridgeFixture({
    body: 'The Rural Nursing Pathway will serve nursing students at WSU Vancouver.'
  });
  const analysis = await fixture.send('analyzeTaxonomySuggestions');
  const keys = analysis.suggestions.map((item) => item.taxonomy + ':' + item.name);

  assert.equal(analysis.ok, true);
  assert.ok(keys.includes('post_tag:Rural Health'));
  assert.ok(keys.includes('post_tag:Rural Nursing Pathway'));
  assert.ok(keys.includes('wsuwp_university_location:WSU Vancouver'));
  assert.ok(analysis.existing.some((item) => item.name === 'WSU Spokane'));
  assert.ok(analysis.existing.some((item) => item.name === 'College of Nursing'));
});

test('homepage mode exposes five audiences and prechecks the matching Site Category audience', async () => {
  const fixture = makeBridgeFixture({ studentTagSelected: true });
  const analysis = await fixture.send('analyzeTaxonomySuggestions', { homepageNews: true });
  const homepage = analysis.suggestions.filter((item) => (
    item.taxonomy === 'post_tag' && ['Alumni News', 'Donor News', 'Faculty News', 'Staff News', 'Student News'].includes(item.name)
  ));

  assert.equal(homepage.length, 5);
  assert.equal(homepage.find((item) => item.name === 'Student News').checked, true);
  assert.equal(homepage.find((item) => item.name === 'Student News').alreadyAssigned, true);
  assert.equal(homepage.find((item) => item.name === 'Faculty News').checked, false);
});

test('University Categories and additional Organizations use conservative existing-name matches', async () => {
  const fixture = makeBridgeFixture({
    title: 'Faculty Research partnership with Elson S. Floyd College of Medicine',
    excerpt: 'Recent publications describe the collaboration.',
    body: 'The research findings support nursing practice.'
  });
  const analysis = await fixture.send('analyzeTaxonomySuggestions');
  const keys = analysis.suggestions.map((item) => item.taxonomy + ':' + item.name);

  assert.ok(keys.includes('wsuwp_university_category:Research'));
  assert.ok(keys.includes('wsuwp_university_org:Elson S. Floyd College of Medicine'));
});

test('add mode selects checked existing options without clearing assignments or saving', async () => {
  const fixture = makeBridgeFixture();
  const analysis = await fixture.send('analyzeTaxonomySuggestions');
  const ruralSuggestions = analysis.suggestions.filter((item) => (
    item.taxonomy === 'post_tag' && item.name.startsWith('Rural')
  ));
  const applied = await fixture.send('applyTaxonomySuggestions', {
    selections: ruralSuggestions.map((item) => ({
      taxonomy: item.taxonomy,
      termKey: item.termKey,
      name: item.name
    }))
  });

  assert.equal(applied.ok, true);
  assert.deepEqual(fixture.selected('category'), ['Student News']);
  assert.deepEqual(fixture.selected('post_tag'), ['Rural Health', 'Rural Nursing Pathway']);
  assert.equal(fixture.calls.savePost, 0);
  assert.match(applied.message, /Post was not saved/);
});

test('replace mode requires confirmation and replaces all five managed panel selections', async () => {
  const fixture = makeBridgeFixture({
    oldTagSelected: true,
    oldUniversityCategorySelected: true,
    medicineSelected: true,
    researchSelected: true
  });
  const analysis = await fixture.send('analyzeTaxonomySuggestions', {
    homepageNews: true,
    replaceExisting: true
  });
  const keepNames = new Set([
    'Student News',
    'Rural Health',
    'Rural Nursing Pathway',
    'WSU Spokane',
    'College of Nursing'
  ]);
  const selections = analysis.suggestions.filter((item) => item.checked && keepNames.has(item.name)).map((item) => ({
    taxonomy: item.taxonomy,
    termKey: item.termKey,
    name: item.name
  }));

  const denied = await fixture.send('applyTaxonomySuggestions', {
    selections,
    replaceExisting: true
  });
  assert.equal(denied.ok, false);
  assert.ok(fixture.selected('post_tag').includes('Old Tag'));

  const applied = await fixture.send('applyTaxonomySuggestions', {
    selections,
    replaceExisting: true,
    replacementConfirmation: 'REPLACE_EXISTING_TAXONOMIES'
  });

  assert.equal(applied.ok, true);
  assert.deepEqual(fixture.selected('category'), ['Student News']);
  assert.deepEqual(fixture.selected('post_tag'), ['Rural Health', 'Rural Nursing Pathway', 'Student News']);
  assert.deepEqual(fixture.selected('wsuwp_university_category'), []);
  assert.deepEqual(fixture.selected('wsuwp_university_location'), ['WSU Spokane']);
  assert.deepEqual(fixture.selected('wsuwp_university_org'), ['College of Nursing']);
  assert.equal(fixture.calls.savePost, 0);
  assert.match(applied.details, /Cleared:/);
});

test('bridge abstains when the visible Redirect Post field contains a destination URL', async () => {
  const fixture = makeBridgeFixture({ redirectUrl: 'https://news.wsu.edu/example/' });
  const analysis = await fixture.send('analyzeTaxonomySuggestions');

  assert.equal(analysis.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(analysis.suggestions)), []);
  assert.match(analysis.message, /redirect post/);
  assert.equal(fixture.calls.savePost, 0);
});
