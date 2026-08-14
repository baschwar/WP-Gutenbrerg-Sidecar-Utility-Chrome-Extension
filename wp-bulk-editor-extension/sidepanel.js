const fixHeadingOrderButton = document.querySelector("#fix-heading-order");
const fixUrlLinkTextButton = document.querySelector("#fix-url-link-text");
const fixGenericLinkTextButton = document.querySelector("#fix-generic-link-text");
const fixEmailLinkTextButton = document.querySelector("#fix-email-link-text");
const fixUrlDefenseLinksButton = document.querySelector("#fix-urldefense-links");
const fixNewTabLinksButton = document.querySelector("#fix-new-tab-links");
const fixLinkedImageAltButton = document.querySelector("#fix-linked-image-alt");
const suggestAltTextButton = document.querySelector("#suggest-alt-text");
const applyAltSuggestionsButton = document.querySelector("#apply-alt-suggestions");
const deselectAltSuggestionsButton = document.querySelector("#deselect-alt-suggestions");
const altSuggestionActionsEl = document.querySelector("#alt-suggestion-actions");
const altSuggestionsEl = document.querySelector("#alt-suggestions");
const includePageTitleAltInput = document.querySelector("#include-page-title-alt");
const fixBoldParagraphsButton = document.querySelector("#fix-bold-paragraphs");
const fixShortBoldHeadingsButton = document.querySelector("#fix-short-bold-headings");
const fixLeadingBoldLineButton = document.querySelector("#fix-leading-bold-line");
const boldMaxCharsInput = document.querySelector("#bold-max-chars");
const boldHeadingMaxWordsInput = document.querySelector("#bold-heading-max-words");
const resaveNoDataButton = document.querySelector("#resave-no-data");
const openVisibleListButton = document.querySelector("#open-visible-list");
const makeHeadingsH2Button = document.querySelector("#make-headings-h2");
const unboldHeadingBlocksButton = document.querySelector("#unbold-heading-blocks");
const changeHeadingLevelButton = document.querySelector("#change-heading-level");
const headingLevelFromSelect = document.querySelector("#heading-level-from");
const headingLevelToSelect = document.querySelector("#heading-level-to");
const scanHeadingBlocksButton = document.querySelector("#scan-heading-blocks");
const applySelectedHeadingLevelButton = document.querySelector("#apply-selected-heading-level");
const deselectHeadingBlocksButton = document.querySelector("#deselect-heading-blocks");
const selectedHeadingLevelSelect = document.querySelector("#selected-heading-level");
const headingBlockListEl = document.querySelector("#heading-block-list");
const headingBlockActionsEl = document.querySelector("#heading-block-actions");
const applyButton = document.querySelector("#apply-h2");
const inspectButton = document.querySelector("#inspect-block");
const fontSizeSelect = document.querySelector("#font-size");
const showAllToolsInput = document.querySelector("#show-all-tools");
const refreshRelevantToolsButton = document.querySelector("#refresh-relevant-tools");
const filterSummaryEl = document.querySelector("#filter-summary");
const analyzeTaxonomiesButton = document.querySelector("#analyze-taxonomies");
const applyTaxonomySuggestionsButton = document.querySelector("#apply-taxonomy-suggestions");
const deselectTaxonomySuggestionsButton = document.querySelector("#deselect-taxonomy-suggestions");
const taxonomySuggestionActionsEl = document.querySelector("#taxonomy-suggestion-actions");
const taxonomySuggestionsEl = document.querySelector("#taxonomy-suggestions");
const homepageNewsStoryInput = document.querySelector("#homepage-news-story");
const replaceTaxonomyAssignmentsInput = document.querySelector("#replace-taxonomy-assignments");
const textSearchInput = document.querySelector("#text-search");
const textReplacementInput = document.querySelector("#text-replacement");
const textSearchCaseSensitiveInput = document.querySelector("#text-search-case-sensitive");
const textSearchWholeWordInput = document.querySelector("#text-search-whole-word");
const findTextButton = document.querySelector("#find-text");
const findNextTextButton = document.querySelector("#find-next-text");
const replaceCurrentTextButton = document.querySelector("#replace-current-text");
const replaceAllTextButton = document.querySelector("#replace-all-text");
const textReplacementCurrentEl = document.querySelector("#text-replacement-current");
const feedbackEl = document.querySelector("#feedback");
const statusEl = document.querySelector("#status");
const detailsEl = document.querySelector("#details");

const SIZE_VALUES = ["Medium", "xMedium", "xxMedium", "Large", "xLarge", "xxLarge"];
let currentAltSuggestions = [];
let currentHeadingBlocks = [];
let currentTaxonomySuggestions = [];
let currentTextReplacementCandidates = [];
let currentTextReplacementQuery = null;
let currentTextReplacementIndex = -1;

const ISSUE_FIX_RULES = [
  { pattern: /links?\s+(?:is|are)?\s*set\s+to\s+open\s+in\s+a\s+new\s+tab/i, fixes: ["new-tab-link"] },
  { pattern: /links?\s+with\s+generic\s+text/i, fixes: ["generic-link-text"] },
  { pattern: /(?:email links? with (?:generic text|email addresses? as (?:the )?link text)|email addresses? used as link text)/i, fixes: ["email-link-text"] },
  { pattern: /incorrect\s+heading\s+order/i, fixes: ["heading-order", "heading-level"] },
  { pattern: /urldefense\.com/i, fixes: ["urldefense-link"] },
  { pattern: /safelinks\.protection\.outlook\.com/i, fixes: ["safelinks-link"] },
  { pattern: /(?:link\s+text\s+containing\s+the\s+url\s+protocol|links?\s+containing\s+the\s+url\s+protocol|url\s+protocol[^.]*link\s+text)/i, fixes: ["url-link-text"] },
  { pattern: /(?:link\s+text\s+containing\s+a\s+long\s+url|links?\s+may\s+contain\s+a\s+long\s+url|long\s+url[^.]*link\s+text)/i, fixes: ["long-url-link-text", "url-link-text"] },
  { pattern: /linked\s+image\s+missing\s+alt\s+text/i, fixes: ["linked-image-alt", "image-alt"] },
  { pattern: /images?\s+missing\s+alt\s+text/i, fixes: ["image-alt"] },
  { pattern: /images?\s+where\s+alt\s+text\s+should\s+be\s+the\s+destination/i, fixes: ["destination-alt", "linked-image-alt"] },
  { pattern: /paragraphs?\s+(?:contains?|with)\s+only\s+bold(?:ed)?\s+text/i, fixes: ["bold-paragraph"] }
];

function getToolCards() {
  return Array.from(document.querySelectorAll(".utility-card[data-fixes]"));
}

function getDetectedFixes(issueText) {
  const fixes = new Set();

  ISSUE_FIX_RULES.forEach((rule) => {
    if (rule.pattern.test(issueText)) {
      rule.fixes.forEach((fix) => fixes.add(fix));
    }
  });

  return fixes;
}

function setFilterSummary(message) {
  filterSummaryEl.hidden = !message;
  filterSummaryEl.textContent = message || "";
}

function showAllToolCards() {
  getToolCards().forEach((card) => card.removeAttribute("hidden-by-filter"));
  Array.from(document.querySelectorAll("section.panel")).forEach((panel) => panel.removeAttribute("hidden-by-filter"));
  setFilterSummary("");
}

function applyToolFilter(fixes, issueCount = 0) {
  const cards = getToolCards();
  let visibleCount = 0;

  cards.forEach((card) => {
    const cardFixes = (card.dataset.fixes || "").split(/\s+/).filter(Boolean);
    const shouldShow = cardFixes.some((fix) => fixes.has(fix));

    card.toggleAttribute("hidden-by-filter", !shouldShow);
    if (shouldShow) {
      visibleCount += 1;
    }
  });

  Array.from(document.querySelectorAll("section.panel")).forEach((panel) => {
    const panelCards = Array.from(panel.querySelectorAll(".utility-card[data-fixes]"));
    const hasVisibleCard = panelCards.some((card) => !card.hasAttribute("hidden-by-filter"));

    panel.toggleAttribute("hidden-by-filter", panelCards.length > 0 && !hasVisibleCard);
  });

  if (!issueCount) {
    setFilterSummary("No visible Accessibility & Usability issues detected. Turn Show all tools back on if needed.");
  } else if (!visibleCount) {
    setFilterSummary("Detected " + issueCount + " issue text item" + (issueCount === 1 ? "" : "s") + ", but no matching sidecar tools yet.");
  } else {
    setFilterSummary("Showing " + visibleCount + " relevant tool" + (visibleCount === 1 ? "" : "s") + " for " + issueCount + " detected issue text item" + (issueCount === 1 ? "" : "s") + ".");
  }
}

async function refreshRelevantTools() {
  if (showAllToolsInput.checked) {
    showAllToolCards();
    return;
  }

  refreshRelevantToolsButton.disabled = true;
  setFilterSummary("Scanning Accessibility & Usability panel...");

  try {
    const response = await runInEditorTab("scanVisibleAccessibilityIssues");
    const issueText = response.issueText || "";
    const fixes = getDetectedFixes(issueText);

    applyToolFilter(fixes, response.issueCount || 0);
  } catch (error) {
    showAllToolCards();
    showAllToolsInput.checked = true;
    setFilterSummary("Could not scan Accessibility & Usability issues. Showing all tools.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    refreshRelevantToolsButton.disabled = false;
  }
}

function moveFeedbackToButton(button) {
  if (button.closest('.tooltip-heading') || button.classList.contains('tooltip-trigger')) {
    return;
  }

  const card = button.closest('.utility-card') || button.closest('.panel');

  if (!card) {
    return;
  }

  card.appendChild(feedbackEl);
  feedbackEl.hidden = false;
}

showAllToolsInput.addEventListener("change", refreshRelevantTools);
refreshRelevantToolsButton.addEventListener("click", refreshRelevantTools);
showAllToolCards();

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');

  if (!button) {
    return;
  }

  moveFeedbackToButton(button);
});

function setStatus(message) {
  statusEl.textContent = message;
}

function setDetails(value) {
  detailsEl.hidden = !value;
  detailsEl.textContent = value || "";
}

function isWordPressEditorUrl(url = "") {
  try {
    const parsed = new URL(url);

    if (!parsed.pathname.match(/\/wp-admin\/(post|post-new)\.php$/)) {
      return false;
    }

    return parsed.pathname.endsWith("/post-new.php") || parsed.searchParams.get("action") === "edit";
  } catch (_error) {
    return false;
  }
}

function isWordPressListUrl(url = "") {
  try {
    return new URL(url).pathname.endsWith("/wp-admin/edit.php");
  } catch (_error) {
    return false;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Timed out waiting for the WordPress tab to load."));
    }, 30000);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") {
        return;
      }

      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function getEditorTab() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (activeTab?.id && isWordPressEditorUrl(activeTab.url)) {
    return activeTab;
  }

  const editorTabs = await chrome.tabs.query({
    currentWindow: true,
    url: [
      "*://*/wp-admin/post.php*",
      "*://*/wp-admin/post-new.php*",
      "*://*/*/wp-admin/post.php*",
      "*://*/*/wp-admin/post-new.php*"
    ]
  });
  const editorTab = editorTabs.find((tab) => isWordPressEditorUrl(tab.url)) || editorTabs[0];

  if (editorTab?.id) {
    return editorTab;
  }

  if (!activeTab?.id) {
    throw new Error("No WordPress editor tab found. Click the WordPress editor tab, then run this utility again.");
  }

  return activeTab;
}

async function runInTab(tab, action, payload = {}) {
  setDetails("Target tab: " + (tab.title || tab.url || "WordPress"));

  try {
    return await chrome.tabs.sendMessage(tab.id, {
      source: "WSU_WDS_SIDEPANEL",
      action,
      payload
    });
  } catch (error) {
    throw new Error("Could not reach the WSU WDS content script. Reload the WordPress tab, then try again. " + (error.message || ""));
  }
}

async function runInEditorTab(action, payload = {}) {
  return runInTab(await getEditorTab(), action, payload);
}

async function getActiveWordPressTab() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!activeTab?.id) {
    throw new Error("Click the WordPress tab, then run this utility again.");
  }

  return activeTab;
}

function renderTaxonomySuggestions(response) {
  currentTaxonomySuggestions = response.suggestions || [];
  taxonomySuggestionsEl.textContent = "";
  taxonomySuggestionsEl.hidden = !currentTaxonomySuggestions.length;
  taxonomySuggestionActionsEl.hidden = !currentTaxonomySuggestions.length;

  currentTaxonomySuggestions.forEach((suggestion, index) => {
    const item = document.createElement("div");
    item.className = "suggestion-item";

    const header = document.createElement("label");
    header.className = "suggestion-header";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = suggestion.checked !== false;
    checkbox.dataset.index = String(index);

    const title = document.createElement("span");
    title.className = "taxonomy-term-name";
    title.textContent = (suggestion.taxonomyLabel || suggestion.taxonomy) + ": " + suggestion.name;

    if (suggestion.score > 0) {
      const score = document.createElement("span");
      score.className = "taxonomy-score";
      score.textContent = "score " + suggestion.score;
      title.append(score);
    }
    header.append(checkbox, title);

    const meta = document.createElement("div");
    meta.className = "suggestion-meta";
    meta.textContent = (suggestion.alreadyAssigned ? "Already selected. " : "")
      + (suggestion.reason || "Matched a reviewed local rule.");

    item.append(header, meta);
    taxonomySuggestionsEl.append(item);
  });
}

analyzeTaxonomiesButton.addEventListener("click", async () => {
  analyzeTaxonomiesButton.disabled = true;
  taxonomySuggestionsEl.hidden = true;
  taxonomySuggestionActionsEl.hidden = true;
  taxonomySuggestionsEl.textContent = "";
  currentTaxonomySuggestions = [];
  setStatus("Analyzing the open post with local rules...");
  setDetails("");

  try {
    const response = await runInEditorTab("analyzeTaxonomySuggestions", {
      homepageNews: homepageNewsStoryInput.checked,
      replaceExisting: replaceTaxonomyAssignmentsInput.checked
    });

    renderTaxonomySuggestions(response);
    setStatus(response.message);
    setDetails(response.details || "");
  } catch (error) {
    setStatus(error.message || "Could not analyze categories and tags.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    analyzeTaxonomiesButton.disabled = false;
  }
});

deselectTaxonomySuggestionsButton.addEventListener("click", () => {
  taxonomySuggestionsEl.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = false;
  });
});

replaceTaxonomyAssignmentsInput.addEventListener("change", () => {
  if (!currentTaxonomySuggestions.length) {
    return;
  }

  currentTaxonomySuggestions = [];
  taxonomySuggestionsEl.textContent = "";
  taxonomySuggestionsEl.hidden = true;
  taxonomySuggestionActionsEl.hidden = true;
  setStatus("Replacement mode changed. Analyze the post again before applying.");
  setDetails("");
});

homepageNewsStoryInput.addEventListener("change", () => {
  if (!currentTaxonomySuggestions.length) {
    return;
  }

  currentTaxonomySuggestions = [];
  taxonomySuggestionsEl.textContent = "";
  taxonomySuggestionsEl.hidden = true;
  taxonomySuggestionActionsEl.hidden = true;
  setStatus("Homepage News mode changed. Analyze the post again before applying.");
  setDetails("");
});

applyTaxonomySuggestionsButton.addEventListener("click", async () => {
  applyTaxonomySuggestionsButton.disabled = true;
  setStatus("Applying checked categories and tags to the unsaved post...");
  setDetails("");

  try {
    const selections = Array.from(taxonomySuggestionsEl.querySelectorAll('input[type="checkbox"]:checked')).map((checkbox) => {
      const suggestion = currentTaxonomySuggestions[Number.parseInt(checkbox.dataset.index, 10)];
      return suggestion ? {
        taxonomy: suggestion.taxonomy,
        termKey: suggestion.termKey,
        name: suggestion.name
      } : null;
    }).filter(Boolean);

    if (!selections.length) {
      setStatus(replaceTaxonomyAssignmentsInput.checked
        ? "Replacement requires at least one checked suggestion."
        : "No checked category or tag suggestions to apply.");
      return;
    }

    let replacementConfirmation = "";

    if (replaceTaxonomyAssignmentsInput.checked) {
      const confirmed = window.confirm(
        "Replace all existing Site Categories, University Tags, University Categories, University Locations, and University Organizations with the checked suggestions?\n\nThis changes only the unsaved editor state."
      );

      if (!confirmed) {
        setStatus("Existing taxonomy selections were left unchanged.");
        return;
      }

      replacementConfirmation = "REPLACE_EXISTING_TAXONOMIES";
    }

    const response = await runInEditorTab("applyTaxonomySuggestions", {
      selections,
      replaceExisting: replaceTaxonomyAssignmentsInput.checked,
      replacementConfirmation
    });

    taxonomySuggestionsEl.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.checked = false;
    });
    setStatus(response.message);
    setDetails(response.details || "");
  } catch (error) {
    setStatus(error.message || "Could not apply category and tag suggestions.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    applyTaxonomySuggestionsButton.disabled = false;
  }
});

function getTextReplacementQuery() {
  return {
    search: textSearchInput.value,
    replacement: textReplacementInput.value,
    caseSensitive: textSearchCaseSensitiveInput.checked,
    wholeWord: textSearchWholeWordInput.checked
  };
}

function expandTextReplacementCandidates(candidates) {
  const renderedOffsets = new Map();

  return candidates.flatMap((candidate) => {
    const renderedKey = candidate.target === "block"
      ? `block:${candidate.clientId}`
      : `post:${candidate.field}`;
    const renderedOffset = renderedOffsets.get(renderedKey) || 0;
    renderedOffsets.set(renderedKey, renderedOffset + candidate.count);

    return Array.from({ length: candidate.count }, (_value, occurrenceIndex) => ({
      ...candidate,
      occurrenceIndex,
      renderedOccurrenceIndex: renderedOffset + occurrenceIndex,
      preview: candidate.previews?.[occurrenceIndex] || candidate.preview
    }));
  });
}

function clearEditorTextHighlight() {
  getEditorTab()
    .then((tab) => chrome.tabs.sendMessage(tab.id, {
      source: "WSU_WDS_SIDEPANEL",
      action: "clearTextReplacementHighlight",
      payload: {}
    }))
    .catch(() => {});
}

function clearTextReplacementResults(message = "") {
  clearEditorTextHighlight();
  currentTextReplacementCandidates = [];
  currentTextReplacementQuery = null;
  currentTextReplacementIndex = -1;
  textReplacementCurrentEl.hidden = true;
  textReplacementCurrentEl.textContent = "";
  findNextTextButton.disabled = true;
  replaceCurrentTextButton.disabled = true;

  if (message) {
    setStatus(message);
  }
}

async function showCurrentTextReplacement() {
  const candidate = currentTextReplacementCandidates[currentTextReplacementIndex];

  if (!candidate) {
    clearEditorTextHighlight();
    textReplacementCurrentEl.hidden = true;
    findNextTextButton.disabled = true;
    replaceCurrentTextButton.disabled = true;
    return;
  }

  textReplacementCurrentEl.textContent = "";
  const heading = document.createElement("strong");
  heading.textContent = `Match ${currentTextReplacementIndex + 1} of ${currentTextReplacementCandidates.length} — ${candidate.label}`;
  const preview = document.createElement("div");
  preview.className = "text-replacement-preview";
  preview.textContent = candidate.preview || "Matching text";
  textReplacementCurrentEl.append(heading, preview);
  textReplacementCurrentEl.hidden = false;
  findNextTextButton.disabled = currentTextReplacementCandidates.length < 2;
  replaceCurrentTextButton.disabled = false;

  try {
    await runInEditorTab("focusTextReplacementCandidate", {
      target: candidate,
      search: currentTextReplacementQuery?.search || "",
      caseSensitive: currentTextReplacementQuery?.caseSensitive,
      wholeWord: currentTextReplacementQuery?.wholeWord,
      renderedOccurrenceIndex: candidate.renderedOccurrenceIndex
    });
  } catch (_error) {
    // The side-panel preview remains usable when the editor cannot scroll to a block.
  }
}

async function findTextMatches({ preserveIndex = false } = {}) {
  const query = getTextReplacementQuery();

  if (!query.search.length) {
    clearTextReplacementResults("Enter text to find first.");
    textSearchInput.focus();
    return null;
  }

  const previousIndex = currentTextReplacementIndex;
  setStatus("Finding text in the open editor...");
  setDetails("");
  const response = await runInEditorTab("scanTextReplacements", query);

  if (!response.ok) {
    throw new Error(response.message || "Could not find text.");
  }

  currentTextReplacementQuery = query;
  currentTextReplacementCandidates = expandTextReplacementCandidates(response.candidates || []);
  currentTextReplacementIndex = currentTextReplacementCandidates.length
    ? Math.min(preserveIndex ? Math.max(previousIndex, 0) : 0, currentTextReplacementCandidates.length - 1)
    : -1;
  setStatus(response.message);
  setDetails(response.details || "");
  await showCurrentTextReplacement();
  return response;
}

findTextButton.addEventListener("click", async () => {
  findTextButton.disabled = true;

  try {
    await findTextMatches();
  } catch (error) {
    clearTextReplacementResults();
    setStatus(error.message || "Could not find text.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    findTextButton.disabled = false;
  }
});

findNextTextButton.addEventListener("click", async () => {
  if (!currentTextReplacementCandidates.length) {
    return;
  }

  currentTextReplacementIndex = (currentTextReplacementIndex + 1) % currentTextReplacementCandidates.length;
  setStatus(currentTextReplacementIndex === 0 ? "Wrapped to the first match." : "Moved to the next match.");
  await showCurrentTextReplacement();
});

replaceCurrentTextButton.addEventListener("click", async () => {
  const candidate = currentTextReplacementCandidates[currentTextReplacementIndex];

  if (!candidate || !currentTextReplacementQuery) {
    clearTextReplacementResults("Find a current match before replacing it.");
    return;
  }

  replaceCurrentTextButton.disabled = true;
  setStatus("Replacing the current match...");
  setDetails("");

  try {
    const response = await runInEditorTab("applySingleTextReplacement", {
      ...currentTextReplacementQuery,
      replacement: textReplacementInput.value,
      target: candidate,
      occurrenceIndex: candidate.occurrenceIndex
    });

    if (!response.ok) {
      throw new Error(response.message || "Could not replace the current match.");
    }

    setStatus(response.message);
    setDetails(response.details || "");
    await findTextMatches({ preserveIndex: true });
  } catch (error) {
    setStatus(error.message || "Could not replace the current match.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    replaceCurrentTextButton.disabled = !currentTextReplacementCandidates.length;
  }
});

replaceAllTextButton.addEventListener("click", async () => {
  const query = getTextReplacementQuery();

  if (!query.search.length) {
    clearTextReplacementResults("Enter text to find first.");
    textSearchInput.focus();
    return;
  }

  replaceAllTextButton.disabled = true;
  setStatus("Finding all matches before replacement...");
  setDetails("");

  try {
    const scan = await runInEditorTab("scanTextReplacements", query);

    if (!scan.ok) {
      throw new Error(scan.message || "Could not find text.");
    }

    if (!(scan.candidates || []).length) {
      clearTextReplacementResults(scan.message);
      setDetails(scan.details || "Nothing was changed or saved.");
      return;
    }

    const response = await runInEditorTab("applyTextReplacements", {
      ...query,
      targets: scan.candidates
    });

    if (!response.ok) {
      throw new Error(response.message || "Could not replace all text.");
    }

    clearTextReplacementResults();
    setStatus(response.message);
    setDetails(response.details || "");
  } catch (error) {
    setStatus(error.message || "Could not replace all text.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    replaceAllTextButton.disabled = false;
  }
});

[textSearchInput, textSearchCaseSensitiveInput, textSearchWholeWordInput].forEach((control) => {
  control.addEventListener("input", () => {
    if (currentTextReplacementQuery) {
      clearTextReplacementResults("Search options changed. Choose Find to start again.");
    }
  });
});

textSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    findTextButton.click();
  }
});


resaveNoDataButton.addEventListener("click", async () => {
  resaveNoDataButton.disabled = true;
  setStatus("Scanning visible list rows...");
  setDetails("");

  try {
    const tab = await getActiveWordPressTab();

    if (!isWordPressListUrl(tab.url)) {
      throw new Error("Open a WordPress Posts or Pages list screen first, then run this utility.");
    }

    const listUrl = tab.url;
    const scan = await runInTab(tab, "scanAccessibilityNoDataRows");
    const items = scan.items || [];

    if (!items.length) {
      setStatus("No visible No Data rows found.");
      setDetails(scan.details || "Try increasing Screen Options items per page if more rows need checking.");
      return;
    }

    const results = [];

    for (const [index, item] of items.entries()) {
      setStatus("Saving " + (index + 1) + " of " + items.length + "...");
      setDetails("Opening: " + (item.title || item.url));
      const loadPromise = waitForTabLoad(tab.id);
      await chrome.tabs.update(tab.id, { url: item.url });
      await loadPromise;
      await delay(1200);

      const response = await runInTab(tab, "saveCurrentPostForAccessibilityRefresh");
      results.push((item.title || item.url) + ": " + response.message);
      await delay(900);
    }

    setStatus("Re-saved " + items.length + " item" + (items.length === 1 ? "" : "s") + ".");
    setDetails(results.join("\n"));
    const returnLoad = waitForTabLoad(tab.id);
    await chrome.tabs.update(tab.id, { url: listUrl });
    await returnLoad;
  } catch (error) {
    setStatus(error.message || "Could not re-save No Data items.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    resaveNoDataButton.disabled = false;
  }
});

openVisibleListButton.addEventListener("click", async () => {
  openVisibleListButton.disabled = true;
  setStatus("Scanning visible list rows...");
  setDetails("");

  try {
    const listTab = await getActiveWordPressTab();

    if (!isWordPressListUrl(listTab.url)) {
      throw new Error("Open a WordPress list screen first, then run this utility.");
    }

    const scan = await runInTab(listTab, "scanVisibleListRows");
    const items = scan.items || [];

    if (!items.length) {
      setStatus("No visible editable rows found.");
      setDetails(scan.details || "Try increasing Screen Options items per page if more rows need opening.");
      return;
    }

    for (const [index, item] of items.entries()) {
      setStatus("Opening " + (index + 1) + " of " + items.length + "...");
      setDetails("Opening: " + (item.title || item.url));
      await chrome.tabs.create({
        active: false,
        index: (listTab.index || 0) + index + 1,
        url: item.url
      });
      await delay(150);
    }

    setStatus("Opened " + items.length + " visible item" + (items.length === 1 ? "" : "s") + " in new tabs.");
    setDetails(items.map((item) => item.title || item.url).join("\n"));
  } catch (error) {
    setStatus(error.message || "Could not open visible list items.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    openVisibleListButton.disabled = false;
  }
});

fixHeadingOrderButton.addEventListener("click", async () => {
  fixHeadingOrderButton.disabled = true;
  setStatus("Fixing heading order...");
  setDetails("");

  try {
    const response = await runInEditorTab("makeAllHeadingsH2");

    setStatus(response.message);
    setDetails(response.details || "");
  } catch (error) {
    setStatus(error.message || "Could not fix heading order.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    fixHeadingOrderButton.disabled = false;
  }
});

async function replaceLinkTextWithTitles(options) {
  const button = options.button;
  button.disabled = true;
  setStatus(options.findingMessage);
  setDetails("");

  try {
    const scan = await runInEditorTab("scanLinkTextForTitles", { mode: options.mode });

    if (!scan.candidates?.length) {
      setStatus(options.emptyMessage);
      setDetails(scan.details || "");
      return;
    }

    setStatus(`Fetching ${scan.candidates.length} page title${scan.candidates.length === 1 ? "" : "s"}...`);
    setDetails(scan.details || "");
    const titleMap = await fetchPageTitles(scan.candidates.map((candidate) => candidate.href));
    const response = await runInEditorTab("applyLinkTextTitles", {
      mode: options.mode,
      titleMap
    });

    setStatus(response.message);
    setDetails(response.details || "");
  } catch (error) {
    setStatus(error.message || options.errorMessage);
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    button.disabled = false;
  }
}

fixUrlLinkTextButton.addEventListener("click", () => {
  replaceLinkTextWithTitles({
    button: fixUrlLinkTextButton,
    mode: "url",
    findingMessage: "Finding URL link text...",
    emptyMessage: "No URL link text found.",
    errorMessage: "Could not fix URL link text."
  });
});

fixGenericLinkTextButton.addEventListener("click", () => {
  replaceLinkTextWithTitles({
    button: fixGenericLinkTextButton,
    mode: "generic",
    findingMessage: "Finding generic link text...",
    emptyMessage: "No generic link text found.",
    errorMessage: "Could not fix generic link text."
  });
});

fixEmailLinkTextButton.addEventListener("click", async () => {
  fixEmailLinkTextButton.disabled = true;
  setStatus("Fixing email link text...");
  setDetails("");

  try {
    const response = await runInEditorTab("fixEmailLinkText");

    setStatus(response.message);
    setDetails(response.details || "");
  } catch (error) {
    setStatus(error.message || "Could not fix email link text.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    fixEmailLinkTextButton.disabled = false;
  }
});

fixUrlDefenseLinksButton.addEventListener("click", async () => {
  fixUrlDefenseLinksButton.disabled = true;
  setStatus("Unwrapping tracked links...");
  setDetails("");

  try {
    const response = await runInEditorTab("unwrapUrlDefenseLinks");

    setStatus(response.message);
    setDetails(response.details || "");
  } catch (error) {
    setStatus(error.message || "Could not unwrap tracked links.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    fixUrlDefenseLinksButton.disabled = false;
  }
});

fixNewTabLinksButton.addEventListener("click", async () => {
  fixNewTabLinksButton.disabled = true;
  setStatus("Removing open-in-new-tab links...");
  setDetails("");

  try {
    const response = await runInEditorTab("removeNewTabFromLinks");

    setStatus(response.message);
    setDetails(response.details || "");
  } catch (error) {
    setStatus(error.message || "Could not remove open-in-new-tab links.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    fixNewTabLinksButton.disabled = false;
  }
});


fixLinkedImageAltButton.addEventListener("click", async () => {
  fixLinkedImageAltButton.disabled = true;
  setStatus("Updating linked image alt text...");
  setDetails("");

  try {
    const response = await runInEditorTab("setLinkedImageAltToDestination");

    setStatus(response.message);
    setDetails(response.details || "");
  } catch (error) {
    setStatus(error.message || "Could not update linked image alt text.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    fixLinkedImageAltButton.disabled = false;
  }
});

function renderAltSuggestions(suggestions) {
  currentAltSuggestions = suggestions || [];
  altSuggestionsEl.textContent = "";
  altSuggestionsEl.hidden = !currentAltSuggestions.length;
  altSuggestionActionsEl.hidden = !currentAltSuggestions.length;

  currentAltSuggestions.forEach((suggestion, index) => {
    const item = document.createElement("div");
    item.className = "suggestion-item";

    const header = document.createElement("label");
    header.className = "suggestion-header";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.dataset.index = String(index);

    const title = document.createElement("span");
    title.textContent = suggestion.label || suggestion.filename || "Image";

    header.append(checkbox, title);

    const textarea = document.createElement("textarea");
    textarea.value = suggestion.suggestion || "";
    textarea.dataset.index = String(index);

    const meta = document.createElement("div");
    meta.className = "suggestion-meta";
    meta.textContent = [
      suggestion.currentAlt ? "Current: " + suggestion.currentAlt : "Current: empty",
      suggestion.reason || "Review before applying."
    ].join(" | ");

    item.append(header, textarea, meta);
    altSuggestionsEl.append(item);
  });
}

suggestAltTextButton.addEventListener("click", async () => {
  suggestAltTextButton.disabled = true;
  altSuggestionActionsEl.hidden = true;
  altSuggestionsEl.hidden = true;
  altSuggestionsEl.textContent = "";
  setStatus("Scanning images for alt suggestions...");
  setDetails("");

  try {
    const response = await runInEditorTab("suggestImageAltText", {
      includePageTitle: includePageTitleAltInput.checked
    });
    const suggestions = response.suggestions || [];

    renderAltSuggestions(suggestions);
    setStatus(response.message);
    setDetails(response.details || "");
  } catch (error) {
    setStatus(error.message || "Could not suggest image alt text.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    suggestAltTextButton.disabled = false;
  }
});

deselectAltSuggestionsButton.addEventListener("click", () => {
  altSuggestionsEl.querySelectorAll('.suggestion-header input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = false;
  });
});

applyAltSuggestionsButton.addEventListener("click", async () => {
  applyAltSuggestionsButton.disabled = true;
  setStatus("Applying checked alt suggestions...");
  setDetails("");

  try {
    const checkedCheckboxes = [];
    const updates = Array.from(altSuggestionsEl.querySelectorAll(".suggestion-item")).map((item) => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      const textarea = item.querySelector("textarea");
      const suggestion = currentAltSuggestions[Number.parseInt(textarea.dataset.index, 10)];

      if (!checkbox.checked || !textarea.value.trim()) {
        return null;
      }

      checkedCheckboxes.push(checkbox);
      return { target: suggestion.target, alt: textarea.value.trim() };
    }).filter(Boolean);

    if (!updates.length) {
      setStatus("No checked alt suggestions to apply.");
      return;
    }

    const response = await runInEditorTab("applyImageAltTextSuggestions", { updates });

    checkedCheckboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });
    setStatus(response.message);
    setDetails(response.details || "");
  } catch (error) {
    setStatus(error.message || "Could not apply image alt text suggestions.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    applyAltSuggestionsButton.disabled = false;
  }
});

fixBoldParagraphsButton.addEventListener("click", async () => {
  fixBoldParagraphsButton.disabled = true;
  setStatus("Finding long all-bold paragraphs...");
  setDetails("");

  try {
    const maxChars = Number.parseInt(boldMaxCharsInput.value, 10) || 120;
    const response = await runInEditorTab("unboldLongAllBoldParagraphs", { minChars: maxChars });

    setStatus(response.message);
    setDetails(response.details || "");
  } catch (error) {
    setStatus(error.message || "Could not fix long bold-only paragraphs.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    fixBoldParagraphsButton.disabled = false;
  }
});

async function fetchPageTitles(urls) {
  const uniqueUrls = Array.from(new Set(urls));
  const entries = [];

  for (const [index, url] of uniqueUrls.entries()) {
    setStatus(`Fetching page title ${index + 1} of ${uniqueUrls.length}...`);
    entries.push([url, await fetchPageTitle(url)]);
  }

  return Object.fromEntries(entries);
}

async function fetchPageTitle(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, {
      credentials: "omit",
      redirect: "follow",
      signal: controller.signal
    });
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("text/html")) {
      return titleFromUrl(url);
    }

    const html = await response.text();
    const title = extractTitle(html) || titleFromUrl(url);

    return decodeHtmlEntities(title).trim() || titleFromUrl(url);
  } catch (_error) {
    return titleFromUrl(url);
  } finally {
    clearTimeout(timeout);
  }
}

function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  if (titleMatch?.[1]) {
    return titleMatch[1].replace(/\s+/g, " ");
  }

  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["'][^>]*>/i);

  return ogTitleMatch?.[1] || "";
}

function decodeHtmlEntities(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function titleFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch (_error) {
    return url;
  }
}

fixShortBoldHeadingsButton.addEventListener("click", async () => {
  fixShortBoldHeadingsButton.disabled = true;
  setStatus("Converting short bold paragraphs...");
  setDetails("");

  try {
    const maxWords = Number.parseInt(boldHeadingMaxWordsInput.value, 10) || 4;
    const response = await runInEditorTab("convertShortAllBoldParagraphsToH2", {
      maxWords,
      fontSize: "xMedium"
    });

    setStatus(response.message);
    setDetails(response.details || "");
  } catch (error) {
    setStatus(error.message || "Could not convert short bold paragraphs.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    fixShortBoldHeadingsButton.disabled = false;
  }
});

fixLeadingBoldLineButton.addEventListener("click", async () => {
  fixLeadingBoldLineButton.disabled = true;
  setStatus("Splitting leading bold lines...");
  setDetails("");

  try {
    const maxWords = Number.parseInt(boldHeadingMaxWordsInput.value, 10) || 4;
    const response = await runInEditorTab("splitLeadingBoldLineToH2", {
      maxWords,
      fontSize: "xMedium"
    });

    setStatus(response.message);
    setDetails(response.details || "");
  } catch (error) {
    setStatus(error.message || "Could not split leading bold lines.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    fixLeadingBoldLineButton.disabled = false;
  }
});

makeHeadingsH2Button.addEventListener("click", async () => {
  makeHeadingsH2Button.disabled = true;
  setStatus("Converting headings...");
  setDetails("");

  try {
    const response = await runInEditorTab("makeAllHeadingsH2");

    setStatus(response.message);
    if (response.details) {
      setDetails(response.details);
    }
  } catch (error) {
    setStatus(error.message || "Could not update headings.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    makeHeadingsH2Button.disabled = false;
  }
});


unboldHeadingBlocksButton.addEventListener("click", async () => {
  unboldHeadingBlocksButton.disabled = true;
  setStatus("Removing bold markup from headings...");
  setDetails("");

  try {
    const response = await runInEditorTab("unboldHeadingBlocks");

    setStatus(response.message);
    setDetails(response.details || "");
  } catch (error) {
    setStatus(error.message || "Could not unbold headings.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    unboldHeadingBlocksButton.disabled = false;
  }
});

changeHeadingLevelButton.addEventListener("click", async () => {
  changeHeadingLevelButton.disabled = true;
  setStatus("Changing heading levels...");
  setDetails("");

  try {
    const fromLevel = Number.parseInt(headingLevelFromSelect.value, 10);
    const toLevel = Number.parseInt(headingLevelToSelect.value, 10);
    const response = await runInEditorTab("changeHeadingLevel", { fromLevel, toLevel });

    setStatus(response.message);
    setDetails(response.details || "");
  } catch (error) {
    setStatus(error.message || "Could not change heading levels.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    changeHeadingLevelButton.disabled = false;
  }
});

function renderHeadingBlocks(items, checked = true) {
  currentHeadingBlocks = items || [];
  headingBlockListEl.textContent = "";
  headingBlockListEl.hidden = !currentHeadingBlocks.length;
  headingBlockActionsEl.hidden = !currentHeadingBlocks.length;

  currentHeadingBlocks.forEach((item, index) => {
    const row = document.createElement("label");
    row.className = "heading-block-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = checked;
    checkbox.dataset.index = String(index);

    const text = document.createElement("span");
    text.textContent = "H" + item.level + ": " + (item.text || "Heading");

    row.append(checkbox, text);
    headingBlockListEl.append(row);
  });
}

scanHeadingBlocksButton.addEventListener("click", async () => {
  scanHeadingBlocksButton.disabled = true;
  headingBlockActionsEl.hidden = true;
  headingBlockListEl.hidden = true;
  headingBlockListEl.textContent = "";
  setStatus("Scanning heading blocks...");
  setDetails("");

  try {
    const response = await runInEditorTab("scanHeadingBlocks");

    renderHeadingBlocks(response.items || []);
    setStatus(response.message);
    setDetails(response.details || "");
  } catch (error) {
    setStatus(error.message || "Could not scan heading blocks.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    scanHeadingBlocksButton.disabled = false;
  }
});

deselectHeadingBlocksButton.addEventListener("click", () => {
  headingBlockListEl.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = false;
  });
});

applySelectedHeadingLevelButton.addEventListener("click", async () => {
  applySelectedHeadingLevelButton.disabled = true;
  setStatus("Changing checked heading blocks...");
  setDetails("");

  try {
    const targetLevel = Number.parseInt(selectedHeadingLevelSelect.value, 10);
    const clientIds = Array.from(headingBlockListEl.querySelectorAll('input[type="checkbox"]:checked')).map((checkbox) => {
      const item = currentHeadingBlocks[Number.parseInt(checkbox.dataset.index, 10)];
      return item?.clientId;
    }).filter(Boolean);

    if (!clientIds.length) {
      setStatus("No checked heading blocks to change.");
      return;
    }

    const response = await runInEditorTab("changeSelectedHeadingBlocks", { clientIds, targetLevel });

    setStatus(response.message);
    setDetails(response.details || "");
    renderHeadingBlocks((currentHeadingBlocks || []).map((item) => (
      clientIds.includes(item.clientId) ? { ...item, level: targetLevel } : item
    )), false);
  } catch (error) {
    setStatus(error.message || "Could not change checked heading blocks.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    applySelectedHeadingLevelButton.disabled = false;
  }
});

applyButton.addEventListener("click", async () => {
  applyButton.disabled = true;
  setStatus("Applying...");
  setDetails("");

  try {
    const response = await runInEditorTab("applyH2FontSize", { fontSize: fontSizeSelect.value });

    setStatus(response.message);
    if (response.details) {
      setDetails(response.details);
    }
  } catch (error) {
    setStatus(error.message || "Could not reach the WordPress editor.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    applyButton.disabled = false;
  }
});

inspectButton.addEventListener("click", async () => {
  inspectButton.disabled = true;
  setStatus("Inspecting selected block...");
  setDetails("");

  try {
    const response = await runInEditorTab("inspectSelectedBlock");

    setStatus(response.message);
    setDetails(response.details);
  } catch (error) {
    setStatus(error.message || "Could not inspect the selected block.");
    setDetails(String(error?.stack || error?.message || error));
  } finally {
    inspectButton.disabled = false;
  }
});
