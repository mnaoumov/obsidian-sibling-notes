# Delete and go to next

Reviewing a folder often means reading a note, deciding it can go, and moving on: an inbox of clipped articles, a pile of scratch notes, the drafts of last week. Obsidian's own delete then sends you back to whatever note you had open before, somewhere else in the vault, and you have to find your place again.

`Sibling Notes` has a command that deletes the current file and opens the next item of the same folder instead, so the review carries on where it was.

## Try it

Deleting is real, so this walkthrough uses a throwaway folder, `Materials/07 Delete and go to next`, with three notes. The first button builds it, or rebuilds the notes you already deleted, and opens `Article 2`:

```code-button
---
caption: Fill the inbox and open Article 2
---
await require('/demoSetup.ts').prepareInbox(app);
```

Manual equivalent: create a folder with a few notes you do not need, and open one of them.

Now delete `Article 2` and go to the next item:

```code-button
---
caption: Delete the current file and go to the next item
---
await require('/demoSetup.ts').runNavigationCommand(app, 'delete-and-go-to-next');
```

Manual equivalent: **`Sibling Notes`: Delete the current file and go to the next item** in the Command Palette. Bind it to a hotkey in **Settings → Hotkeys** for a quick review.

`Article 3` should now be open.

## Where it lands

1. On the **next item** of the folder, in File explorer order.
2. On the **previous item**, when the deleted file was the last one. Run the button again on `Article 3` and you land on `Article 1`.
3. On the folder's [virtual folder note](<./04 Virtual folder note.md>), now empty, when the deleted file was the folder's only item.

The next item can be a subfolder, which opens as its virtual folder note, as with every other step.

## How it deletes

It deletes the way Obsidian's own **Delete current file** does, with your settings in **Settings → Files and links**:

1. **Confirm file deletion** decides whether you are asked first. If you cancel, nothing is deleted and you stay where you were.
2. **Deleted files** decides whether the file goes to the system trash, to the vault's `.trash` folder, or is deleted for good.
3. **Delete unlinked attachments** decides what happens to the attachments only that note used.

A virtual folder note stands for a whole folder, so the command is not offered there: it only ever deletes one file.
