import { describe, expect, test } from 'bun:test';
import type { ProjectEntry } from '@/lib/api/types';
import type { SessionWorktreeAttachment } from '@/stores/types/sessionTypes';
import type { WorktreeMetadata } from '@/types/worktree';
import { resolveProjectActionsContext } from './useProjectActionsContext';

const projects: ProjectEntry[] = [
  { id: 'root', path: 'C:/repo/openchamber', label: 'OpenChamber' },
  { id: 'other', path: 'C:/repo/other', label: 'Other' },
];

const worktree: WorktreeMetadata = {
  path: 'C:/repo/openchamber-worktrees/feature-a',
  projectDirectory: 'C:/repo/openchamber',
  branch: 'feature-a',
  label: 'feature-a',
};

const createWorktreeCatalog = (): Map<string, WorktreeMetadata[]> =>
  new Map<string, WorktreeMetadata[]>([[projects[0].path, [worktree]]]);

const createAttachment = (
  overrides: Partial<SessionWorktreeAttachment> = {},
): SessionWorktreeAttachment => ({
  worktreeRoot: worktree.path,
  cwd: `${worktree.path}/src`,
  branch: worktree.branch,
  headState: 'branch',
  worktreeStatus: 'ready',
  worktreeSource: 'existing',
  legacy: false,
  degraded: false,
  attentionReason: null,
  ...overrides,
});

describe('resolveProjectActionsContext', () => {
  test('runs project actions from the authoritative attached worktree directory', () => {
    const result = resolveProjectActionsContext({
      projects,
      activeProjectId: 'other',
      currentSessionDirectory: projects[1].path,
      worktreeAttachment: createAttachment(),
      availableWorktreesByProject: createWorktreeCatalog(),
    });

    expect(result).toEqual({
      projectRef: { id: 'root', path: projects[0].path },
      directory: `${worktree.path}/src`,
    });
  });

  test('uses the worktree root for degraded attachments', () => {
    const result = resolveProjectActionsContext({
      projects,
      activeProjectId: 'other',
      currentSessionDirectory: projects[1].path,
      worktreeAttachment: createAttachment({
        cwd: 'C:/somewhere/outside',
        worktreeStatus: 'invalid',
        degraded: true,
      }),
      availableWorktreesByProject: createWorktreeCatalog(),
    });

    expect(result).toEqual({
      projectRef: { id: 'root', path: projects[0].path },
      directory: worktree.path,
    });
  });

  test('keeps legacy worktree metadata mapped to its owning project', () => {
    const result = resolveProjectActionsContext({
      projects,
      activeProjectId: 'other',
      worktreeMetadata: worktree,
      availableWorktreesByProject: new Map<string, WorktreeMetadata[]>(),
    });

    expect(result).toEqual({
      projectRef: { id: 'root', path: projects[0].path },
      directory: worktree.path,
    });
  });

  test('maps a pending draft directory through the worktree catalog', () => {
    const result = resolveProjectActionsContext({
      projects,
      activeProjectId: null,
      draftDirectory: 'C:\\repo\\openchamber-worktrees\\feature-a\\client',
      availableWorktreesByProject: createWorktreeCatalog(),
    });

    expect(result).toEqual({
      projectRef: { id: 'root', path: projects[0].path },
      directory: `${worktree.path}/client`,
    });
  });

  test('falls back to the active project root outside worktree sessions', () => {
    const result = resolveProjectActionsContext({
      projects,
      activeProjectId: 'root',
      availableWorktreesByProject: createWorktreeCatalog(),
    });

    expect(result).toEqual({
      projectRef: { id: 'root', path: projects[0].path },
      directory: projects[0].path,
    });
  });
});
