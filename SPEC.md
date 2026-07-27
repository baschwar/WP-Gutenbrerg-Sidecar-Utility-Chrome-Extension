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

- On WordPress `edit.php` list screens, including Pages, Posts, and custom post types, open the edit links for every visible row in background tabs.
- Do not save, update, publish, draft, delete, or alter content as part of opening tabs.
- Provide an explicitly user-started, status-preserving save action for visible rows whose Accessibility column reads `No Data`, so WordPress can refresh its checker data.
- Scope every batch action to rows visible in the current list screen. Do not silently paginate or act on hidden rows.

### 4.2 Heading cleanup

- Identify Gutenberg heading blocks and their order.
- Support correcting heading order, setting all headings to H2, removing bold formatting from headings, changing heading levels in bulk, and changing only checked heading blocks.
- Support WSU H2 display-size classes from `Medium`, `xMedium`, `xxMedium`, `Large`, `xLarge`, and `xxLarge`, plus `Default` to remove the current WSU size class. Preserve unrelated Advanced classes.
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

- Convert all-bold paragraphs over a configurable character threshold to normal paragraph text; the documented default is 120 characters.
- Convert all-bold section labels at or under a configurable word threshold to H2 headings with the WSU xMedium style; the documented default is 4 words.
- Split a leading bold line followed by a soft return into an H2 xMedium plus the remaining normal paragraph, including markup where the soft return is inside the bold element.
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
- Keep WSU-specific classes and rules isolated enough to support a future configuration layer. The current recovered implementation has fixed WSU presets; it does not yet have an options/configuration screen.

## 6. Safety and review rules

- The user must initiate every action. Ordinary editor cleanup actions remain unsaved for the user to review and save in WordPress.
- The explicit `Update No Data` list action is authorized to use WordPress’s normal save path for matching visible rows, while preserving their current status.
- Preserve draft, private, and published status unless the user explicitly changes it in WordPress.
- Offer confirmation for multi-block or multi-row changes and report exactly what was changed.
- Do not implement autonomous content rewriting, publishing, deletion, or background scanning.
- Do not claim WCAG compliance. The extension is an editing aid and must be followed by human review.

## 7. Acceptance checks

For each changed feature:

1. Verify the extension loads unpacked and the side panel opens on a supported WordPress admin page.
2. After every extension reload/update, reload the target WordPress editor or list tab before testing so the content-script bridge attaches.
3. Verify the command appears only in the applicable context or produces a clear unsupported-context result.
4. Test the intended change on a controlled fixture or user-authorized page.
5. Confirm Gutenberg blocks changed as expected and unrelated blocks did not change.
6. Confirm no content was saved, published, or status-changed unless that was the explicit authorized workflow.
7. For batch/list tools, confirm the target count equals the visible-row count and report individual failures.
8. Update the version and project-local documentation with test evidence and known limits.

## 8. External context and constraints

- Historical WSU WordPress REST and admin-AJAX access was blocked by AWS WAF. The extension’s browser-based workflow is intentional.
- Okta authentication is handled by the person in Chrome. The extension must not manage authentication material.
- The current manifest has broad `http://*/*` and `https://*/*` host permissions for linked-page-title lookup. Review any change to those permissions carefully.
- The authoritative cross-project outcome record is `/Users/bradschwartz/.openclaw/workspace/DA_WORK_LOG.md`.

## 9. Deferred work

- A settings/options screen for site-specific class presets and rules.
- Automated test fixtures for Gutenberg block manipulation and list-screen targeting.
- A reviewed compatibility matrix for WordPress/Gutenberg and WSU theme versions.
