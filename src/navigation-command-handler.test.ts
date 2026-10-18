import type { TAbstractFile } from 'obsidian';

import { noopAsync } from '@mnaoumov/typescript-lib/function';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { SiblingNavigator } from './sibling-navigator.ts';

import { NavigationAction } from './navigation-action.ts';
import { NavigationCommandHandler } from './navigation-command-handler.ts';

interface HandlerFixture {
  readonly handler: NavigationCommandHandler;
  readonly navigate: ReturnType<typeof vi.fn>;
}

describe('NavigationCommandHandler', () => {
  function createHandler(action: NavigationAction, target: null | TAbstractFile): HandlerFixture {
    const navigate = vi.fn(() => noopAsync());
    const siblingNavigator = strictProxy<SiblingNavigator>({
      getTarget: vi.fn(() => target),
      navigate
    });
    return { handler: new NavigationCommandHandler({ action, siblingNavigator }), navigate };
  }

  it('names each action\'s command', () => {
    const ids = Object.values(NavigationAction).map((action) => createHandler(action, null).handler.buildCommand().id);
    expect(ids).toStrictEqual(['go-to-last', 'go-to-first', 'go-to-next', 'go-page-down', 'go-page-up', 'go-to-previous', 'go-up']);
    expect(createHandler(NavigationAction.Next, null).handler.buildCommand().name).toBe('Go to the next item in the folder');
  });

  it('is available only while its action has a target, and navigates when run', async () => {
    expect(createHandler(NavigationAction.Next, null).handler.buildCommand().checkCallback?.(true)).toBe(false);

    const { handler, navigate } = createHandler(NavigationAction.Next, castTo<TAbstractFile>({ path: 'd/b.md' }));
    const command = handler.buildCommand();
    expect(command.checkCallback?.(true)).toBe(true);
    command.checkCallback?.(false);
    await vi.waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(NavigationAction.Next);
    });
  });
});
