# CHANGELOG

## 1.1.1

- fix: re #1
- chore(deps): update fast-uri to patched 3.1.9
- chore: adopt keyword identifier lint rule
- chore: adopt readonly interface members
- test: drop obsolete text-component probe patches
- docs: clarify neighbouring files sorting support
- docs(readme): combine related resources and plugin comparisons
- refactor: group src into feature folders
- docs(readme): add a Similar plugins section from a prior-art search

## 1.1.0

- test(demo-vault): floor `CodeScript Toolkit` at 15.0.0
- feat: show Up as a folder-up icon everywhere
- feat: put the top navigator bar above the inline title and properties
- feat: open the next or previous item by scrolling past a note's edge
- build(deps): move to obsidian-lib 6 and obsidian-dev-toolkit 5
- docs: shorten the debugging section
- chore: replace leftover obsidian-dev-utils references with @mnaoumov/obsidian-lib
- docs(readme): lead the Debugging section with `Advanced Debug Mode`
- docs: link the changelog and point the installation at the community directory listing

## 1.0.0

- fix(folder-map-sheet): give the bottom sheet a single header row
- docs: add the desktop and mobile screenshots and the README gallery
- refactor(navigator-bar): read the renderer's header and footer from obsidian-typings
- build(deps): lock obsidian-dev-toolkit 3.7.0 so unit tests run on CI
- test: run the Android and desktop integration suites in test:integration
- docs: finish the demo vault and README, and enforce 100% coverage
- feat: show the folder map from the navigator bar
- ci: pin Node 26 in .nvmrc
- feat: open a subfolder as a virtual folder note
- feat: show a navigator bar above and below the note
- feat: step through a folder in File explorer order
- docs: mark plugin names as code
- docs: record the approved design and internals in AGENTS.md
- chore: scaffold `Sibling Notes` with create-obsidian-plugin
