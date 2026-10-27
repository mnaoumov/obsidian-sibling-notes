import type { WorkspaceLeaf } from 'obsidian';

import { noopAsync } from '@mnaoumov/typescript-lib/function';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { FolderMapComponent } from './folder-map-component.ts';
import type { FolderMapState } from './folder-map.ts';

import {
  FolderMapCommand,
  FolderMapCommandHandler
} from './folder-map-command-handler.ts';

interface Fixture {
  readonly getState: ReturnType<typeof vi.fn>;
  readonly handler: FolderMapCommandHandler;
  readonly pin: ReturnType<typeof vi.fn>;
  readonly show: ReturnType<typeof vi.fn>;
}

interface FixtureOptions {
  readonly command: FolderMapCommand;
  readonly mostRecentLeaf: null | WorkspaceLeaf;
  readonly state: FolderMapState | null;
}

const LEAF = castTo<WorkspaceLeaf>({});
const STATE = castTo<FolderMapState>({});

function createFixture(options: FixtureOptions): Fixture {
  const app = App.createConfigured__().asOriginalType__();
  vi.spyOn(app.workspace, 'getMostRecentLeaf').mockReturnValue(options.mostRecentLeaf);
  const getState = vi.fn(() => options.state);
  const pin = vi.fn(() => noopAsync());
  const show = vi.fn(() => noopAsync());
  const folderMapComponent = strictProxy<FolderMapComponent>({ getState, pin, show });
  return {
    getState,
    handler: new FolderMapCommandHandler({ app, command: options.command, folderMapComponent }),
    pin,
    show
  };
}

describe('FolderMapCommandHandler', () => {
  it('names each command', () => {
    const commands = Object.values(FolderMapCommand).map((command) => createFixture({ command, mostRecentLeaf: null, state: null }).handler.buildCommand());
    expect(commands.map(({ icon, id, name }) => ({ icon, id, name }))).toStrictEqual([
      { icon: 'pin', id: 'pin-folder-map', name: 'Pin the folder map to the side panel' },
      { icon: 'map', id: 'show-folder-map', name: 'Show the folder map' }
    ]);
  });

  it('always offers pinning, even with nothing open, since the pinned map follows whatever opens later', async () => {
    const { getState, handler, pin, show } = createFixture({ command: FolderMapCommand.Pin, mostRecentLeaf: null, state: null });
    const command = handler.buildCommand();
    expect(command.checkCallback?.(true)).toBe(true);
    command.checkCallback?.(false);
    await vi.waitFor(() => {
      expect(pin).toHaveBeenCalledTimes(1);
    });
    expect(show).not.toHaveBeenCalled();
    expect(getState).not.toHaveBeenCalled();
  });

  it('offers showing the map only while the main area\'s most recent leaf shows a file or a folder', () => {
    const unavailable = createFixture({ command: FolderMapCommand.Show, mostRecentLeaf: LEAF, state: null });
    expect(unavailable.handler.buildCommand().checkCallback?.(true)).toBe(false);
    expect(unavailable.getState).toHaveBeenCalledWith(LEAF);

    const available = createFixture({ command: FolderMapCommand.Show, mostRecentLeaf: LEAF, state: STATE });
    expect(available.handler.buildCommand().checkCallback?.(true)).toBe(true);
  });

  it('shows the map of the most recent leaf, anchored to no Map button', async () => {
    const { handler, pin, show } = createFixture({ command: FolderMapCommand.Show, mostRecentLeaf: LEAF, state: STATE });
    handler.buildCommand().checkCallback?.(false);
    await vi.waitFor(() => {
      expect(show).toHaveBeenCalledWith(LEAF, null);
    });
    expect(pin).not.toHaveBeenCalled();
  });

  it('shows nothing when the main area has no leaf left by the time the command runs', async () => {
    const { getState, handler, show } = createFixture({ command: FolderMapCommand.Show, mostRecentLeaf: null, state: STATE });
    handler.buildCommand().checkCallback?.(false);
    await vi.waitFor(() => {
      expect(getState).toHaveBeenCalledWith(null);
    });
    await noopAsync();
    expect(show).not.toHaveBeenCalled();
  });
});
