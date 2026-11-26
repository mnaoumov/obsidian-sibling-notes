import type {
  App as AppOriginal,
  TAbstractFile,
  WorkspaceLeaf
} from 'obsidian';
import type { MockInstance } from 'vitest';

import { noopAsync } from '@mnaoumov/typescript-lib/function';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { FileView } from 'obsidian';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { SiblingNavigator } from './sibling-navigator.ts';

import { DeleteAndGoToNextCommandHandler } from './delete-and-go-to-next-command-handler.ts';

interface Fixture {
  readonly app: AppOriginal;
  readonly deletionPromptMock: MockInstance;
  readonly execute: () => Promise<void>;
  readonly handler: DeleteAndGoToNextCommandHandler;
  readonly leaf: WorkspaceLeaf;
  readonly newLeaf: WorkspaceLeaf;
  readonly open: ReturnType<typeof vi.fn>;
}

interface FixtureOptions {
  readonly isConfirmed?: boolean;
  readonly isLeafInWorkspace?: boolean;
  readonly targetPath?: null | string;
}

interface TestableHandler {
  readonly execute: () => Promise<void>;
}

describe('DeleteAndGoToNextCommandHandler', () => {
  it('names its command', () => {
    const command = createFixture().handler.buildCommand();
    expect(command.id).toBe('delete-and-go-to-next');
    expect(command.name).toBe('Delete the current file and go to the next item');
    expect(command.icon).toBe('trash-2');
  });

  it('is offered for the file of an active file view only', () => {
    expect(createFixture().handler.buildCommand().checkCallback?.(true)).toBe(true);

    const noView = createFixture();
    vi.mocked(noView.app.workspace.getActiveViewOfType).mockReturnValue(null);
    expect(noView.handler.buildCommand().checkCallback?.(true)).toBe(false);

    const noFile = createFixture();
    vi.mocked(noFile.app.workspace.getActiveViewOfType).mockReturnValue(createFileView(null, noFile.leaf));
    expect(noFile.handler.buildCommand().checkCallback?.(true)).toBe(false);

    const noParent = createFixture();
    const orphan = castTo<TAbstractFile>({ parent: null, path: 'orphan.md' });
    vi.mocked(noParent.app.workspace.getActiveViewOfType).mockReturnValue(createFileView(orphan, noParent.leaf));
    expect(noParent.handler.buildCommand().checkCallback?.(true)).toBe(false);
  });

  it('deletes through Obsidian\'s prompt, then lands in the same leaf', async () => {
    const fixture = createFixture();
    await fixture.execute();
    expect(castTo<TAbstractFile>(fixture.deletionPromptMock.mock.calls[0]?.[0]).path).toBe('d/b.md');
    expect(castTo<TAbstractFile>(fixture.open.mock.calls[0]?.[0]).path).toBe('d/c.md');
    expect(fixture.open.mock.calls[0]?.[1]).toBe(fixture.leaf);
  });

  it('lands in the leaf a link would open in when the deleted file\'s leaf is gone', async () => {
    const fixture = createFixture({ isLeafInWorkspace: false });
    await fixture.execute();
    expect(fixture.open.mock.calls[0]?.[1]).toBe(fixture.newLeaf);
  });

  it('changes nothing when the prompt is cancelled', async () => {
    const fixture = createFixture({ isConfirmed: false });
    await fixture.execute();
    expect(fixture.deletionPromptMock).toHaveBeenCalledTimes(1);
    expect(fixture.open).not.toHaveBeenCalled();
  });

  it('leaves Obsidian\'s default when there is nowhere to land, or the target went with the file', async () => {
    const nowhere = createFixture({ targetPath: null });
    await nowhere.execute();
    expect(nowhere.deletionPromptMock).toHaveBeenCalledTimes(1);
    expect(nowhere.open).not.toHaveBeenCalled();

    const gone = createFixture({ targetPath: 'd/gone.md' });
    await gone.execute();
    expect(gone.deletionPromptMock).toHaveBeenCalledTimes(1);
    expect(gone.open).not.toHaveBeenCalled();
  });

  it('does nothing when the active file view is gone by the time it runs', async () => {
    const fixture = createFixture();
    vi.mocked(fixture.app.workspace.getActiveViewOfType).mockReturnValue(null);
    await fixture.execute();
    expect(fixture.deletionPromptMock).not.toHaveBeenCalled();
  });
});

function createFileView(file: null | TAbstractFile, leaf: WorkspaceLeaf): FileView {
  const view = castTo<FileView>(Object.create(FileView.prototype));
  view.file = castTo<FileView['file']>(file);
  Object.defineProperty(view, 'leaf', { value: leaf });
  return view;
}

function createFixture(options: FixtureOptions = {}): Fixture {
  const { isConfirmed = true, isLeafInWorkspace = true, targetPath = 'd/c.md' } = options;
  const mockApp = App.createConfigured__();
  mockApp.vault.createFolderSync__('d');
  for (const name of ['a', 'b', 'c']) {
    mockApp.vault.createSync__(`d/${name}.md`, '');
  }
  const app = mockApp.asOriginalType__();

  const leaf = castTo<WorkspaceLeaf>({ id: 'leaf' });
  const newLeaf = castTo<WorkspaceLeaf>({ id: 'new-leaf' });
  const file = app.vault.getFileByPath('d/b.md');
  vi.spyOn(app.workspace, 'getActiveViewOfType').mockReturnValue(createFileView(file, leaf));
  vi.spyOn(app.workspace, 'iterateAllLeaves').mockImplementation((callback) => {
    callback(isLeafInWorkspace ? leaf : newLeaf);
  });
  vi.spyOn(app.workspace, 'getLeaf').mockReturnValue(newLeaf);
  const deletionPromptMock: MockInstance = vi.spyOn(app.fileManager, 'promptForDeletion');
  deletionPromptMock.mockResolvedValue(isConfirmed);

  const target = targetPath === null
    ? null
    : app.vault.getAbstractFileByPath(targetPath) ?? castTo<TAbstractFile>({ path: targetPath });
  const open = vi.fn(() => noopAsync());
  const siblingNavigator = strictProxy<SiblingNavigator>({
    getTargetAfterRemoval: vi.fn(() => target),
    open
  });

  const handler = new DeleteAndGoToNextCommandHandler({ app, siblingNavigator });
  return {
    app,
    deletionPromptMock,
    execute: () => castTo<TestableHandler>(handler).execute(),
    handler,
    leaf,
    newLeaf,
    open
  };
}
