import React from 'react';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useSessionUIStore } from '@/sync/session-ui-store';
import { useSessionWorktreeStore } from '@/sync/session-worktree-store';
import { getAttachedSessionDirectory } from '@/sync/session-worktree-contract';
import { useSession } from '@/sync/sync-context';
import { resolveProjectForSessionDirectory } from '@/lib/projectResolution';
import type { ProjectRef } from '@/lib/openchamberConfig';
import type { ProjectEntry } from '@/lib/api/types';
import type { SessionWorktreeAttachment } from '@/stores/types/sessionTypes';
import type { WorktreeMetadata } from '@/types/worktree';

export interface ProjectActionsContext {
  projectRef: ProjectRef;
  directory: string;
}

const normalize = (value: string): string => {
  if (!value) return '';
  const replaced = value.replace(/\\/g, '/');
  return replaced === '/' ? '/' : replaced.replace(/\/+$/, '');
};

type ProjectActionsContextInput = {
  projects: ProjectEntry[];
  activeProjectId: string | null;
  currentSessionDirectory?: string | null;
  worktreeAttachment?: SessionWorktreeAttachment | null;
  worktreeMetadata?: WorktreeMetadata | null;
  draftDirectory?: string | null;
  availableWorktreesByProject: Map<string, WorktreeMetadata[]>;
};

export function resolveProjectActionsContext({
  projects,
  activeProjectId,
  currentSessionDirectory,
  worktreeAttachment,
  worktreeMetadata,
  draftDirectory,
  availableWorktreesByProject,
}: ProjectActionsContextInput): ProjectActionsContext | null {
  const attachmentDirectory = normalize(getAttachedSessionDirectory(worktreeAttachment) || '');
  const legacyWorktreeDirectory = normalize(worktreeMetadata?.path || '');
  const sessionDirectory = normalize(currentSessionDirectory || '');
  const normalizedDraftDirectory = normalize(draftDirectory || '');
  const activeProject = activeProjectId
    ? projects.find((project) => project.id === activeProjectId) ?? null
    : null;

  const directory = attachmentDirectory
    || legacyWorktreeDirectory
    || sessionDirectory
    || normalizedDraftDirectory
    || normalize(activeProject?.path || '');

  if (!directory) {
    return null;
  }

  const projectForDirectory = resolveProjectForSessionDirectory(
    projects,
    availableWorktreesByProject,
    directory,
  );
  const projectFromMetadata = worktreeMetadata?.projectDirectory
    ? resolveProjectForSessionDirectory(
      projects,
      availableWorktreesByProject,
      worktreeMetadata.projectDirectory,
    )
    : null;
  const project = projectForDirectory ?? projectFromMetadata ?? activeProject;

  if (!project) {
    return null;
  }

  return {
    projectRef: {
      id: project.id,
      path: project.path,
    },
    directory,
  };
}

/**
 * Resolves the active project ref + working directory used by
 * {@link ProjectActionsButton}. Directory priority mirrors the header:
 * authoritative worktree attachment → legacy worktree metadata → session →
 * draft → project path. A sticky ref keeps the last good context so the
 * actions button doesn't flicker during session switches.
 */
export function useProjectActionsContext(): ProjectActionsContext | null {
  const projects = useProjectsStore((state) => state.projects);
  const activeProjectId = useProjectsStore((state) => state.activeProjectId);

  const currentSessionId = useSessionUIStore((state) => state.currentSessionId);
  const currentSession = useSession(currentSessionId ?? null);

  const worktreeAttachment = useSessionWorktreeStore((state) =>
    currentSessionId ? state.getAttachment(currentSessionId) : undefined
  );
  const worktreeMetadata = useSessionUIStore((state) =>
    currentSessionId ? state.worktreeMetadata.get(currentSessionId) ?? null : null
  );
  const draftDirectory = useSessionUIStore((state) => {
    if (!state.newSessionDraft?.open) {
      return '';
    }
    return normalize(state.newSessionDraft.bootstrapPendingDirectory ?? state.newSessionDraft.directoryOverride ?? '');
  });
  const availableWorktreesByProject = useSessionUIStore((state) => state.availableWorktreesByProject);

  const sessionDirectory = React.useMemo(() => {
    const raw = typeof currentSession?.directory === 'string' ? currentSession.directory : '';
    return normalize(raw || '');
  }, [currentSession?.directory]);

  const resolvedContext = React.useMemo(() => resolveProjectActionsContext({
    projects,
    activeProjectId,
    currentSessionDirectory: sessionDirectory,
    worktreeAttachment,
    worktreeMetadata,
    draftDirectory,
    availableWorktreesByProject,
  }), [
    activeProjectId,
    availableWorktreesByProject,
    draftDirectory,
    projects,
    sessionDirectory,
    worktreeAttachment,
    worktreeMetadata,
  ]);

  const lastContextRef = React.useRef<ProjectActionsContext | null>(null);
  React.useEffect(() => {
    if (resolvedContext) {
      lastContextRef.current = resolvedContext;
    }
  }, [resolvedContext]);

  return React.useMemo(() => {
    if (resolvedContext) {
      return resolvedContext;
    }
    return lastContextRef.current;
  }, [resolvedContext]);
}
