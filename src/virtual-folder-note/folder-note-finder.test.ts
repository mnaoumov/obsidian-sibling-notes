import type { Plugin } from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { FolderNoteConventions } from './folder-note-finder.ts';

import { findFolderNote } from './folder-note-finder.ts';

const ALL_CONVENTIONS: FolderNoteConventions = {
  shouldReadFolderNotePlugins: true,
  shouldUseFolderNoteBeside: true,
  shouldUseFolderNoteInside: true
};

function createApp(paths: readonly string[]): App {
  const app = App.createConfigured__();
  app.vault.createFolderSync__('p');
  app.vault.createFolderSync__('p/d');
  for (const path of paths) {
    app.vault.createSync__(path, '');
  }
  return app;
}

function find(app: App, conventions: FolderNoteConventions = ALL_CONVENTIONS): null | string {
  const originalApp = app.asOriginalType__();
  const folder = originalApp.vault.getFolderByPath('p/d');
  if (!folder) {
    throw new Error('No folder p/d.');
  }
  return findFolderNote(originalApp, folder, conventions)?.path ?? null;
}

function registerPlugin(app: App, id: string, settings: unknown): void {
  app.plugins.registerPlugin__(id, castTo<Plugin>({ settings }));
}

describe('findFolderNote', () => {
  it('finds a note inside the folder before one beside it, and nothing when neither exists', () => {
    expect(find(createApp(['p/d/d.md', 'p/d.md']))).toBe('p/d/d.md');
    expect(find(createApp(['p/d.md']))).toBe('p/d.md');
    expect(find(createApp(['p/d/other.md']))).toBeNull();
  });

  it('uses only the conventions that are switched on', () => {
    const app = createApp(['p/d/d.md', 'p/d.md']);
    expect(find(app, { ...ALL_CONVENTIONS, shouldUseFolderNoteInside: false })).toBe('p/d.md');
    expect(find(app, { ...ALL_CONVENTIONS, shouldUseFolderNoteBeside: false, shouldUseFolderNoteInside: false })).toBeNull();
  });

  it('follows the Folder notes plugin\'s name template and location', () => {
    const app = createApp(['p/d/d.md', 'p/d - note.md']);
    registerPlugin(app, 'folder-notes', { folderNoteName: '{{folder_name}} - note', folderNoteType: '.md', storageLocation: 'parentFolder' });
    expect(find(app)).toBe('p/d - note.md');
    expect(find(app, { ...ALL_CONVENTIONS, shouldReadFolderNotePlugins: false })).toBe('p/d/d.md');
  });

  it('follows the Folder Note plugin\'s index, outside and inside methods', () => {
    const app = createApp(['p/d/_about_.md']);
    registerPlugin(app, 'folder-note-plugin', { folderNoteName: '_about_', folderNoteType: 'index' });
    expect(find(app)).toBe('p/d/_about_.md');

    const outsideApp = createApp(['p/d.md']);
    registerPlugin(outsideApp, 'folder-note-plugin', { folderNoteType: 'outside' });
    expect(find(outsideApp, { ...ALL_CONVENTIONS, shouldUseFolderNoteBeside: false })).toBe('p/d.md');

    const insideApp = createApp(['p/d/d.md']);
    registerPlugin(insideApp, 'folder-note-plugin', { folderNoteType: 'inside' });
    expect(find(insideApp, { ...ALL_CONVENTIONS, shouldUseFolderNoteInside: false })).toBe('p/d/d.md');
  });

  it('follows Waypoint\'s custom file name, outside and inside locations', () => {
    const app = createApp(['p/d/index.md']);
    registerPlugin(app, 'waypoint', { folderNoteFilename: 'index', folderNoteType: 'CUSTOM_FILENAME' });
    expect(find(app)).toBe('p/d/index.md');

    const outsideApp = createApp(['p/d.md']);
    registerPlugin(outsideApp, 'waypoint', { folderNoteType: 'OUTSIDE_FOLDER' });
    expect(find(outsideApp, { ...ALL_CONVENTIONS, shouldUseFolderNoteBeside: false })).toBe('p/d.md');

    const insideApp = createApp(['p/d/d.md']);
    registerPlugin(insideApp, 'waypoint', { folderNoteType: 'INSIDE_FOLDER' });
    expect(find(insideApp, { ...ALL_CONVENTIONS, shouldUseFolderNoteInside: false })).toBe('p/d/d.md');
  });

  it('follows Folder Index\'s user-specified index file name', () => {
    const app = createApp(['p/d/!.md']);
    registerPlugin(app, 'obsidian-folder-index', { indexFilename: '!', indexFileUserSpecified: true });
    expect(find(app)).toBe('p/d/!.md');

    const defaultApp = createApp(['p/d/d.md']);
    registerPlugin(defaultApp, 'obsidian-folder-index', { indexFilename: '!', indexFileUserSpecified: false });
    expect(find(defaultApp, { ...ALL_CONVENTIONS, shouldUseFolderNoteInside: false })).toBe('p/d/d.md');
  });

  it('falls back to a note named after the folder when a plugin\'s settings are unusable', () => {
    const app = createApp(['p/d/d.md']);
    registerPlugin(app, 'folder-note-plugin', { folderNoteType: 'index' });
    registerPlugin(app, 'waypoint', { folderNoteType: 'CUSTOM_FILENAME' });
    registerPlugin(app, 'obsidian-folder-index', null);
    expect(find(app, { ...ALL_CONVENTIONS, shouldUseFolderNoteInside: false })).toBe('p/d/d.md');
  });
});
