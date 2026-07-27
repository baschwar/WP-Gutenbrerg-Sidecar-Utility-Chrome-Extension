# WSU WDS Sidecar Utilities

A Chrome side panel extension for speeding up WordPress block editor cleanup tasks used in WSU Web Design System workflows.

The extension runs in the browser while you are logged into WordPress. It does not require database access, WP-CLI, SSH, or a WordPress plugin install.

## Repository Description

Chrome side panel utilities for WSU WordPress editor cleanup, accessibility fixes, and Gutenberg heading normalization.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `wp-bulk-editor-extension` folder in this repo.
5. Open or reload the relevant WordPress editor or list tab.
6. Click the extension icon to open the side panel.

Important: after reloading or updating the extension, reload any open WordPress editor **and list** tabs so the content-script bridge attaches.

## Current Utilities

### Page/Post

- Re-save visible rows whose Accessibility column shows `No Data` so WordPress can regenerate accessibility checks on save.
- Preserve each item’s existing draft-like (`auto-draft`, `draft`, or `pending`) or published status during that explicitly invoked save workflow.
- Open every visible edit link from any WordPress `edit.php` list screen—including Pages, Posts, and custom post types—in new background tabs for batch review.
- `Open Visible List` never saves, updates, publishes, drafts, or otherwise changes an item.

### Headings

- Fix incorrect heading order by making content headings H2.
- Make all content heading blocks H2.
- Remove bold markup from heading blocks while preserving heading level and classes.
- Change all heading blocks from one selected level to another selected level, such as H3 to H2 or H2 to H4.
- Scan individual heading blocks, select or deselect specific headings, and change only checked headings to a chosen H1-H6 level.
- Apply a WSU Display Options font-size class to all H2 blocks while preserving unrelated Advanced classes. The available preset labels are `Default`, `Medium`, `xMedium`, `xxMedium`, `Large`, `xLarge`, and `xxLarge`; `Default` removes the existing `wsu-font-size--…` class.

### Alt Tags

- Set linked image alt text for images that link directly to full-size image files.
- Generate reviewable image alt text suggestions from captions, media titles, filenames, and optional page title context.
- Apply only checked alt text suggestions, with deselect-all support for long suggestion lists.

### Links

- Replace URL-like link text with linked page titles.
- Replace generic link text such as `here`, `click here`, and `read more` with linked page titles.
- Unwrap URLDefense and Outlook Safe Links copied from email into their original destination URLs.
- Remove open-in-new-tab behavior from rich text links.
- Scan nested table/list rich text so link fixes can apply inside table cells and other structured block attributes.

### Text Cleanup

- Unbold all-bold paragraphs over a configurable character threshold (120 by default).
- Convert all-bold paragraphs at or under a configurable word threshold (4 by default) to H2 xMedium.
- Split a leading bold line followed by a soft return into an H2 xMedium plus a following paragraph, including a soft return inside the bold element.

### Interface

- Group utilities by Page/Post, Headings, Alt Tags, Links, and Text Cleanup.
- Show status/details under the active utility card.
- Provide compact controls and hover/focus help for utility headings.
- Use compact two-column action grids for simple Heading and Link cleanup utilities.
- Filter the sidecar to tools relevant to visible Accessibility & Usability checker issues, with a default-on Show all tools toggle.

## Supported Pages and Boundaries

- The extension targets Gutenberg/block-editor screens and WordPress `edit.php` list screens, including subdirectory WordPress installs.
- It does not support the Classic Editor or perform unattended site-wide changes.
- Editor cleanup actions change the open Gutenberg document only. Review the changes and save/update in WordPress when ready.
- `Update No Data` is the exception: after the user starts it from a visible list, it visits only matching visible rows and runs WordPress’s normal save path while retaining each item’s status.
- The WSU font-size tools are WSU-specific. Other WordPress themes may use Gutenberg presets, different classes, inline styles, or no editable heading-size option.

## How It Works

The side panel talks to a content-script bridge loaded on WordPress editor pages. The bridge calls Gutenberg's editor APIs from the page context, then reports results back to the side panel.

This approach keeps the workflow browser-only:

- No WordPress server changes.
- No direct database writes; edits use Gutenberg and WordPress’s normal save process.
- No WP-CLI dependency.
- The user starts each action, receives its result in the side panel, and reviews ordinary editor changes before saving.

## Permissions

The extension requests access to supported WordPress editor and `edit.php` list URLs so it can attach the content-script bridge.

It also requests `http://*/*` and `https://*/*` host access so the URL-link-text fixer can fetch linked pages and read their titles. This is used to replace link text like `https://example.com/page` with the linked page title.

These broad host permissions also permit the page bridge to run on a supported WordPress admin origin. They do not grant database, SSH, WP-CLI, or WordPress-plugin access.

## Development Notes

Loadable extension source lives in:

`wp-bulk-editor-extension/`

Primary files:

- `manifest.json`: Chrome extension manifest.
- `sidepanel.html`, `sidepanel.css`, `sidepanel.js`: side panel UI.
- `content.js`: content-script bridge.
- `page-bridge.js`: page-context Gutenberg utilities.

## Version

Current extension version: `0.14.0`.
