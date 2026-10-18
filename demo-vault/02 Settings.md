# Settings

Every setting `Sibling Notes` stores, listed by the **key it is written under in `data.json`** rather than by its display label — that is what you see when you open the file, hit a sync conflict, or read a support thread.

Find them in Obsidian under **Settings → Community plugins → `Sibling Notes`**.

## General

- `pageSize`
  - a whole number, 10 by default, shown in the settings tab as **Page size**. How many items **Go a page up in the folder** and **Go a page down in the folder** move. They stop at the first and the last item.

## Try it

Change the setting without leaving this note. The change applies live, so there is no reload.

```code-button
---
caption: Set pageSize to 2
---
await require('/demoSetup.ts').setPageSize(app, 2);
```

Manual equivalent: type `2` into **Page size** in the settings tab.

With a page size of 2, open `Chapter 1` in [01 Folder navigation](<./01 Folder navigation.md>) and go a page down: you land on `Chapter 3`. When you are done, put it back:

```code-button
---
caption: Reset pageSize to its default
---
await require('/demoSetup.ts').setPageSize(app, 10);
```

Manual equivalent: type `10` back into the field.
