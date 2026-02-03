import { WorkoutLog } from '../types';

type Period = 'day' | 'week' | 'month';

export type AggregatedMetrics = {
  dateKey: string;
  date: Date;
  totalVolume: number;
  totalReps: number;
  workoutCount: number;
};

const startOfDayKey = (timestamp: number): string => {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
};

const startOfWeekKey = (timestamp: number): string => {
  const date = new Date(timestamp);
  const day = date.getDay();
  const diff = date.getDate() - day;
  const start = new Date(date.getFullYear(), date.getMonth(), diff);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate()).toISOString();
};

const startOfMonthKey = (timestamp: number): string => {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
};

const getPeriodKey = (timestamp: number, period: Period): string => {
  if (period === 'day') return startOfDayKey(timestamp);
  if (period === 'week') return startOfWeekKey(timestamp);
  return startOfMonthKey(timestamp);
};

const parseDateKey = (key: string): Date => new Date(key);

export const calculateLogVolume = (log: WorkoutLog): number => {
  return log.exercises.reduce((total, exercise) => {
    const exerciseVolume = exercise.sets.reduce((sum, set) => {
      const weight = set.weight ?? 0;
      return sum + weight * set.reps;
    }, 0);
    return total + exerciseVolume;
  }, 0);
};

export const calculateLogReps = (log: WorkoutLog): number => {
  return log.exercises.reduce((total, exercise) => {
    const exerciseReps = exercise.sets.reduce((sum, set) => sum + set.reps, 0);
    return total + exerciseReps;
  }, 0);
};

export const aggregateLogsByPeriod = (logs: WorkoutLog[], period: Period): AggregatedMetrics[] => {
  const map = new Map<string, AggregatedMetrics>();

  logs.forEach((log) => {
    const key = getPeriodKey(log.completedAt, period);
    const existing = map.get(key);
    const volume = calculateLogVolume(log);
    const reps = calculateLogReps(log);

    if (existing) {
      existing.totalVolume += volume;
      existing.totalReps += reps;
      existing.workoutCount += 1;
    } else {
      map.set(key, {
        dateKey: key,
        date: parseDateKey(key),
        totalVolume: volume,
        totalReps: reps,
        workoutCount: 1,
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
};

export const pickSmartPeriod = (logs: WorkoutLog[]): Period => {
  if (logs.length === 0) return 'day';
  const sorted = [...logs].sort((a, b) => a.completedAt - b.completedAt);
  const oldest = sorted[0]?.completedAt ?? Date.now();
  const days = Math.max(1, Math.round((Date.now() - oldest) / (1000 * 60 * 60 * 24)));
  if (days <= 30) return 'day';
  if (days <= 90) return 'week';
  return 'month';
};

export const formatChartData = (
  aggregated: AggregatedMetrics[],
  metric: 'volume' | 'reps'
): Array<{ date: Date; value: number }> => {
  return aggregated.map((item) => ({
    date: item.date,
    value:
      metric === 'volume'
        ? item.totalVolume
        : item.totalReps,
  }));
};
