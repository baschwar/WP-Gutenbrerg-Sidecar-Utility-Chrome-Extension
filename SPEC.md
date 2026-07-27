# WSU WDS Sidecar Chrome Extension — Specification

## 1. Product contract

WSU WDS Sidecar is a Chrome side-panel extension for recurring WordPress/Gutenberg accessibility and content-cleanup work. It operates only in the browser while a user is already authenticated to WordPress.

Its job is to make targeted edits easier to review. It must not become an unattended publishing system or require WordPress database, SSH, WP-CLI, or WordPress-plugin access.

## 2. Historical baseline

The original extension was recorded in the Digital Accessibility work log as complete from April 27 through May 5, 2026:

| Release | Recorded capability |
| --- | --- |
| `0.12.0` | Heading cleanup and compact UI updates |
| `0.13.0` | `Open Visible List` for background-tab review of visible WordPress list rows |
| `0.14.0` | Accessibility & Usability issue detection and relevant-tool filtering; `Show all tools` stays on by default |

The recovered checkout is this repository, with loadable source under `wp-bulk-editor-extension/`. Its canonical upstream is <https://github.com/baschwar/WP-Gutenbrerg-Sidecar-Utility-Chrome-Extension>. It is at commit `1f97e3c`, matching the recorded `0.14.0` release. Its `README.md` is the implementation-level guide.

Treat the checkout as a recovered baseline. It has not yet been run against a current Chrome, WordPress, Gutenberg, or WSU theme environment.

## 3. Architecture

```text
Chrome side panel
    -> extension messaging
Content script in the active WordPress admin/editor tab
    -> narrowly scoped page bridge
Gutenberg editor APIs and visible admin UI
    -> user reviews and saves through WordPress
```

The bridge exists because Gutenberg editor APIs run in the page context. Keep message types explicit, validate inputs, and return structured success/failure information to the side panel.

## 4. Functional requirements

### 4.1 List-screen utilities

- On WordPress `edit.php` list screens, open the edit links for every visible row in background tabs.
- Do not save, update, publish, draft, delete, or alter content as part of opening tabs.
- Provide a status-preserving action for visible Pages/Posts whose Accessibility column reads `No Data`.
- Scope every batch action to rows visible in the current list screen. Do not silently paginate or act on hidden rows.

### 4.2 Heading cleanup

- Identify Gutenberg heading blocks and their order.
- Support correcting heading order, setting all headings to H2, removing bold formatting from headings, changing heading levels in bulk, and changing only checked heading blocks.
- Support the WSU H2 display-size class `wsu-font-size--xmedium` where the site configuration enables it.
- Do not infer that visually bold ordinary text is a heading without an explicit user action or the text-cleanup rules below.

### 4.3 Link cleanup

- Find generic or URL-only link text and offer a reviewable replacement based on the destination page title.
- Unwrap URLDefense and Outlook Safe Links before title lookup when possible.
- Offer removal of `target="_blank"` / open-in-new-tab behavior.
- Preserve a link when title lookup fails. Report the failure rather than replacing text with a guess.

### 4.4 Image alt-text support

- Support setting alt text on linked image blocks.
- Generate or apply only reviewable alt-text suggestions.
- Avoid inventing content not evident from the editor context. A human remains responsible for accepting the final alternative text.

### 4.5 Text cleanup

- Convert long all-bold paragraphs to normal paragraph text.
- Convert short all-bold section labels to H2 headings with the WSU xMedium style when enabled.
- Split a leading bold line from a paragraph into a heading where the user confirms the intent.
- Preserve short label/value fields such as contact or form labels unless the user selects them for conversion.

### 4.6 Accessibility-aware tool filtering

- Scan visible Accessibility & Usability Checker text on the current page.
- When `Show all tools` is enabled, expose every utility. This is the default.
- When it is disabled, show the utilities relevant to detected issues and make the filtering basis understandable to the user.
- Never hide a tool solely because checker text could not be read.

## 5. Non-functional requirements

- Use the existing Manifest V3 structure: a side panel, background service worker, content script, and page bridge.
- Restrict host permissions and content-script matches to the minimum needed for supported WordPress admin/editor screens.
- Do not persist credentials, cookies, post bodies, or editor data beyond what is necessary for the active action.
- Keep all tool actions responsive and produce a user-visible result or error.
- Degrade safely when Gutenberg APIs, selectors, cross-origin title fetches, or checker text are unavailable.
- Keep WSU-specific classes and rules in a configuration layer for future site reuse.

## 6. Safety and review rules

- The user must initiate edits and retain the decision to save them in WordPress.
- Preserve draft, private, and published status unless the user explicitly changes it in WordPress.
- Offer confirmation for multi-block or multi-row changes and report exactly what was changed.
- Do not implement autonomous content rewriting, publishing, deletion, or background scanning.
- Do not claim WCAG compliance. The extension is an editing aid and must be followed by human review.

## 7. Acceptance checks

For each changed feature:

1. Verify the extension loads unpacked and the side panel opens on a supported WordPress admin page.
2. Verify the command appears only in the applicable context or produces a clear unsupported-context result.
3. Test the intended change on a controlled fixture or user-authorized page.
4. Confirm Gutenberg blocks changed as expected and unrelated blocks did not change.
5. Confirm no content was saved, published, or status-changed unless that was the explicit authorized workflow.
6. For batch/list tools, confirm the target count equals the visible-row count and report individual failures.
7. Update the version and project-local documentation with test evidence and known limits.

## 8. External context and constraints

- Historical WSU WordPress REST and admin-AJAX access was blocked by AWS WAF. The extension’s browser-based workflow is intentional.
- Okta authentication is handled by the person in Chrome. The extension must not manage authentication material.
- The authoritative cross-project outcome record is `/Users/bradschwartz/.openclaw/workspace/DA_WORK_LOG.md`.

## 9. Deferred work

- A settings/options screen for site-specific class presets and rules.
- Automated test fixtures for Gutenberg block manipulation and list-screen targeting.
- A reviewed compatibility matrix for WordPress/Gutenberg and WSU theme versions.
