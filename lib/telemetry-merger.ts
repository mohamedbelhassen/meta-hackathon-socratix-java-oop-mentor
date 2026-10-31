import {
  ActivityProgress,
  CompetencyOccurrence,
  Lab,
  MicroCompetenciesStateMap,
  SessionStatus,
} from '@/types/socratix';

export interface RawConceptSignal {
  activity_id: string;
  micro_concept: string;
  file: string;
  location: string;
  status: 'PASS' | 'FAIL';
  diagnostic_note: string;
}

/**
 * Non-destructive telemetry aggregator:
 * Merges new occurrence signals into the student's micro_competencies_state map
 * without overwriting previously analyzed methods, attributes, or files.
 */
export function mergeMicroCompetenciesState(
  existingState: MicroCompetenciesStateMap = {},
  incomingSignals: RawConceptSignal[] = []
): MicroCompetenciesStateMap {
  // Deep clone existing state
  const updatedState: MicroCompetenciesStateMap = JSON.parse(
    JSON.stringify(existingState || {})
  );

  for (const signal of incomingSignals) {
    const conceptKey = signal.micro_concept;
    if (!updatedState[conceptKey]) {
      updatedState[conceptKey] = {
        status: 'IN_PROGRESS',
        score: 0,
        signal_count: 0,
        summary: '',
        occurrences: [],
      };
    }

    const entry = updatedState[conceptKey];
    entry.signal_count = (entry.signal_count || 0) + 1;

    // Search for existing occurrence with the same canonical key (file + location)
    const existingOccIndex = entry.occurrences.findIndex(
      (occ) => occ.file === signal.file && occ.location === signal.location
    );

    const newOcc: CompetencyOccurrence = {
      activity_id: signal.activity_id,
      file: signal.file,
      location: signal.location,
      status: signal.status,
      last_signal: signal.status === 'PASS' ? 'POSITIVE' : 'NEGATIVE',
      note: signal.diagnostic_note,
    };

    if (existingOccIndex >= 0) {
      // Update existing occurrence non-destructively
      entry.occurrences[existingOccIndex] = newOcc;
    } else {
      // Append new occurrence
      entry.occurrences.push(newOcc);
    }
  }

  // Deterministically recalculate score and status for all tracked concepts
  for (const conceptKey of Object.keys(updatedState)) {
    const entry = updatedState[conceptKey];
    const occurrences = entry.occurrences || [];
    const totalCount = occurrences.length;

    if (totalCount === 0) {
      entry.score = 0;
      entry.status = 'UNTESTED';
      entry.summary = 'Not yet evaluated.';
      continue;
    }

    const passCount = occurrences.filter((o) => o.status === 'PASS').length;
    const score = Math.round((passCount / totalCount) * 100);
    entry.score = score;

    if (score === 100) {
      entry.status = 'MASTERED';
      entry.summary = `Demonstrated across all ${totalCount} inspected location(s).`;
    } else if (score > 0 && score < 100) {
      entry.status = 'IN_PROGRESS';
      const failing = occurrences.filter((o) => o.status === 'FAIL');
      entry.summary = `Partial mastery (${passCount}/${totalCount}): Needs review in ${failing.map((f) => f.location).join(', ')}.`;
    } else {
      entry.status = 'STRUGGLING';
      entry.summary = `Struggling across ${totalCount} location(s): ${occurrences.map((o) => o.location).join(', ')}.`;
    }
  }

  return updatedState;
}

/**
 * Computes individual activity milestone completion and global lab progress percentage.
 */
export function computeActivitiesAndLabProgress(
  lab: Lab,
  existingCompletedMilestones: string[] = [],
  newlyCompletedMilestones: string[] = []
): {
  activities_progress: Record<string, ActivityProgress>;
  completed_milestone_ids: string[];
  progress_percent: number;
} {
  const completedSet = new Set<string>([
    ...(existingCompletedMilestones || []),
    ...(newlyCompletedMilestones || []),
  ]);

  const activitiesProgress: Record<string, ActivityProgress> = {};
  let totalLabMilestones = 0;
  let totalLabCompleted = 0;

  for (const act of lab.activities || []) {
    const actMilestones = act.milestones || [];
    const totalMilestones = actMilestones.length;
    totalLabMilestones += totalMilestones;

    const completedInAct = actMilestones
      .filter((m) => completedSet.has(m.id))
      .map((m) => m.id);

    totalLabCompleted += completedInAct.length;

    const percent = totalMilestones > 0
      ? Math.round((completedInAct.length / totalMilestones) * 100)
      : 100;

    activitiesProgress[act.id] = {
      title: act.title,
      completed_milestones: completedInAct,
      total_milestones: totalMilestones,
      percent,
      status: percent === 100 ? 'COMPLETED' : percent > 0 ? 'IN_PROGRESS' : 'NOT_STARTED',
    };
  }

  const globalPercent = totalLabMilestones > 0
    ? Math.round((totalLabCompleted / totalLabMilestones) * 100)
    : 100;

  return {
    activities_progress: activitiesProgress,
    completed_milestone_ids: Array.from(completedSet),
    progress_percent: globalPercent,
  };
}

/**
 * Deterministic State Machine for Student Session Status:
 * Transitions smoothly between NOT_STARTED, IN_PROGRESS, BLOCKED, and COMPLETED.
 */
export function computeSessionStatus(
  prevSession: {
    status?: SessionStatus;
    consecutive_errors?: number;
    last_stuck_at?: string | null;
  } | null,
  stuckThresholdTurns: number = 2,
  isLabCompleted: boolean = false,
  progressPercent: number = 0,
  hasUnresolvedError: boolean = false,
  newMilestonesCount: number = 0
): {
  status: SessionStatus;
  consecutive_errors: number;
  last_stuck_at: string | null;
} {
  const nowIso = new Date().toISOString();

  // Rule 1: Lab is fully finished
  if (isLabCompleted || progressPercent === 100) {
    return {
      status: 'COMPLETED',
      consecutive_errors: 0,
      last_stuck_at: null,
    };
  }

  // Rule 2: Milestone advanced OR no unresolved errors -> IN_PROGRESS
  if (newMilestonesCount > 0 || !hasUnresolvedError) {
    return {
      status: 'IN_PROGRESS',
      consecutive_errors: 0,
      last_stuck_at: null,
    };
  }

  // Rule 3: Has unresolved error and made no milestone progress in this turn
  const prevErrors = prevSession?.consecutive_errors || 0;
  const currentErrors = prevErrors + 1;
  const lastStuckAt = prevSession?.last_stuck_at || nowIso;

  const minutesStuck = (Date.now() - new Date(lastStuckAt).getTime()) / 60000;

  if (currentErrors >= stuckThresholdTurns || minutesStuck >= 10) {
    return {
      status: 'BLOCKED',
      consecutive_errors: currentErrors,
      last_stuck_at: lastStuckAt,
    };
  }

  return {
    status: 'IN_PROGRESS',
    consecutive_errors: currentErrors,
    last_stuck_at: lastStuckAt,
  };
}
