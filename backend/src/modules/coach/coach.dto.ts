import type {
  CoachGoal,
  CoachingPlanDetail,
  CoachingPlanSessionDetail,
  CoachingPlanSessionStatus,
  CoachingPlanStatus,
  CoachingPlanSummary,
  CoachingPlanWeekDetail,
  ReadinessSnapshot,
  TemplateExercise,
} from '@glob/shared';
import type { coachingPlanSessions, coachingPlanWeeks, coachingPlans } from '../../db/schema/index';

type PlanRow = typeof coachingPlans.$inferSelect;
type WeekRow = typeof coachingPlanWeeks.$inferSelect;
type SessionRow = typeof coachingPlanSessions.$inferSelect;

export function toCoachingPlanSummaryDto(
  row: PlanRow,
  counts: { weekCount: number; sessionCount: number; completedSessionCount: number },
): CoachingPlanSummary {
  return {
    id: row.id,
    status: row.status as CoachingPlanStatus,
    goal: row.goal as CoachGoal,
    durationWeeks: row.durationWeeks,
    daysPerWeek: row.daysPerWeek,
    startDate: row.startDate,
    generatedAt: row.generatedAt.toISOString(),
    weekCount: counts.weekCount,
    sessionCount: counts.sessionCount,
    completedSessionCount: counts.completedSessionCount,
  };
}

export function toCoachingPlanSessionDto(
  row: SessionRow,
  exercisesDto: TemplateExercise[],
): CoachingPlanSessionDetail {
  return {
    id: row.id,
    weekId: row.weekId,
    dayIndex: row.dayIndex,
    label: row.label,
    templateId: row.templateId,
    sessionId: row.sessionId,
    status: row.status as CoachingPlanSessionStatus,
    rationale: row.rationale,
    exercises: exercisesDto,
  };
}

export function toCoachingPlanWeekDto(
  row: WeekRow,
  sessions: CoachingPlanSessionDetail[],
): CoachingPlanWeekDetail {
  return {
    id: row.id,
    weekIndex: row.weekIndex,
    focus: row.focus,
    rationale: row.rationale,
    sessions: sessions.slice().sort((a, b) => a.dayIndex - b.dayIndex),
  };
}

export function toCoachingPlanDetailDto(row: PlanRow, weeks: CoachingPlanWeekDetail[]): CoachingPlanDetail {
  return {
    id: row.id,
    status: row.status as CoachingPlanStatus,
    goal: row.goal as CoachGoal,
    durationWeeks: row.durationWeeks,
    daysPerWeek: row.daysPerWeek,
    startDate: row.startDate,
    generatedAt: row.generatedAt.toISOString(),
    model: row.model,
    readinessSnapshot: row.readinessSnapshot as ReadinessSnapshot,
    rationale: row.rationale,
    weeks: weeks.slice().sort((a, b) => a.weekIndex - b.weekIndex),
  };
}
