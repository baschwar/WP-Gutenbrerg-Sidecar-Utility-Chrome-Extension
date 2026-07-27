# WSU WDS Sidecar Chrome Extension

## Purpose

This project is the dedicated Codex home for the browser-only WordPress/Gutenberg side-panel extension first built for WSU College of Nursing accessibility and cleanup work.

The extension assists a person already signed into WordPress. It does not use WordPress database access, SSH, WP-CLI, or a WordPress plugin.

Read `SPEC.md` before changing code or behavior.

## Project status

The recovered extension checkout is in this repository. Its `README.md` is the implementation-level guide, and `wp-bulk-editor-extension/` is the loadable Chrome-extension source. Its canonical upstream is <https://github.com/baschwar/WP-Gutenbrerg-Sidecar-Utility-Chrome-Extension>.

The checkout is at recorded release commit `1f97e3c` (`0.14.0`, May 5, 2026). The ZIP in the enclosing Codex project folder matches the preserved historical archive by SHA-256. Treat this as a recovered baseline; verify behavior locally before representing it as compatible with a current Chrome, WordPress, Gutenberg, or WSU theme environment.

## Working rules

- Keep the extension browser-only and user-mediated.
- Use the active WordPress editor tab through a content-script/page-bridge pattern. Do not introduce server-side or direct database access.
- Preserve post status. Never publish a draft or otherwise change visibility as a side effect.
- Make destructive or wide-scope actions opt-in, clearly labeled, and reviewable before execution.
- Prefer visible-editor changes and normal WordPress save flows. Do not bypass the logged-in user’s expected review and save step.
- Keep site-specific behavior isolated. WSU class names, including `wsu-font-size--xmedium`, must be configurable or explicitly labeled rather than silently applied as a universal WordPress convention.
- Treat generated alt text and fetched link titles as suggestions requiring review.
- Do not store, copy, log, or commit credentials, cookies, WordPress content exports, or user browsing data.
- Test only against locally controlled fixtures or user-authorized WordPress pages. Never run a bulk update merely to test an implementation.

## Known functional scope

- WordPress list-screen utilities: open visible list rows in background tabs; refresh visible Posts/Pages showing Accessibility `No Data` while preserving their current status.
- Gutenberg heading tools: correct order, set levels, unbold headings, selectively change checked blocks, and apply a WSU H2 display-size class.
- Link tools: replace generic or URL text with fetched page titles, unwrap URLDefense/Outlook Safe Links, and remove new-tab behavior.
- Image tools: set linked-image alt text and create/apply reviewable suggestions.
- Text tools: turn long all-bold paragraphs back to normal text; turn short all-bold labels into H2 xMedium headings; split leading bold lines into headings.
- Accessibility-aware filtering: `Show all tools` remains enabled by default. When disabled, inspect visible Accessibility & Usability Checker text and show relevant utilities.

## Verification and handoff

- Read `README.md`, and inspect `wp-bulk-editor-extension/manifest.json`, side-panel registration, permissions, content-script matches, and message boundaries before changing behavior.
- Test every changed command against a representative Gutenberg editor fixture or user-authorized page. Confirm the intended block changes and that no unexpected save or publish occurred.
- For list actions, verify only visible rows are targeted and every opened tab/action is accounted for.
- Record the extension version, tested workflows, known limitations, and any deferred behavior in the project documentation.
- `DA_WORK_LOG.md` in `/Users/bradschwartz/.openclaw/workspace` is the cross-project Digital Accessibility outcome log. Keep project-local details here; add a concise dated handoff there only when the user asks to update that external record.

## Boundaries

- The WordPress REST API and admin AJAX endpoints have historically been blocked by AWS WAF. Do not assume an API-based redesign will work without live, authorized validation.
- This tool improves editing workflows. It does not certify WCAG conformance or replace human accessibility review.
- Do not broaden the extension to a general crawler, CMS migration tool, or unattended publishing agent without an explicit new specification.
