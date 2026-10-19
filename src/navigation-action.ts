/**
 * A step through a folder's sequence. Every one is a command, and every one but Enter is a button on the
 * navigator bar.
 */
export enum NavigationAction {
  End = 'end',
  Enter = 'enter',
  Home = 'home',
  Next = 'next',
  PageDown = 'pageDown',
  PageUp = 'pageUp',
  Previous = 'previous',
  Up = 'up'
}

/**
 * The actions that move within one folder's sequence, as opposed to {@link NavigationAction.Up}, which
 * leaves it, and {@link NavigationAction.Enter}, which goes into a subfolder's.
 */
export type InFolderNavigationAction = Exclude<NavigationAction, NavigationAction.Enter | NavigationAction.Up>;

interface GetNavigationTargetIndexParams {
  readonly action: InFolderNavigationAction;
  readonly currentIndex: number;
  readonly length: number;
  readonly pageSize: number;
}

/**
 * Answers where an in-folder action lands, as an index into the folder's sequence. There is no
 * wrap-around: an action that would leave the sequence, or stay where it is, has no target.
 *
 * @param params - The current position, the sequence length, the action and the page size.
 * @returns The target index, or `undefined` when the action is unavailable.
 */
export function getNavigationTargetIndex(params: GetNavigationTargetIndexParams): number | undefined {
  const { action, currentIndex, length } = params;
  if (currentIndex < 0 || currentIndex >= length) {
    return undefined;
  }

  const pageSize = Math.max(1, Math.floor(params.pageSize));
  const lastIndex = length - 1;
  const targetIndex = getUnclampedTargetIndex(action, currentIndex, lastIndex, pageSize);
  const clampedTargetIndex = Math.min(lastIndex, Math.max(0, targetIndex));
  return clampedTargetIndex === currentIndex ? undefined : clampedTargetIndex;
}

function getUnclampedTargetIndex(action: InFolderNavigationAction, currentIndex: number, lastIndex: number, pageSize: number): number {
  switch (action) {
    case NavigationAction.End: {
      return lastIndex;
    }
    case NavigationAction.Home: {
      return 0;
    }
    case NavigationAction.Next: {
      return currentIndex + 1;
    }
    case NavigationAction.PageDown: {
      return currentIndex + pageSize;
    }
    case NavigationAction.PageUp: {
      return currentIndex - pageSize;
    }
    case NavigationAction.Previous: {
      return currentIndex - 1;
    }
    default: {
      throw new Error(`Unknown navigation action: ${String(action)}`);
    }
  }
}
