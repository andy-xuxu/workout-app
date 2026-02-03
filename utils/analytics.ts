import { WorkoutLog } from '../types';

type Period = 'day' | 'week' | 'month';

export type AggregatedMetrics = {
  dateKey: string;
  date: Date;
  totalDurationSeconds: number;
  totalVolume: number;
  totalReps: number;
  workoutCount: number;
};

export type ExercisePB = {
  exerciseId: string;
  exerciseName: string;
  maxWeight?: { value: number; date: Date; workoutId: string };
  maxReps?: { value: number; date: Date; workoutId: string };
  maxVolume?: { value: number; date: Date; workoutId: string };
  maxTotalVolume?: { value: number; date: Date; workoutId: string };
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
    const duration = log.durationSeconds ?? 0;
    const volume = calculateLogVolume(log);
    const reps = calculateLogReps(log);

    if (existing) {
      existing.totalDurationSeconds += duration;
      existing.totalVolume += volume;
      existing.totalReps += reps;
      existing.workoutCount += 1;
    } else {
      map.set(key, {
        dateKey: key,
        date: parseDateKey(key),
        totalDurationSeconds: duration,
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
  metric: 'duration' | 'volume' | 'reps'
): Array<{ date: Date; value: number }> => {
  return aggregated.map((item) => ({
    date: item.date,
    value:
      metric === 'duration'
        ? item.totalDurationSeconds
        : metric === 'volume'
        ? item.totalVolume
        : item.totalReps,
  }));
};

export const calculateExercisePBs = (logs: WorkoutLog[]): ExercisePB[] => {
  const pbMap = new Map<string, ExercisePB>();

  logs.forEach((log) => {
    log.exercises.forEach((exercise) => {
      const key = exercise.exerciseId;
      const existing = pbMap.get(key) || {
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
      };

      let totalVolume = 0;

      exercise.sets.forEach((set) => {
        const weight = set.weight ?? 0;
        const volume = weight * set.reps;
        totalVolume += volume;

        if (!existing.maxWeight || weight > existing.maxWeight.value) {
          existing.maxWeight = { value: weight, date: new Date(log.completedAt), workoutId: log.id };
        }
        if (!existing.maxReps || set.reps > existing.maxReps.value) {
          existing.maxReps = { value: set.reps, date: new Date(log.completedAt), workoutId: log.id };
        }
        if (!existing.maxVolume || volume > existing.maxVolume.value) {
          existing.maxVolume = { value: volume, date: new Date(log.completedAt), workoutId: log.id };
        }
      });

      if (!existing.maxTotalVolume || totalVolume > existing.maxTotalVolume.value) {
        existing.maxTotalVolume = { value: totalVolume, date: new Date(log.completedAt), workoutId: log.id };
      }

      pbMap.set(key, existing);
    });
  });

  return Array.from(pbMap.values()).sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
};
