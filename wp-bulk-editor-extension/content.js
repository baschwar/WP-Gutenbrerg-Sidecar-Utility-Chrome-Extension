(() => {
  const pending = new Map();
  let requestId = 0;

  function injectBridge() {
    if (document.documentElement.dataset.wsuWdsBridgeInjected === 'true'
      || document.documentElement.dataset.wsuWdsBridgeInjecting === 'true') {
      return;
    }

    document.documentElement.dataset.wsuWdsBridgeInjecting = 'true';

    function appendScript(filename) {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL(filename);
        script.onload = () => {
          script.remove();
          resolve();
        };
        script.onerror = () => {
          script.remove();
          reject(new Error('Could not load ' + filename + '.'));
        };
        (document.head || document.documentElement).appendChild(script);
      });
    }

    appendScript('taxonomy-rules.js')
      .then(() => appendScript('taxonomy-classifier.js'))
      .then(() => appendScript('page-bridge.js'))
      .then(() => {
        document.documentElement.dataset.wsuWdsBridgeInjected = 'true';
      })
      .catch(() => {
        document.documentElement.dataset.wsuWdsBridgeInjected = 'false';
      })
      .finally(() => {
        delete document.documentElement.dataset.wsuWdsBridgeInjecting;
      });
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

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.source !== 'WSU_WDS_PAGE') {
      return;
    }

    const resolver = pending.get(event.data.id);

    if (!resolver) {
      return;
    }

    pending.delete(event.data.id);
    resolver(event.data.response);
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.source !== 'WSU_WDS_SIDEPANEL') {
      return false;
    }

    if (message.action === 'scanVisibleAccessibilityIssues') {
      sendResponse(scanVisibleAccessibilityIssues());
      return false;
    }

    injectBridge();
    const id = String(++requestId);
    pending.set(id, sendResponse);
    window.postMessage({
      source: 'WSU_WDS_CONTENT',
      id,
      action: message.action,
      payload: message.payload || {}
    }, '*');

    setTimeout(() => {
      if (!pending.has(id)) {
        return;
      }

      pending.delete(id);
      sendResponse({
        ok: false,
        message: 'Timed out waiting for the WordPress page bridge.'
      });
    }, 8000);

    return true;
  });

  injectBridge();
})();
