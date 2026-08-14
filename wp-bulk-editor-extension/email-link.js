(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.WSU_WDS_EMAIL_LINK = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function extractMailtoAddress(href) {
    const value = String(href || '').trim();

    if (!/^mailto:/i.test(value)) {
      return '';
    }

    const address = value.slice(value.indexOf(':') + 1).split(/[?,;]/, 1)[0].trim();

    try {
      return decodeURIComponent(address).toLowerCase();
    } catch (_error) {
      return address.toLowerCase();
    }
  }

  function titleCaseToken(token) {
    return token
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('-');
  }

  function recipientNameFromEmail(address) {
    const localPart = String(address || '').split('@', 1)[0].toLowerCase().split('+', 1)[0];

    if (!localPart) {
      return '';
    }

    const parts = localPart.split(/[._]+/).filter(Boolean);

    if (parts.length > 6 || parts.some((part) => !/^[a-z0-9][a-z0-9'-]*$/i.test(part))) {
      return '';
    }

    return parts.map(titleCaseToken).join(' ');
  }

  function replacementForLink(text, href) {
    const address = extractMailtoAddress(href);
    const recipient = recipientNameFromEmail(address);

    if (!address || !recipient) {
      return null;
    }

    const current = normalizeText(text);
    const desired = `Email ${recipient}`;
    const comparable = current.toLowerCase();
    const eligible = comparable === address
      || comparable === `mailto:${address}`
      || comparable === recipient.toLowerCase()
      || ['email', 'email me', 'email us', 'contact', 'contact us', 'send email'].includes(comparable);

    if (!eligible || current === desired) {
      return null;
    }

    return { address, recipient, text: desired };
  }

  return {
    extractMailtoAddress,
    recipientNameFromEmail,
    replacementForLink
  };
});
