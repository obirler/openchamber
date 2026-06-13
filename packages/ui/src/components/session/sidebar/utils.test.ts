import { describe, expect, test } from 'bun:test';
import type { Session } from '@opencode-ai/sdk/v2';

import type { SessionNode } from './types';
import {
  collectSessionAncestorIds,
  getSessionTreeIndentPx,
  isPathWithinProject,
  treeHasExpansionStateChange,
} from './utils';

const createSession = (id: string, parentID: string | null = null): Session => {
  return {
    id,
    title: id,
    ...(parentID ? { parentID } : {}),
  } as Session & { parentID?: string | null };
};

const createNode = (session: Session, children: SessionNode[] = []): SessionNode => {
  return { session, children, worktree: null };
};

describe('getSessionTreeIndentPx', () => {
  test('applies a fixed indent step for each nested depth', () => {
    expect(getSessionTreeIndentPx(0)).toBe(6);
    expect(getSessionTreeIndentPx(1)).toBe(20);
    expect(getSessionTreeIndentPx(2)).toBe(34);
    expect(getSessionTreeIndentPx(3)).toBe(48);
    expect(getSessionTreeIndentPx(-1)).toBe(6);
  });
});

describe('collectSessionAncestorIds', () => {
  test('collects the full parent chain for arbitrarily nested subagents', () => {
    const sessions = [
      createSession('root'),
      createSession('level-1', 'root'),
      createSession('level-2', 'level-1'),
      createSession('level-3', 'level-2'),
    ];

    expect(collectSessionAncestorIds('level-3', sessions)).toEqual(['level-2', 'level-1', 'root']);
  });

  test('stops when a malformed cycle is encountered', () => {
    const sessions = [
      createSession('root', 'level-2'),
      createSession('level-1', 'root'),
      createSession('level-2', 'level-1'),
    ];

    expect(collectSessionAncestorIds('root', sessions)).toEqual(['level-2', 'level-1']);
  });
});

describe('isPathWithinProject', () => {
  test('matches child directories for root projects', () => {
    expect(isPathWithinProject('/workspace/app', '/')).toBe(true);
  });

  test('matches exact project directories', () => {
    expect(isPathWithinProject('/workspace/app', '/workspace/app')).toBe(true);
  });

  test('does not match sibling directory prefixes', () => {
    expect(isPathWithinProject('/workspace/app2', '/workspace/app')).toBe(false);
  });

  test('returns false when directory is null', () => {
    expect(isPathWithinProject(null, '/workspace/app')).toBe(false);
  });

  test('returns false when projectPath is null', () => {
    expect(isPathWithinProject('/workspace/app', null)).toBe(false);
  });

  test('matches deep child directories', () => {
    expect(isPathWithinProject('/workspace/app/sub/dir', '/workspace/app')).toBe(true);
  });
});

describe('treeHasExpansionStateChange', () => {
  const tree = createNode(createSession('root'), [
    createNode(createSession('level-1', 'root'), [
      createNode(createSession('level-2', 'level-1'), [
        createNode(createSession('level-3', 'level-2')),
      ]),
    ]),
  ]);

  test('detects expansion changes on deeper nested descendants', () => {
    const previousExpandedParents = new Set<string>();
    const nextExpandedParents = new Set<string>(['project:active:level-3']);

    expect(
      treeHasExpansionStateChange(tree, previousExpandedParents, nextExpandedParents, 'project', false),
    ).toBe(true);
  });

  test('ignores expansion changes from other render contexts', () => {
    const previousExpandedParents = new Set<string>();
    const nextExpandedParents = new Set<string>(['recent:active:level-3']);

    expect(
      treeHasExpansionStateChange(tree, previousExpandedParents, nextExpandedParents, 'project', false),
    ).toBe(false);
  });
});
