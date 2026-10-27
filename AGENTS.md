# AGENTS.md

This file provides guidance to AI coding agents working with code in this repository.

## Overview

`Sibling Notes` moves between the notes of one folder in the order the File explorer shows them. A navigator bar above the note and another below it step to the previous or next item, and a folder map lists the whole folder.

What core 1.14.4 and other plugins already do, so the plugin does not rebuild it:

- **Core has no previous or next note in a folder,** as a command or as UI. Bases never shows note bodies.
- **Commands exist in other plugins:** `Neighbouring Files`, `Note Navigator`, `Page Flow`, `Quick Explorer` and `Explorer Stepper`. None of them puts buttons above and below the note. `Page Flow` reads the rendered tree, which is only partly rendered. Verified 2026-10-27 against `Neighbouring Files` 1.2.3 and upstream commit `f60783c`: it follows the File explorer's selected built-in name/date sort mode, but sorts `folder.children` itself, without reading `getSortedFolderItems`. A controlled probe confirmed that a custom order from that method is ignored. Its mobile floating button and gestures are additional controls. Keep this sorting distinction specific to `Neighbouring Files`; the other alternatives were not re-verified for custom-sort support.
- **Continuous scrolling over many notes exists:** `Continuous Mode`, `Folder Reader`, `Book Simulator` and `Simple Journal`. It is out of scope here.
- The README's `## See also` is the full list from the last prior-art search, with the date it ran.

## Current state

The repo was generated on 2026-10-17 with `create-obsidian-plugin` (preset `all-in-one`, CSS, desktop and mobile, the unofficial API subset, no editor extensions). Its answers are in `.create-obsidian-plugin.json`, so re-running the generator in this folder updates every file not edited by hand.

**Built: the folder sequence and its commands.** `src/navigation/folder-sequence.ts` reads the order, `src/navigation/navigation-action.ts` answers where each step lands, and `src/navigation/sibling-navigator.ts` performs it. Each command is a `NavigationCommandHandler`: Previous, Next, Home, End, Page up, Page down (the `pageSize` setting), Up and Enter (command only, not on the bar). The current item is the active virtual folder note's folder, else the active file. The demo vault covers these commands.

**Built: the navigator bar.** `src/navigator-bar/navigator-bar.ts` is one bar's DOM, and `src/navigator-bar/navigator-bar-component.ts` puts a top and a bottom bar into every open `MarkdownView` and keeps them current. Each bar reads its own view's file, not the active file. The Map button opens the folder map, and hovering or focusing a button highlights its target in every open map. The settings `showTopBar` and `showBottomBar` hide either bar.

**Built: the virtual folder note.** `src/virtual-folder-note/virtual-folder-note-view.ts` is an `ItemView` (type `sibling-notes-virtual-folder-note`, state `{ folderPath }`) that a landing on a subfolder opens in the same leaf. It shows the bars, the folder's name, Enter, the items in explorer order (click opens here, mod-click or middle click in a new tab) and the folder note, rendered through `fullRender` (Markdown without its frontmatter, any other type as an embed). `NavigatorBarComponent.refresh` refreshes it with the bars; the folder note re-renders only when it is another note, was renamed, or was modified. `src/virtual-folder-note/folder-note-finder.ts` picks the folder note: the enabled folder-notes plugins' setups first (`shouldReadFolderNotePlugins`), then `d/d.md` (`shouldUseFolderNoteInside`), then `d.md` beside (`shouldUseFolderNoteBeside`).

**Built: the folder map.** `src/folder-map/folder-map.ts` is the map's DOM: breadcrumbs (a folder's segment opens its virtual folder note), the items in explorer order with the current one `is-active`, each bar button's icon on the item it reaches (Up's `folder-up` on the folder's own breadcrumb, where Up lands), and `is-targeted` on a hovered button's target. `src/folder-map/folder-map-component.ts` opens it from the Map button or the `show-folder-map` command: a popover on desktop (`src/folder-map/folder-map-popover.ts`, Obsidian's `.menu` styling, below the button or above it when there is more room), a bottom sheet on mobile (`src/folder-map/folder-map-sheet.ts`, a restyled `Modal`), and, once pinned (`pin-folder-map`, or the pin in the map), the side-panel view `src/folder-map/folder-map-view.ts` (type `sibling-notes-folder-map`), which follows the main area's most recent leaf. While a pinned map exists the Map button reveals it instead. Clicking a subfolder in the list enters it (its first item, or its virtual folder note when empty); clicking anything else opens it. `NavigatorBarComponent.refresh` refreshes every open map.

**Built: scrolling past the edge.** `src/overscroll/overscroll-gesture.ts` is the pull as a state machine over wheel and touch input with explicit times, `src/overscroll/overscroll-indicator.ts` the labelled strip at the edge, and `src/overscroll/overscroll-component.ts` listens on every window's document, finds the Markdown view or virtual folder note under the pointer, reads the element that scrolls its content (`editMode.cm.scrollDOM`, `previewMode.renderer.previewEl`, or the virtual view's `contentEl`) and navigates through `SiblingNavigator`. A pull starts only with a new gesture at the edge: a wheel pause of 250 ms or a new touch, so a fling's momentum never carries on. Pausing 600 ms or scrolling back cancels. A wheel pull opens its target once it passes `overscrollDistancePercent` of the pane height and swallows the rest of its momentum; a touch pull says "Release to open" and opens on release. Previous lands at the end of the note. A wheel over anything inside it that scrolls vertically on its own never pulls. `overscrollEdges` (`none` by default, `bottom`, `both`) turns it on.

**Built: the demo vault and the README.** The vault has a note per feature (`01` to `06`), with buttons that change the File explorer's sort order and back, and folder notes in both file conventions: `Appendix/Appendix.md` inside its folder, and `Materials/04 Virtual folder note/Projects.md` beside its folder. The README follows the same section order as the author's other plugins. `scripts/test-coverage.ts` enforces 100%.

**Built: the screenshots.** `npm run capture:screenshots` rewrites `images/screenshots/`: five desktop and five mobile frames, the directory's cap per form factor, which the README's screenshot block shows. All of them are of `Materials/01 Folder navigation`: the top bar on `Chapter 2`, the map (a popover with Next hovered on desktop, the sheet on mobile), the virtual folder note of `Appendix`, the pinned map beside the bottom bar (the bottom bar alone on mobile), and the settings tab. Its two projects (`capture-screenshots:desktop`, and `capture-screenshots:android` on the 900x1600 `obsidian_screenshots` AVD) open the demo vault through `scripts/demo-vault-global-setup.ts`, and both suites stage their frames with the closures in `src/test-helpers/screenshot-stages.test.helper.ts`, through `pollInObsidian`. A re-run reproduces every frame byte for byte. Things the frames need:

- `labelScreenshot` draws its caption over the bottom of the frame, so `reserveCaptionBand` lays the app out above the band. The status bar, the phone's `.mobile-navbar` and the bottom sheet are fixed to the viewport, so each is lifted on its own. The band is in the frame's pixels, which on the phone are device pixels, so it is divided by `devicePixelRatio` there.
- The settings tab keeps the scroll it had when last open, so the stage scrolls it to the top.

**Released and listed.** `1.0.0` was released on 2026-10-18 from the public repo `mnaoumov/obsidian-sibling-notes`, and the same day it was submitted to the community directory and published there with the id `sibling-notes`: <https://community.obsidian.md/plugins/sibling-notes>. Releases go through `npm run version`, which runs every gate and all four integration legs before it commits, tags and publishes.

## Design

This is the model the owner approved. Refine it as the build goes.

**The sequence.** A folder's sequence is its own items in File explorer order, the same folder only. Each subfolder appears in it as a **virtual folder note**. There is no wrap-around: on the first item Previous is greyed out, and on the last item Next is.

**The virtual folder note.** It is a custom view, not a file. It lists what the folder holds, subfolders and files, in explorer order, each one clickable. When the folder has a folder note, its content is shown too. Which folder-note conventions count is a setting. By default they are the major folder-notes plugins' conventions, read from their settings where they expose them, plus `d/d.md` and a `d.md` beside the folder. The view offers **Enter**, which goes to the folder's first item.

**The navigator bar**, above the note and below it, in Live Preview, Reading view and the virtual view, on desktop and mobile:

- Up, a folder with an up arrow (Lucide `folder-up`, the Total Commander look), is always available. It goes to the parent folder's sequence and lands on the folder just left.
- Home and End go to the first and last item.
- Page up and Page down move N items (a setting, 10 by default) and stop at the ends.
- Previous and Next, with a position such as `3 / 12` between them.
- Map.

**The map.** A popover on desktop, a side panel when pinned, and a bottom sheet on mobile. It lists the folder's items in explorer order under breadcrumbs (`a / b / d`) and highlights the current item. Each item a bar button would reach carries that button's icon, and hovering a button highlights its target. Clicking an item goes to it, and clicking a subfolder enters it.

**Commands.** Every bar action is also a command, with a bindable hotkey.

**Scrolling past the edge**, off by default: keep scrolling past the bottom to open the next item, or past the top to open the previous one at its end, guarded by a labelled pull rather than a count of scrolls, which momentum crosses by accident.

**Later:**

- A joined, editable view of the whole folder. It would need one embedded editor per note through internal APIs.

## Internals

Checked against the `obsidian-typings` branch `release/obsidian-public/1.14.4`. Verify every member against a live build before relying on it.

- **Order:** `FileExplorerView.getSortedFolderItems(folder)`, with `sortOrder` and `requestSort` beside it. Checked live on 1.14.4: it returns the subfolders too, folders first in every sort order, although the typings declare file items only. Name order compares case-insensitively and numerically, so `b 9` comes before `b 10`. Disabling the File explorer removes its leaves at once. The custom-sort plugins (`Custom File Explorer sorting`, `Flexplorer`) patch this exact method, so it returns what the user sees. Recompute it on every use. Fall back to name order when the File explorer is disabled or its view is not loaded. `AppVaultConfig.fileSortOrder` is too loosely typed to rely on.
- **Where the bars go**, checked live on 1.14.4 desktop and Android:
  - A `MarkdownView` owns one `inlineTitleEl`, one `metadataEditor.containerEl` and one `backlinksEl`, and moves them on every mode switch. `editMode.show()` prepends the title and properties to `editMode.sizerEl` (`.cm-sizer`) and appends the backlinks. `previewMode.show()` appends the title and properties to `renderer.header.el` (`.mod-header`) and the backlinks to `renderer.footer.el` (`.mod-footer`). So the bars are re-placed after `MarkdownView.setMode`, which the component patches.
  - In the editor the top bar is the first child of `.cm-sizer`, above the inline title and the properties, and the bottom bar goes right after `.cm-contentContainer` (`cm.contentDOM.parentElement`). `updateBottomPadding` puts the scroll-past-end space on `cm.contentDOM`'s bottom padding, above anything after the content, so the component patches it on the edit view's prototype and moves that space below the bottom bar through `--sibling-notes-scroll-past-end`.
  - In Reading view the top bar is prepended to the header, above the inline title and the properties, and the bottom bar prepended to the footer, then `renderer.updateHeader()` / `updateFooter()` re-measure the section. `obsidian-typings` declares those four renderer members since `obsidian-public-1.14.4` 1.13.0.
  - `FileExplorerView.sort()` runs after every sort-order change and every `requestSort`, so the component patches it to refresh the bars.
- **The bottom sheet's header**, checked in the 1.14.4 bundle and live on Android: `Modal` builds `modalEl` > close button (`.modal-header-button`, absolutely placed `--size-4-3` from the top and `--size-4-4` from the end, `--touch-size-m` square on a phone), then `headerEl` (`.modal-header`) > `titleEl`, then `contentEl`. On a phone the header keeps its padding even with an empty title, so a header built in `contentEl` costs a second row. The sheet therefore sets the title with `setTitle` and puts the pin into `headerEl` (declared by `obsidian-typings`), and its CSS sizes that row to the close button and ends it before the button.
- **The virtual folder note's header:** `WorkspaceLeaf.updateHeader()` updates the tab title but not the view header's `ItemView.titleEl`, which is written once when the view opens, before it has a state. So the view sets `titleEl` itself on every refresh.
- **Folder-note conventions**, read from each enabled plugin's `app.plugins.getPlugin(id).settings` on every lookup:
  - `folder-notes`: through `resolveFolderNoteConfig` in `@mnaoumov/obsidian-lib/folder-note` (`folderNoteName` with `{{folder_name}}`, `storageLocation`, `folderNoteType`, `supportedFileTypes`).
  - `folder-note-plugin` (`Folder Note`): `folderNoteType` `inside` / `outside` / `index`, the index note named `folderNoteName`.
  - `waypoint`: `folderNoteType` `INSIDE_FOLDER` / `OUTSIDE_FOLDER` / `CUSTOM_FILENAME`, the custom note named `folderNoteFilename`.
  - `obsidian-folder-index` (`Folder Index`): `indexFilename` inside the folder when `indexFileUserSpecified`, else a note named after the folder.
- Anything missing from `obsidian-typings` is added there, never declared locally.

## Conventions

- Gates: `npm run gate` runs format, spellcheck, markdown lint with link checks, build, lint, `find-overexposed` and unit-test coverage.
