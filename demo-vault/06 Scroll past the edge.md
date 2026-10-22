# Scroll past the edge

`Sibling Notes` can open the next item when you keep scrolling past the bottom of a note, and the previous item when you keep scrolling past its top. You read a folder like one long document, without reaching for a button.

It is off by default, because it changes how scrolling behaves. Turn it on for both edges:

```code-button
---
caption: Scroll past either edge to move
---
await require('/demoSetup.ts').setOverscrollEdges(app, 'both');
```

Manual equivalent: pick **Both edges: previous and next** from **Open by scrolling past the edge** in **Settings → Community plugins → `Sibling Notes`**.

Then open `Chapter 1`:

```code-button
---
caption: Open Chapter 1
---
await require('/demoSetup.ts').openMaterial(app, 'Chapter 1.md');
```

Manual equivalent: click `Chapter 1` in the File explorer, inside `Materials/01 Folder navigation/`.

## How the pull works

1. Scroll to the end of the note. Nothing more happens yet, however hard you fling: a scroll that reaches the edge stops there.
2. Scroll down again. A strip appears at the bottom edge, reading **Keep scrolling for next: Chapter 2**, and fills up as you go on.
3. Once it is full, `Chapter 2` opens at its top.

Pause, or scroll back up, and the strip drains away without opening anything. Scrolling past the top works the same way and opens the previous item **at its end**, so reading backwards carries on where it should.

On a touch screen it is a pull, like pull-to-refresh: put your finger down at the end of the note and drag up. Once the strip says **Release to open next**, lift your finger.

At the first and the last item of the folder the strip says there is nothing further, and nothing opens. A subfolder is an item like any other, so the pull can land on its [virtual folder note](<./04 Virtual folder note.md>), which pulls on in turn.

Only the note itself pulls. A wheel over a code block, an embed or anything else inside the note that scrolls on its own never moves you.

## How far to pull

**Pull distance** is a third of the note's height on screen by default. Make it shorter for a quicker pull, or longer if you move by accident. Both settings are listed in [02 Settings](<./02 Settings.md>).

## Turn it off

```code-button
---
caption: Turn scrolling past the edge off
---
await require('/demoSetup.ts').setOverscrollEdges(app, 'none');
```

Manual equivalent: pick **Off** from **Open by scrolling past the edge**. **Bottom edge only: next** keeps the pull to the next item and leaves the top of every note alone.
