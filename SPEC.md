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
| `0.15.0` | Review-first, browser-local suggestions for existing categories and tags; no term creation or save |
| `0.16.0` | Familiar find/find-next/replace/replace-all workflow for open Gutenberg content; no save |
| `0.17.0` | Conservative email-link text cleanup using action-and-recipient labels; no save |

The recovered checkout is this repository, with loadable source under `wp-bulk-editor-extension/`. Its canonical upstream is <https://github.com/baschwar/WP-Gutenbrerg-Sidecar-Utility-Chrome-Extension>. The recovered baseline was commit `1f97e3c`, matching the recorded `0.14.0` release; the current source adds the locally validated `0.15.0` taxonomy MVP, `0.16.0` text search and replace workflow, and `0.17.0` email-link text cleanup. Its `README.md` is the implementation-level guide.

Treat `0.14.0` as the recovered baseline. The `0.15.0` classifier and `0.16.0` search and replace bridge have local automated coverage, but the updated extension has not yet been run against a current Chrome, WordPress, Gutenberg, or WSU theme environment.

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
- For `mailto:` links whose visible text is the address, the inferred recipient name, or a generic email label, use visible action-and-recipient text such as `Email Kathleen Finch` while preserving the full `mailto:` destination.
- Format the mailbox name before `@`: dot-separated personal names become spaced and capitalized, while a department or business mailbox becomes a single capitalized name, such as `development@wsu.edu` to `Email Development`.
- Leave already descriptive links and custom meaningful link text unchanged.
- Keep the visible email-link text and accessible name aligned without adding hidden text or an ARIA label.

### 4.4 Image alt-text support

- Support setting alt text on linked image blocks.
- Generate or apply only reviewable alt-text suggestions.
- Avoid inventing content not evident from the editor context. A human remains responsible for accepting the final alternative text.

### 4.5 Text cleanup

- Search literal visible text in the title, excerpt, and editable Gutenberg rich-text attributes.
- Provide `Find`, wrapping `Find next`, single-current-match `Replace`, and `Replace all` commands with case-sensitive and whole-word options.
- Identify the current match in the side panel, highlight its rendered text in yellow, and select/scroll its Gutenberg block into view when available.
- Replace text nodes only, preserving block structure, inline markup, links, URLs, HTML attributes, taxonomy assignments, and unrelated settings.
- Keep replacements in unsaved editor state and report exact replacement counts; never save or change post status.
- Convert all-bold paragraphs over a configurable character threshold to normal paragraph text; the documented default is 120 characters.
- Convert all-bold section labels at or under a configurable word threshold to H2 headings with the WSU xMedium style; the documented default is 4 words.
- Split a leading bold line followed by a soft return into an H2 xMedium plus the remaining normal paragraph, including markup where the soft return is inside the bold element.
- Preserve short label/value fields such as contact or form labels unless the user selects them for conversion.

### 4.6 Accessibility-aware tool filtering

- Scan visible Accessibility & Usability Checker text on the current page.
- When `Show all tools` is enabled, expose every utility. This is the default.
- When it is disabled, show the utilities relevant to detected issues and make the filtering basis understandable to the user.
- Never hide a tool solely because checker text could not be read.

### 4.7 Category and tag suggestions

- Analyze only the open Gutenberg document after the user selects `Analyze current post`.
- Keep matching deterministic and browser-local using reviewed rules, phrase aliases, exclusions, source weights, and thresholds.
- Read existing choices from the visible `category`, `post_tag`, `wsuwp_university_category`, `wsuwp_university_location`, and `wsuwp_university_org` editor controls; never add a new option.
- Show the taxonomy, term name, score, and match reasons before any editor change.
- Preserve all existing assignments in default add mode and apply only checked additions to unsaved editor state.
- Keep `Uncheck all suggestions` non-destructive: it changes only the suggestion checkboxes and never clears existing editor assignments.
- Provide a default-off replacement mode that requires explicit confirmation and at least one checked suggestion, clears only the five managed panels, reports each removal, and does not save.
- Provide a default-off homepage News mode exposing Alumni, Donor, Faculty, Staff, and Student tags; precheck a tag when its matching Site Category is assigned or suggested while leaving every audience manually reviewable.
- For regular posts, ensure `College of Nursing` and `WSU Spokane` are suggested defaults; suggest additional existing locations from reviewed exact names/aliases in content and additional organizations only from full-name matches.
- Do not create terms, fetch redirect destinations for classification, save, publish, or transmit post content to an AI or third-party classifier.
- If a registered redirect/external-URL meta field or the visible Redirect Post URL field is set, abstain and explain why.
- Treat parent and child categories independently; never add a parent solely because a child matched.

## 5. Non-functional requirements

- Use the existing Manifest V3 structure: a side panel, background service worker, content script, and page bridge.
- Restrict host permissions and content-script matches to the minimum needed for supported WordPress admin/editor screens.
- Do not persist credentials, cookies, post bodies, or editor data beyond what is necessary for the active action.
- Keep all tool actions responsive and produce a user-visible result or error.
- Degrade safely when Gutenberg APIs, selectors, cross-origin title fetches, or checker text are unavailable.
- Keep WSU-specific classes and rules isolated enough to support a future configuration layer. The current recovered implementation has fixed WSU presets; it does not yet have an options/configuration screen.
- Keep reviewed taxonomy rules in a separate configuration file, and keep the pure classifier testable without WordPress or Chrome APIs.

## 6. Safety and review rules

- The user must initiate every action. Ordinary editor cleanup actions remain unsaved for the user to review and save in WordPress.
- The explicit `Update No Data` list action is authorized to use WordPress’s normal save path for matching visible rows, while preserving their current status.
- Preserve draft, private, and published status unless the user explicitly changes it in WordPress.
- Offer confirmation for multi-block or multi-row changes and report exactly what was changed.
- Do not implement autonomous content rewriting, publishing, deletion, or background scanning.
- Do not create taxonomy terms. Remove existing assignments only through the explicit, confirmed replacement mode and only from the five documented panels.
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
- Broader reviewed phrase rules for the lengthy University Tag and University Category vocabularies beyond the conservative starter set.
- Automated test fixtures for Gutenberg block manipulation and list-screen targeting beyond the taxonomy classifier/bridge fixtures.
- A reviewed compatibility matrix for WordPress/Gutenberg and WSU theme versions.
