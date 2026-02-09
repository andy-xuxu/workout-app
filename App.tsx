import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WORKOUT_LIBRARY, CATEGORIES, PREDEFINED_WORKOUTS, type PredefinedWorkout } from './constants';
import { Workout, Category, SavedWorkout, WorkoutLog, ExerciseLog, SetLog } from './types';
import { storage } from './utils/storage';
import { aggregateLogsByPeriod, formatChartData, pickSmartPeriod, AggregatedMetrics } from './utils/analytics';

type AppMode =
  | 'landing'
  | 'view'
  | 'create'
  | 'saved'
  | 'view-saved'
  | 'workout-mode'
  | 'workout-active'
  | 'workout-history'
  | 'profile';

type TabType = 'train' | 'progress';

type TrackingMode = 'quick' | 'detailed';

type SetInput = {
  id: string;
  weight: string;
  reps: string;
};

type ExerciseTrackingState = {
  mode: TrackingMode;
  quickSets: string;
  quickReps: string;
  quickWeight: string;
  sets: SetInput[];
};

// Constants
const BADGE_INLINE_STYLES: React.CSSProperties = {
  textDecoration: 'none',
  textShadow: 'none',
  border: 'none',
  borderBottom: 'none',
  borderTop: 'none',
  borderLeft: 'none',
  borderRight: 'none',
  outline: 'none',
  WebkitTextStroke: '0',
  backgroundClip: 'padding-box',
  WebkitBackgroundClip: 'padding-box',
  lineHeight: '1.3',
  letterSpacing: '0.05em',
  boxShadow: 'none',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  textRendering: 'optimizeSpeed',
  transform: 'translateZ(0)',
  willChange: 'auto',
};

// Helper functions
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
};

const createDefaultTrackingState = (): ExerciseTrackingState => {
  const defaultSets: SetInput[] = [];
  for (let i = 0; i < 3; i += 1) {
    defaultSets.push({
      id: `default-set-${Date.now()}-${i}-${Math.random()}`,
      weight: '',
      reps: '',
    });
  }
  return {
    mode: 'detailed',
    quickSets: '3',
    quickReps: '10',
    quickWeight: '0',
    sets: defaultSets,
  };
};

const parseNumber = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const calculateLogVolume = (log: WorkoutLog): number => {
  return log.exercises.reduce((total, exercise) => {
    const exerciseVolume = exercise.sets.reduce((sum, set) => {
      const weight = set.weight ?? 0;
      return sum + weight * set.reps;
    }, 0);
    return total + exerciseVolume;
  }, 0);
};

const calculateTotalSets = (log: WorkoutLog): number => {
  return log.exercises.reduce((total, exercise) => {
    return total + exercise.sets.length;
  }, 0);
};

const calculateTotalReps = (log: WorkoutLog): number => {
  return log.exercises.reduce((total, exercise) => {
    const exerciseReps = exercise.sets.reduce((sum, set) => {
      return sum + set.reps;
    }, 0);
    return total + exerciseReps;
  }, 0);
};

type TimeSeriesPoint = { date: Date; value: number };

interface TimeSeriesChartProps {
  title: string;
  yAxisLabel: string;
  colorClassName: string;
  data: TimeSeriesPoint[];
  metric?: 'volume' | 'reps';
  onPointSelect?: (date: Date) => void;
  width?: number;
  height?: number;
  period?: 'day' | 'week' | 'month';
}

// Helper function to extract colors from Tailwind gradient classes
const getGradientColors = (colorClassName: string): { from: string; to: string } => {
  // Map common Tailwind gradient classes to hex colors
  const colorMap: Record<string, string> = {
    'emerald-500': '#10b981',
    'cyan-500': '#06b6d4',
    'purple-500': '#a855f7',
    'blue-500': '#3b82f6',
    'pink-500': '#ec4899',
    'orange-500': '#f97316',
  };

  const match = colorClassName.match(/from-(\S+)\s+to-(\S+)/);
  if (match) {
    const fromColor = colorMap[match[1]] || '#22c55e';
    const toColor = colorMap[match[2]] || '#3b82f6';
    return { from: fromColor, to: toColor };
  }
  
  // Default fallback
  return { from: '#22c55e', to: '#3b82f6' };
};

const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  title,
  yAxisLabel,
  colorClassName,
  data,
  metric,
  onPointSelect,
  width: propWidth,
  height: propHeight,
  period = 'day',
}) => {
  const isMobile = useIsMobile();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = propWidth ?? 320;
  const height = isMobile ? (propHeight ? propHeight * 1.5 : 320) : (propHeight ?? 240);
  const paddingLeft = isMobile ? 60 : 50;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = isMobile ? 60 : 50;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const values = data.map((point) => point.value);
  const minValue = 0;
  const maxValue = values.length ? Math.max(...values) : 0;
  const range = Math.max(1, maxValue - minValue);
  const gradientId = `chartGradient-${title.replace(/\s+/g, '-').toLowerCase()}`;
  const gradientColors = getGradientColors(colorClassName);

  // Calculate bar positions and dimensions
  const barWidth = data.length > 0 ? Math.max(8, (chartWidth / data.length) * 0.8) : 0;
  const barSpacing = data.length > 0 ? chartWidth / data.length : 0;

  const formatDate = (date: Date): string => {
    if (period === 'day') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (period === 'week') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
  };

  // Format Y-axis value based on metric type
  const formatYAxisValue = (value: number): string => {
    if (metric === 'volume') {
      // Format volume with K notation
      if (value >= 1000) {
        const kValue = value / 1000;
        // Round to nearest 0.5K for cleaner labels
        const rounded = Math.round(kValue * 2) / 2;
        return rounded % 1 === 0 ? `${rounded}K` : `${rounded}K`;
      }
      return Math.round(value).toString();
    } else if (metric === 'reps') {
      // Format reps - already rounded to increments of 10
      return Math.round(value).toString();
    }
    // Default formatting
    return Math.round(value).toLocaleString();
  };

  const formatTooltipValue = (value: number) => {
    if (metric === 'volume') {
      if (value >= 1000) {
        const kValue = value / 1000;
        return kValue % 1 === 0 ? `${kValue}K` : `${kValue.toFixed(1)}K`;
      }
      return Math.round(value).toLocaleString();
    }
    return Math.round(value).toLocaleString();
  };

  // Generate Y-axis labels with smart intervals based on metric type
  const generateYAxisLabels = () => {
    const yAxisTicks = 5;
    
    if (metric === 'volume') {
      // For volume: use K notation with smart intervals
      // Round maxValue up to nearest nice interval
      const maxK = maxValue / 1000;
      let niceMaxK: number;
      
      if (maxK <= 0.5) {
        niceMaxK = 0.5;
      } else if (maxK <= 1) {
        niceMaxK = 1;
      } else if (maxK <= 2) {
        niceMaxK = 2;
      } else if (maxK <= 5) {
        niceMaxK = 5;
      } else {
        // Round up to nearest 1K, 2K, 5K, 10K, etc.
        const magnitude = Math.pow(10, Math.floor(Math.log10(maxK)));
        const normalized = maxK / magnitude;
        let multiplier: number;
        if (normalized <= 1) multiplier = 1;
        else if (normalized <= 2) multiplier = 2;
        else if (normalized <= 5) multiplier = 5;
        else multiplier = 10;
        niceMaxK = magnitude * multiplier;
      }
      
      const niceMaxValue = niceMaxK * 1000;
      const interval = niceMaxValue / (yAxisTicks - 1);
      
      return Array.from({ length: yAxisTicks }, (_, i) => {
        const value = i * interval;
        return {
          value,
          y: paddingTop + chartHeight - (i / (yAxisTicks - 1)) * chartHeight,
        };
      });
    } else if (metric === 'reps') {
      // For reps: use increments of 10
      // Round maxValue up to nearest multiple of 10
      const niceMaxValue = Math.ceil(maxValue / 10) * 10;
      // Use increments that divide nicely into 5 ticks
      const interval = Math.max(10, Math.ceil(niceMaxValue / (yAxisTicks - 1) / 10) * 10);
      const adjustedMax = interval * (yAxisTicks - 1);
      
      return Array.from({ length: yAxisTicks }, (_, i) => {
        const value = i * interval;
        return {
          value,
          y: paddingTop + chartHeight - (i / (yAxisTicks - 1)) * chartHeight,
        };
      });
    } else {
      // Default: linear scale
      return Array.from({ length: yAxisTicks }, (_, i) => {
        const value = minValue + (maxValue - minValue) * (i / (yAxisTicks - 1));
        return {
          value: Math.round(value),
          y: paddingTop + chartHeight - (i / (yAxisTicks - 1)) * chartHeight,
        };
      });
    }
  };

  const yAxisLabels = generateYAxisLabels();
  
  // Update range for bar height calculation based on actual Y-axis max
  const actualMaxValue = yAxisLabels[yAxisLabels.length - 1]?.value ?? maxValue;
  const actualRange = Math.max(1, actualMaxValue - minValue);

  return (
    <div
      className="bg-[#111111] border border-gray-800 rounded-2xl p-4 md:p-5 shadow-xl"
    >
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <p className="text-[12px] text-gray-500 uppercase tracking-wider">{yAxisLabel}</p>
        </div>
        {data.length > 0 && (
          <div className="text-right flex flex-col items-end">
            <div className="flex items-baseline gap-1.5">
              <div className="text-2xl font-black text-emerald-400 tabular-nums leading-none tracking-tight">
                {hoverIndex !== null && data[hoverIndex]
                  ? `${formatTooltipValue(data[hoverIndex].value)} ${metric === 'volume' ? 'lbs' : 'reps'}`
                  : '--'}
              </div>
            </div>
            <div className="text-[11px] font-bold text-gray-400 mt-0.5 bg-gray-800/50 px-2 py-0.5 rounded-full border border-gray-700/50">
              {hoverIndex !== null && data[hoverIndex]
                ? data[hoverIndex].date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                : 'Select a bar'}
            </div>
          </div>
        )}
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center text-gray-600 text-sm" style={{ height: `${height}px` }}>
          No data yet
        </div>
      ) : (
        <div className="relative" onMouseLeave={() => setHoverIndex(null)}>
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: `${height}px` }}>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={gradientColors.from} />
                <stop offset="100%" stopColor={gradientColors.to} />
              </linearGradient>
            </defs>
            
            {/* Horizontal Gridlines */}
            {yAxisLabels.map((tick, i) => (
              <line
                key={`grid-${i}`}
                x1={paddingLeft}
                y1={tick.y}
                x2={paddingLeft + chartWidth}
                y2={tick.y}
                stroke="#1f2937"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            ))}
            
            {/* Y-axis line */}
            <line
              x1={paddingLeft}
              y1={paddingTop}
              x2={paddingLeft}
              y2={paddingTop + chartHeight}
              stroke="#374151"
              strokeWidth="1"
            />
            
            {/* X-axis line */}
            <line
              x1={paddingLeft}
              y1={paddingTop + chartHeight}
              x2={paddingLeft + chartWidth}
              y2={paddingTop + chartHeight}
              stroke="#374151"
              strokeWidth="1"
            />
            
            {/* Y-axis labels */}
            {yAxisLabels.map((tick, i) => (
              <g key={`y-tick-${i}`}>
                <line
                  x1={paddingLeft - 5}
                  y1={tick.y}
                  x2={paddingLeft}
                  y2={tick.y}
                  stroke="#374151"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 10}
                  y={tick.y + 4}
                  textAnchor="end"
                  fill="#d1d5db"
                  fontSize={isMobile ? "15" : "12"}
                  className="font-medium"
                >
                  {formatYAxisValue(tick.value)}
                </text>
              </g>
            ))}
            
            {/* Bars */}
            {data.map((point, index) => {
              const barHeight = (point.value / actualRange) * chartHeight;
              const x = paddingLeft + index * barSpacing + (barSpacing - barWidth) / 2;
              const y = paddingTop + chartHeight - barHeight;
              const isHovered = hoverIndex === index;
              
              // Show every Nth label to avoid crowding (show all if <= 10, otherwise show every 2nd or 3rd)
              const labelInterval = data.length <= 10 ? 1 : data.length <= 20 ? 2 : Math.ceil(data.length / 10);
              const shouldShowLabel = index % labelInterval === 0 || index === data.length - 1;
              
              return (
                <g key={`bar-${point.date.toISOString()}-${index}`}>
                  {/* Invisible hit area for easier interaction */}
                  {point.value > 0 && (
                    <rect
                      x={x - (barSpacing - barWidth) / 2}
                      y={paddingTop}
                      width={barSpacing}
                      height={chartHeight}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoverIndex(index)}
                      onMouseLeave={() => setHoverIndex(null)}
                    />
                  )}
                  
                  {/* Highlight background for hovered bar - REMOVED */}

                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={gradientColors.from}
                    fillOpacity={isHovered ? 0.7 : 1}
                    rx="3"
                    className="transition-all duration-200 cursor-pointer"
                    onMouseEnter={() => point.value > 0 && setHoverIndex(index)}
                    onMouseLeave={() => setHoverIndex(null)}
                    onClick={() => point.value > 0 && setHoverIndex(index)}
                  />
                  
                  {/* X-axis label */}
                  {shouldShowLabel && (
                    <text
                      x={x + barWidth / 2}
                      y={paddingTop + chartHeight + (isMobile ? 25 : 20)}
                      textAnchor="middle"
                      fill="#d1d5db"
                      fontSize={isMobile ? "15" : "12"}
                      className="font-medium"
                    >
                      {formatDate(point.date)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
};

interface CalendarViewProps {
  isOpen: boolean;
  onClose: () => void;
  workoutLogs: WorkoutLog[];
  selectedDate?: Date;
  onSelectLog: (log: WorkoutLog) => void;
  inline?: boolean;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  isOpen,
  onClose,
  workoutLogs,
  selectedDate,
  onSelectLog,
  inline = false,
}) => {
  const initialDate = selectedDate ?? (workoutLogs[0] ? new Date(workoutLogs[0].completedAt) : new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const [activeDateKey, setActiveDateKey] = useState<string | null>(
    selectedDate ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).toISOString() : null
  );

  useEffect(() => {
    if (selectedDate) {
      const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      setCurrentMonth(monthStart);
      setActiveDateKey(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).toISOString());
    }
  }, [selectedDate]);

  if (!isOpen) return null;

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayIndex = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const logsByDay = workoutLogs.reduce((acc: Record<string, WorkoutLog[]>, log) => {
    const date = new Date(log.completedAt);
    const key = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
    acc[key] = acc[key] ? [...acc[key], log] : [log];
    return acc;
  }, {} as Record<string, WorkoutLog[]>);

  const volumesByDay = Object.entries(logsByDay).reduce((acc: Record<string, number>, [key, logs]) => {
    const dayLogs = logs as WorkoutLog[];
    acc[key] = dayLogs.reduce((sum, log) => sum + calculateLogVolume(log), 0);
    return acc;
  }, {} as Record<string, number>);

  const maxVolume = Math.max(1, ...Object.values(volumesByDay));

  const dayCells = Array.from({ length: firstDayIndex + daysInMonth }, (_, idx) => {
    if (idx < firstDayIndex) return null;
    const day = idx - firstDayIndex + 1;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const key = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
    const volume = volumesByDay[key] ?? 0;
    const intensity = volume / maxVolume;
    return {
      day,
      key,
      intensity,
      hasWorkout: !!logsByDay[key],
    };
  });

  const activeLogs = activeDateKey ? logsByDay[activeDateKey] ?? [] : [];

  if (inline) {
    return (
      <div className="flex flex-col">
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
            className="px-3 py-2 text-sm text-gray-400 hover:text-white"
          >
            Prev
          </button>
          <div className="text-sm font-semibold text-white">
            {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </div>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
            className="px-3 py-2 text-sm text-gray-400 hover:text-white"
          >
            Next
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 p-5 text-xs text-gray-500">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
            <div key={label} className="text-center uppercase tracking-wide">
              {label}
            </div>
          ))}
          {dayCells.map((cell, index) =>
            cell ? (
              <button
                key={cell.key}
                onClick={() => setActiveDateKey(cell.key)}
                className={`h-10 rounded-lg text-sm font-semibold transition-all ${
                  cell.hasWorkout ? 'text-white' : 'text-gray-600'
                } ${activeDateKey === cell.key ? 'ring-2 ring-emerald-500/60' : ''}`}
                style={{
                  backgroundColor: cell.hasWorkout ? `rgba(34, 197, 94, ${0.15 + cell.intensity * 0.6})` : '#121212',
                }}
              >
                {cell.day}
              </button>
            ) : (
              <div key={`empty-${index}`} />
            )
          )}
        </div>

        <div className="border-t border-gray-800 p-5 overflow-y-auto">
          <h4 className="text-sm font-bold text-white mb-3">Workouts</h4>
          {activeLogs.length === 0 ? (
            <div className="text-sm text-gray-500">No workouts logged for this day.</div>
          ) : (
            <div className="space-y-3">
              {activeLogs.map((log) => (
                <button
                  key={log.id}
                  onClick={() => onSelectLog(log)}
                  className="w-full text-left bg-[#111111] border border-gray-800 rounded-xl p-3 hover:border-gray-700 transition-all"
                >
                  <div className="text-sm font-semibold text-white">{log.workoutName}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(log.completedAt).toLocaleDateString()} • Volume: {Math.round(calculateLogVolume(log))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0d0d0d] border border-gray-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h3 className="text-xl font-bold text-white">Workout Calendar</h3>
            <p className="text-xs text-gray-500">Tap a day to see workouts</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-black/60 hover:bg-gray-800 rounded-full text-white border border-gray-800"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
            className="px-3 py-2 text-sm text-gray-400 hover:text-white"
          >
            Prev
          </button>
          <div className="text-sm font-semibold text-white">
            {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </div>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
            className="px-3 py-2 text-sm text-gray-400 hover:text-white"
          >
            Next
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 p-5 text-xs text-gray-500">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
            <div key={label} className="text-center uppercase tracking-wide">
              {label}
            </div>
          ))}
          {dayCells.map((cell, index) =>
            cell ? (
              <button
                key={cell.key}
                onClick={() => setActiveDateKey(cell.key)}
                className={`h-10 rounded-lg text-sm font-semibold transition-all ${
                  cell.hasWorkout ? 'text-white' : 'text-gray-600'
                } ${activeDateKey === cell.key ? 'ring-2 ring-emerald-500/60' : ''}`}
                style={{
                  backgroundColor: cell.hasWorkout ? `rgba(34, 197, 94, ${0.15 + cell.intensity * 0.6})` : '#121212',
                }}
              >
                {cell.day}
              </button>
            ) : (
              <div key={`empty-${index}`} />
            )
          )}
        </div>

        <div className="border-t border-gray-800 p-5 overflow-y-auto">
          <h4 className="text-sm font-bold text-white mb-3">Workouts</h4>
          {activeLogs.length === 0 ? (
            <div className="text-sm text-gray-500">No workouts logged for this day.</div>
          ) : (
            <div className="space-y-3">
              {activeLogs.map((log) => (
                <button
                  key={log.id}
                  onClick={() => onSelectLog(log)}
                  className="w-full text-left bg-[#111111] border border-gray-800 rounded-xl p-3 hover:border-gray-700 transition-all"
                >
                  <div className="text-sm font-semibold text-white">{log.workoutName}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(log.completedAt).toLocaleDateString()} • Volume: {Math.round(calculateLogVolume(log))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper function to validate if a workout log is complete and valid
const isValidWorkoutLog = (log: WorkoutLog): boolean => {
  // Must have required fields
  if (!log || !log.id || !log.workoutName || !log.completedAt) {
    return false;
  }
  
  // completedAt must be a valid timestamp (positive number)
  if (typeof log.completedAt !== 'number' || log.completedAt <= 0) {
    return false;
  }
  
  // Must have exercises array with at least one exercise
  if (!log.exercises || !Array.isArray(log.exercises) || log.exercises.length === 0) {
    return false;
  }
  
  // Calculate total reps to ensure workout has meaningful data
  let totalReps = 0;
  let hasValidExercise = false;
  
  for (const exercise of log.exercises) {
    if (!exercise || !exercise.exerciseId || !exercise.exerciseName) {
      continue;
    }
    
    if (!exercise.sets || !Array.isArray(exercise.sets) || exercise.sets.length === 0) {
      continue;
    }
    
    // Check if exercise has at least one valid set
    const exerciseHasValidSet = exercise.sets.some(set => 
      set && 
      typeof set.reps === 'number' && 
      set.reps > 0 &&
      typeof set.completedAt === 'number' &&
      set.completedAt > 0
    );
    
    if (exerciseHasValidSet) {
      hasValidExercise = true;
      // Sum up reps for this exercise
      exercise.sets.forEach(set => {
        if (set && typeof set.reps === 'number' && set.reps > 0) {
          totalReps += set.reps;
        }
      });
    }
  }
  
  // Require at least one valid exercise AND meaningful workout data
  // Require at least 1 rep minimum to filter out accidental/incomplete entries
  const hasMinimumReps = totalReps >= 1;
  
  // Must have valid exercise AND at least 1 rep
  return hasValidExercise && hasMinimumReps;
};

// Mobile detection hook
const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    const checkMobile = () => {
      setIsMobile(mediaQuery.matches && hasTouch);
    };

    checkMobile();
    const handleChange = () => checkMobile();
    
    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  return isMobile;
};

// Prominent tile detection hook - finds tile closest to viewport center
const useProminentTile = (
  tileIds: string[],
  isMobile: boolean
): { prominentTileId: string | null; getTileRef: (id: string) => (element: HTMLElement | null) => void } => {
  const [prominentTileId, setProminentTileId] = useState<string | null>(null);
  const tileRefs = useRef<Map<string, HTMLElement>>(new Map());
  const rafRef = useRef<number | null>(null);

  const getTileRef = useCallback((id: string) => {
    return (element: HTMLElement | null) => {
      if (element) {
        element.setAttribute('data-tile-id', id);
        tileRefs.current.set(id, element);
      } else {
        tileRefs.current.delete(id);
      }
    };
  }, []);

  // Calculate which tile is closest to the center of the viewport
  const findCenterTile = useCallback(() => {
    if (!isMobile || tileIds.length === 0) {
      setProminentTileId(null);
      return;
    }

    const viewportCenterY = window.innerHeight / 2;
    const tileIdSet = new Set(tileIds);
    
    let closestId: string | null = null;
    let minDistance = Infinity;

    tileRefs.current.forEach((element, id) => {
      if (!tileIdSet.has(id)) return;
      
      const rect = element.getBoundingClientRect();
      // Calculate the center of the tile
      const tileCenterY = rect.top + rect.height / 2;
      // Calculate distance from tile center to viewport center
      const distance = Math.abs(tileCenterY - viewportCenterY);
      
      // Only consider tiles that are at least partially visible
      const isVisible = rect.bottom > 0 && rect.top < window.innerHeight;
      
      if (isVisible && distance < minDistance) {
        minDistance = distance;
        closestId = id;
      }
    });

    setProminentTileId(closestId);
  }, [isMobile, tileIds]);

  useEffect(() => {
    if (!isMobile || tileIds.length === 0) {
      setProminentTileId(null);
      return;
    }

    // Debounced scroll handler using requestAnimationFrame
    const handleScroll = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(findCenterTile);
    };

    // Initial calculation
    findCenterTile();

    // Listen for scroll events
    window.addEventListener('scroll', handleScroll, { passive: true });
    // Also listen for resize events
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isMobile, tileIds, findCenterTile]);

  return { prominentTileId, getTileRef };
};

// Empty GIF placeholder component
const EmptyGifPlaceholder: React.FC<{ size?: 'small' | 'large' }> = ({ size = 'small' }) => {
  const iconSize = size === 'large' ? 'w-12 h-12' : 'w-8 h-8';
  const textSize = size === 'large' ? 'text-sm' : 'text-[9px]';
  
  return (
    <div className={`w-full h-full flex flex-col items-center justify-center text-gray-800 gap-2`}>
      <svg className={`${iconSize} opacity-20`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span className={`${textSize} font-black uppercase tracking-widest text-center px-4`}>
        {size === 'large' ? 'Technique Clip Awaiting' : 'Technique Coming Soon'}
      </span>
    </div>
  );
};

// Workout Badges Component
interface WorkoutBadgesProps {
  tag: string;
  categoryStyles: { bg: string; text: string };
  variant?: 'default' | 'compact';
}

const WorkoutBadges: React.FC<WorkoutBadgesProps> = ({
  tag,
  categoryStyles,
  variant = 'default',
}) => {
  const paddingClass = variant === 'compact' ? 'px-3 py-1.5' : 'px-3 py-1';
  const roundedClass = variant === 'compact' ? 'rounded-xl' : 'rounded-lg';
  const shadowClass = variant === 'compact' ? 'shadow-lg' : '';
  
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className={`${paddingClass} ${categoryStyles.bg} ${categoryStyles.text} text-[10px] font-black ${roundedClass} uppercase select-none relative z-10 overflow-hidden ${shadowClass}`} style={BADGE_INLINE_STYLES}>
        {tag}
      </span>
    </div>
  );
};

// Header Component
interface HeaderProps {
  onBack: () => void;
  subtitle?: string;
}

const Header: React.FC<HeaderProps> = ({ onBack, subtitle }) => {
  return (
    <header className="max-w-7xl mx-auto mb-8 md:mb-12 flex justify-between items-start">
      <div>
        <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent inline-block transition-all duration-500">
          PulseFit Pro
        </h1>
        {subtitle && <p className="text-gray-500 text-sm mt-2">{subtitle}</p>}
      </div>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
      >
        <svg className="w-6 h-6 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span className="font-bold uppercase tracking-wider text-sm">Back</span>
      </button>
    </header>
  );
};

// Bottom Tab Bar Component
interface BottomTabBarProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const BottomTabBar: React.FC<BottomTabBarProps> = ({ currentTab, onTabChange }) => {
  return (
    <div 
      className="fixed bottom-0 left-0 right-0 bg-[#0d0d0d] border-t border-gray-800 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        <button
          onClick={() => onTabChange('train')}
          className={`flex-1 flex flex-col items-center justify-center py-3 transition-all duration-200 ${
            currentTab === 'train' ? 'text-blue-400' : 'text-gray-500'
          }`}
        >
          <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-wider">Train</span>
        </button>
        <button
          onClick={() => onTabChange('progress')}
          className={`flex-1 flex flex-col items-center justify-center py-3 transition-all duration-200 ${
            currentTab === 'progress' ? 'text-emerald-400' : 'text-gray-500'
          }`}
        >
          <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-wider">Progress</span>
        </button>
      </div>
    </div>
  );
};

// Save Workout Bottom Sheet Component (Mobile)
interface SaveWorkoutBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  workoutNameInput: string;
  setWorkoutNameInput: (value: string) => void;
  onSave: () => void;
  editingWorkoutId: string | null;
  hasChanges: boolean;
}

const SaveWorkoutBottomSheet: React.FC<SaveWorkoutBottomSheetProps> = ({
  isOpen,
  onClose,
  workoutNameInput,
  setWorkoutNameInput,
  onSave,
  editingWorkoutId,
  hasChanges,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Trigger animation after mount
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
      // Focus input after animation starts
      setTimeout(() => {
        inputRef.current?.focus();
        // Scroll input into view when keyboard appears
        inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Bottom Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[60] bg-[#0d0d0d] border-t border-gray-800 rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out ${
          isVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-gray-700 rounded-full" />
        </div>

        <div className="px-6 pb-6 pt-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">
              {editingWorkoutId ? 'Update Workout' : 'Save Workout'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={workoutNameInput}
            onChange={(e) => setWorkoutNameInput(e.target.value)}
            placeholder="Enter workout name..."
            maxLength={50}
            className="w-full px-4 py-4 bg-[#111111] border border-gray-800 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 mb-4 text-base"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSave();
              }
            }}
          />

          <div className="flex gap-3">
            <button
              onClick={onSave}
              disabled={!workoutNameInput.trim() || (editingWorkoutId && !hasChanges)}
              className={`flex-1 px-6 py-4 rounded-2xl text-base font-bold transition-all active:scale-95 ${
                editingWorkoutId && !hasChanges
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-700 disabled:cursor-not-allowed'
              }`}
            >
              {editingWorkoutId ? 'Update' : 'Save'}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-4 bg-gray-700 hover:bg-gray-600 text-white rounded-2xl text-base font-bold transition-all active:scale-95"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// Checkmark Animation Component
interface CheckmarkAnimationProps {
  isVisible: boolean;
  onComplete: () => void;
}

const CheckmarkAnimation: React.FC<CheckmarkAnimationProps> = ({ isVisible, onComplete }) => {
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    if (isVisible) {
      // Show checkmark after a brief delay
      setTimeout(() => setShowCheckmark(true), 100);
      // Show text after checkmark appears
      setTimeout(() => setShowText(true), 400);
      // Complete animation after 1.5 seconds
      const timer = setTimeout(() => {
        onComplete();
      }, 1500);
      return () => {
        clearTimeout(timer);
        setShowCheckmark(false);
        setShowText(false);
      };
    }
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 md:bg-black/80 backdrop-blur-sm md:backdrop-blur-md transition-opacity duration-300"
      style={{
        // Ensure it appears above all modals on mobile
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'none', // Prevent any touch interactions during animation
      }}
    >
      <div className="relative flex flex-col items-center px-4">
        {/* Animated circle background */}
        <div 
          className={`w-28 h-28 md:w-32 md:h-32 rounded-full bg-green-500 flex items-center justify-center transition-all duration-500 shadow-2xl ${
            showCheckmark ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
          }`}
          style={{
            transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: '0 20px 60px rgba(34, 197, 94, 0.4)'
          }}
        >
          {/* Checkmark SVG */}
          <svg
            className={`w-14 h-14 md:w-16 md:h-16 text-white transition-all duration-300 ${
              showCheckmark ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
            style={{
              transitionDelay: showCheckmark ? '0.2s' : '0s'
            }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        {/* Success text */}
        <p 
          className={`text-white text-xl md:text-2xl font-bold mt-8 md:mt-6 text-center transition-all duration-400 ${
            showText ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          Saved!
        </p>
      </div>
    </div>
  );
};

// Workout Detail Modal Component
interface WorkoutDetailModalProps {
  workout: Workout;
  onClose: () => void;
  getCategoryStyles: (category: Category) => { gradient: string; border: string; text: string; bg: string };
}

const WorkoutDetailModal: React.FC<WorkoutDetailModalProps> = ({ workout, onClose, getCategoryStyles }) => {
  const styles = getCategoryStyles(workout.category);
  
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 backdrop-blur-3xl transition-all p-0 md:p-6">
      <div className={`bg-[#0d0d0d] border-t md:border border-gray-800 w-full h-full md:h-auto md:w-auto md:max-w-6xl md:rounded-[3rem] overflow-hidden shadow-2xl relative md:max-h-[90vh] flex flex-col mx-auto`}>
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 md:top-6 md:right-6 z-20 p-2.5 md:p-4 bg-black/60 hover:bg-gray-800 rounded-full transition-colors text-white border border-gray-800 shadow-xl"
        >
          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex flex-col lg:flex-row overflow-y-auto flex-1">
          <div className="lg:w-3/5 bg-black flex flex-col items-center justify-center relative p-3 md:p-12 flex-1 min-h-[50vh] md:min-h-[400px] lg:min-h-[600px]">
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${styles.gradient}`}></div>
            
            <div className="relative w-full h-full flex items-center justify-center">
              {workout.gifUrl ? (
                <img 
                  src={workout.gifUrl} 
                  alt={workout.name}
                  className="max-w-full max-h-[60vh] md:max-h-[500px] lg:max-h-[700px] object-contain rounded-xl md:rounded-[2.5rem] shadow-[0_20px_100px_rgba(0,0,0,0.9)] border border-gray-800/50 mx-auto"
                />
              ) : (
                <div className="text-center p-4 md:p-12 bg-gray-900/20 rounded-xl md:rounded-[3rem] border-2 border-dashed border-gray-800/40 w-full max-w-md mx-auto">
                  <EmptyGifPlaceholder size="large" />
                </div>
              )}
            </div>
          </div>

          <div className="lg:w-2/5 p-3 md:p-8 lg:p-16 flex flex-col bg-[#111111] border-t lg:border-t-0 lg:border-l border-gray-800/50 mx-auto w-full max-w-full">
            <div className="mb-4 md:mb-12">
              <div className="flex items-center gap-2 md:gap-4 mb-3 md:mb-6">
                <span className={`w-2 h-2 md:w-3 md:h-3 rounded-full bg-gradient-to-br ${styles.gradient} shadow-[0_0_15px_rgba(0,0,0,0.5)]`} />
                <span className={`text-[9px] md:text-xs font-black ${styles.text} uppercase tracking-[0.3em]`}>
                  {workout.tag}
                </span>
              </div>
              <h2 className="text-2xl md:text-5xl font-black mb-3 md:mb-6 leading-tight md:leading-none tracking-tighter">{workout.name}</h2>
              <p className="text-gray-400 text-xs md:text-base leading-relaxed font-medium">{workout.description}</p>
            </div>

            <div className="mb-4 md:mb-12">
              <h4 className={`text-[9px] md:text-xs font-black ${styles.text} uppercase tracking-[0.3em] mb-3 md:mb-6 border-b border-gray-800/50 pb-2 md:pb-4`}>
                TARGET MUSCLES
              </h4>
              <div className="flex flex-wrap gap-1.5 md:gap-3">
                {workout.targetMuscles.map(m => (
                  <span key={m} className="px-2.5 py-1 md:px-5 md:py-2.5 bg-black/40 text-gray-400 text-[8px] md:text-[10px] font-black rounded-md md:rounded-xl border border-gray-800 uppercase tracking-tight">
                    {m}
                  </span>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

// Workout List Card Component
interface WorkoutListCardProps {
  workout: Workout;
  onClick: (workout: Workout) => void;
  getCategoryStyles: (category: Category) => { gradient: string; border: string; text: string; bg: string };
  isProminent?: boolean;
  getTileRef?: (id: string) => (element: HTMLElement | null) => void;
  showViewButton?: boolean;
}

const WorkoutListCard: React.FC<WorkoutListCardProps> = ({
  workout,
  onClick,
  getCategoryStyles,
  isProminent = false,
  getTileRef,
  showViewButton = true,
}) => {
  const styles = getCategoryStyles(workout.category);
  
  return (
    <div 
      ref={getTileRef ? getTileRef(workout.id) : undefined}
      className="group bg-[#111111] border border-gray-800 rounded-2xl overflow-hidden flex flex-col md:flex-row gap-4 p-4 hover:border-gray-700 hover:shadow-2xl hover:shadow-black/60 cursor-pointer active:scale-[0.98] scale-100"
      style={{
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s ease, box-shadow 0.3s ease',
      }}
      onClick={() => onClick(workout)}
    >
      <div className="w-full md:w-48 h-48 bg-black/40 overflow-hidden rounded-xl flex-shrink-0">
        {workout.gifUrl ? (
          <img 
            src={workout.gifUrl} 
            alt={workout.name}
            className="w-full h-full object-cover group-hover:opacity-100 transition-opacity duration-300 opacity-60"
            loading="lazy"
          />
        ) : (
          <EmptyGifPlaceholder />
        )}
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <WorkoutBadges
          tag={workout.tag}
          categoryStyles={styles}
        />
        <h3 className="text-xl font-bold mb-3 transition-colors duration-300 select-none group-hover:text-white">{workout.name}</h3>
        <p className="text-gray-400 text-sm mb-4 select-none">{workout.description}</p>
        <div className="flex flex-wrap gap-2 mt-1">
          {workout.targetMuscles.map(m => (
            <span key={m} className="px-3 py-1 bg-black/40 text-gray-400 text-[10px] font-black rounded-lg border border-gray-800 uppercase select-none">
              {m}
            </span>
          ))}
        </div>
      </div>
      {showViewButton && (
        <div className="flex items-center md:pr-4">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClick(workout);
            }}
            className="px-6 py-3 bg-gray-50 text-gray-800 text-[10px] font-black rounded-xl transition-all shadow-md hover:shadow-lg hover:bg-gray-100 active:scale-95 uppercase tracking-widest whitespace-nowrap"
          >
            View
          </button>
        </div>
      )}
    </div>
  );
};

// Floating Action Button Component
interface FloatingActionButtonProps {
  count: number;
  onClick: () => void;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ count, onClick }) => {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-40 w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-orange-500 to-red-500 rounded-full shadow-2xl hover:shadow-orange-500/50 transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center group"
      aria-label={`View routine (${count} ${count === 1 ? 'workout' : 'workouts'})`}
    >
      <svg className="w-8 h-8 md:w-10 md:h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-2 -right-2 bg-white text-black text-xs font-black rounded-full w-6 h-6 flex items-center justify-center shadow-lg border-2 border-[#0a0a0a]">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
};

// Workout selection item - unified type for predefined or saved
type WorkoutSelectionItem = { id: string; name: string; workouts: Workout[]; category?: Category };

// Workout Mode Selection Component
interface WorkoutModeSelectionProps {
  predefinedWorkouts: PredefinedWorkout[];
  savedWorkouts: SavedWorkout[];
  onSelectWorkout: (item: WorkoutSelectionItem) => void;
  onBack: () => void;
  getCategoryStyles: (category: Category) => { gradient: string; border: string; text: string; bg: string };
}

const WorkoutModeSelection: React.FC<WorkoutModeSelectionProps> = ({
  predefinedWorkouts,
  savedWorkouts,
  onSelectWorkout,
  onBack,
  getCategoryStyles,
}) => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 pb-24 md:p-12 selection:bg-blue-500/30">
      <Header onBack={onBack} subtitle="Choose a routine to follow" />

      <main className="max-w-4xl mx-auto">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Default Workouts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {predefinedWorkouts.map((workout) => {
            const styles = getCategoryStyles(workout.category);
            return (
              <button
                key={workout.id}
                onClick={() => onSelectWorkout(workout)}
                className="group relative bg-[#111111] border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] text-left overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${styles.gradient} opacity-5 group-hover:opacity-10 transition-opacity`} />
                <div className="relative">
                  <span className={`inline-block px-3 py-1 ${styles.bg} text-[10px] font-black rounded-lg uppercase mb-3`}>
                    {workout.name}
                  </span>
                  <h3 className="text-xl font-bold mb-2 group-hover:text-white transition-colors">{workout.name}</h3>
                  <p className="text-gray-500 text-sm">
                    {workout.workouts.length} {workout.workouts.length === 1 ? 'exercise' : 'exercises'}
                  </p>
                </div>
                <div className="absolute top-4 right-4 opacity-40 group-hover:opacity-80">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>

        {savedWorkouts.length > 0 && (
          <>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Your Routines</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedWorkouts.map((workout) => (
                <button
                  key={workout.id}
                  onClick={() => onSelectWorkout({ id: workout.id, name: workout.name, workouts: workout.workouts })}
                  className="group relative bg-[#111111] border border-gray-800 rounded-2xl p-6 hover:border-purple-500/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] text-left overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 opacity-5 group-hover:opacity-10 transition-opacity" />
                  <div className="relative">
                    <span className="inline-block px-3 py-1 bg-purple-600 text-[10px] font-black rounded-lg uppercase mb-3">
                      Custom
                    </span>
                    <h3 className="text-xl font-bold mb-2 group-hover:text-white transition-colors">{workout.name}</h3>
                    <p className="text-gray-500 text-sm">
                      {workout.workouts.length} {workout.workouts.length === 1 ? 'exercise' : 'exercises'}
                    </p>
                  </div>
                  <div className="absolute top-4 right-4 opacity-40 group-hover:opacity-80">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {savedWorkouts.length === 0 && (
          <p className="text-gray-600 text-sm text-center py-8">Create custom routines in the workout builder to see them here.</p>
        )}
      </main>
    </div>
  );
};

// Train Landing Page Component
interface TrainLandingPageProps {
  lastWorkout: WorkoutSelectionItem | null;
  onStartWorkout: () => void;
  onRepeatLastWorkout: () => void;
  onCreateWorkout: () => void;
  onManageWorkouts: () => void;
}

const TrainLandingPage: React.FC<TrainLandingPageProps> = ({
  lastWorkout,
  onStartWorkout,
  onRepeatLastWorkout,
  onCreateWorkout,
  onManageWorkouts,
}) => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 pb-24 selection:bg-blue-500/30">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8 mt-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent mb-3">
            Begin workout
          </h1>
          <p className="text-gray-500 text-base">Pick a session and begin.</p>
        </div>

        <div className="space-y-4 mb-8">
          {/* Primary Action: Start Workout */}
          <button
            onClick={onStartWorkout}
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 text-white font-bold py-6 px-8 rounded-3xl shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xl">Start Workout</span>
          </button>

          {/* Repeat Last Workout Button */}
          {lastWorkout && (
            <button
              onClick={onRepeatLastWorkout}
              className="w-full bg-[#111111] border-2 border-emerald-500/50 hover:border-emerald-500 text-white font-bold py-5 px-8 rounded-3xl shadow-lg hover:shadow-emerald-500/20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <div className="text-left">
                    <div className="text-sm text-gray-400 uppercase tracking-wider">Repeat Latest</div>
                    <div className="text-base font-bold">{lastWorkout.name}</div>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onCreateWorkout}
            className="bg-[#111111] border border-gray-800 hover:border-orange-500/50 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] flex flex-col items-center gap-2"
          >
            <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm">Create Workout</span>
          </button>
          <button
            onClick={onManageWorkouts}
            className="bg-[#111111] border border-gray-800 hover:border-purple-500/50 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] flex flex-col items-center gap-2"
          >
            <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <span className="text-sm">My Workouts</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Progress Page Component
interface ProgressPageProps {
  workoutLogs: WorkoutLog[];
  historyViewMode: 'calendar' | 'last7days';
  setHistoryViewMode: (mode: 'calendar' | 'last7days') => void;
  selectedHistoryMetric: 'volume' | 'reps';
  setSelectedHistoryMetric: (metric: 'volume' | 'reps') => void;
  historyVolumeData: TimeSeriesPoint[];
  historyRepsData: TimeSeriesPoint[];
  historyPeriod: 'day' | 'week' | 'month';
  calendarSelectedDate: Date | undefined;
  setCalendarSelectedDate: (date: Date | undefined) => void;
  selectedWorkoutLog: WorkoutLog | null;
  setSelectedWorkoutLog: (log: WorkoutLog | null) => void;
  onClearAllWorkoutLogs: () => void;
}

const ProgressPage: React.FC<ProgressPageProps> = ({
  workoutLogs,
  historyViewMode,
  setHistoryViewMode,
  selectedHistoryMetric,
  setSelectedHistoryMetric,
  historyVolumeData,
  historyRepsData,
  historyPeriod,
  calendarSelectedDate,
  setCalendarSelectedDate,
  selectedWorkoutLog,
  setSelectedWorkoutLog,
  onClearAllWorkoutLogs,
}) => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 pb-24 selection:bg-blue-500/30">
      <div className="max-w-6xl mx-auto pt-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent mb-3">
            Progress
          </h1>
          <p className="text-gray-500 text-base">Track your fitness journey</p>
        </div>

        <main className="space-y-6">
          {workoutLogs.length === 0 ? (
            <div className="text-center py-16 bg-[#111111] border border-gray-800 rounded-2xl">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3M4 11h16M5 21h14a2 2 0 002-2V7H3v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-400 text-lg mb-2">No workout history yet</p>
              <p className="text-gray-500 text-sm mb-6">Complete a workout to start tracking your progress.</p>
            </div>
          ) : (
            <>
              {/* Navigation Tabs */}
              <div className="flex gap-3 mb-6">
                <button
                  onClick={() => setHistoryViewMode('last7days')}
                  className={`flex-1 px-6 py-3 rounded-2xl font-bold text-sm transition-all duration-200 ${
                    historyViewMode === 'last7days'
                      ? 'bg-white text-black shadow-lg shadow-white/20'
                      : 'bg-[#111111] border border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-300'
                  }`}
                >
                  Last 7 Days
                </button>
                <button
                  onClick={() => setHistoryViewMode('calendar')}
                  className={`flex-1 px-6 py-3 rounded-2xl font-bold text-sm transition-all duration-200 ${
                    historyViewMode === 'calendar'
                      ? 'bg-white text-black shadow-lg shadow-white/20'
                      : 'bg-[#111111] border border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-300'
                  }`}
                >
                  Calendar
                </button>
              </div>

              {/* Last 7 Days View */}
              {historyViewMode === 'last7days' && (
                <>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <h2 className="text-2xl md:text-3xl font-bold">Workout Trends</h2>
                      <p className="text-sm text-gray-500">Last 7 days</p>
                    </div>
                    <button
                      onClick={onClearAllWorkoutLogs}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-xs uppercase tracking-wider rounded-xl text-white"
                    >
                      Clear Data
                    </button>
                  </div>

                  <div className="space-y-4">
                    <TimeSeriesChart
                      title={selectedHistoryMetric === 'volume' ? 'Volume' : 'Reps'}
                      yAxisLabel={selectedHistoryMetric === 'volume' ? 'Total volume' : 'Total reps'}
                      colorClassName="from-emerald-500 to-emerald-400"
                      metric={selectedHistoryMetric}
                      data={
                        selectedHistoryMetric === 'volume'
                          ? historyVolumeData
                          : historyRepsData
                      }
                      onPointSelect={(date) => {
                        setHistoryViewMode('calendar');
                        setCalendarSelectedDate(date);
                      }}
                      width={800}
                      height={400}
                      period={historyPeriod}
                    />
                    
                    <div className="flex gap-2 md:gap-3 justify-center flex-wrap">
                      <button
                        onClick={() => setSelectedHistoryMetric('volume')}
                        className={`px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-semibold text-xs md:text-sm transition-all duration-200 flex-1 md:flex-none min-w-[80px] md:min-w-0 ${
                          selectedHistoryMetric === 'volume'
                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow-lg shadow-emerald-500/30'
                            : 'bg-[#111111] border border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-300'
                        }`}
                      >
                        Volume
                      </button>
                      <button
                        onClick={() => setSelectedHistoryMetric('reps')}
                        className={`px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-semibold text-xs md:text-sm transition-all duration-200 flex-1 md:flex-none min-w-[80px] md:min-w-0 ${
                          selectedHistoryMetric === 'reps'
                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow-lg shadow-emerald-500/30'
                            : 'bg-[#111111] border border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-300'
                        }`}
                      >
                        Reps
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Calendar View */}
              {historyViewMode === 'calendar' && (
                <>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-6">
                    <div>
                      <h2 className="text-2xl md:text-3xl font-bold">Calendar</h2>
                      <p className="text-sm text-gray-500">View workouts by date</p>
                    </div>
                    <button
                      onClick={onClearAllWorkoutLogs}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-xs uppercase tracking-wider rounded-xl text-white"
                    >
                      Clear Data
                    </button>
                  </div>
                  <div className="bg-[#111111] border border-gray-800 rounded-2xl overflow-hidden">
                    <CalendarView
                      isOpen={true}
                      onClose={() => {}}
                      workoutLogs={workoutLogs}
                      selectedDate={calendarSelectedDate}
                      onSelectLog={(log) => {
                        setSelectedWorkoutLog(log);
                      }}
                      inline={true}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </main>

        {selectedWorkoutLog && (
          <WorkoutLogDetailModal
            log={selectedWorkoutLog}
            onClose={() => setSelectedWorkoutLog(null)}
          />
        )}
      </div>
    </div>
  );
};

// Exercise Card for Workout Carousel - Flashcard style
interface ExerciseCardProps {
  workout: Workout;
  index: number;
  total: number;
  isCompleted: boolean;
  isCurrentCard: boolean;
  isJustCompleted: boolean;
  isAnimatingOut: boolean;
  onMarkComplete: () => void;
  trackingState: ExerciseTrackingState;
  onUpdateQuick: (field: 'quickSets' | 'quickReps' | 'quickWeight', value: string) => void;
  onToggleMode: () => void;
  onAddSet: () => void;
  onUpdateSet: (setId: string, field: 'weight' | 'reps', value: string) => void;
  onRemoveSet: (setId: string) => void;
  getCategoryStyles: (category: Category) => { gradient: string; border: string; text: string; bg: string };
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({
  workout,
  index,
  total,
  isCompleted,
  isCurrentCard,
  isJustCompleted,
  isAnimatingOut,
  onMarkComplete,
  trackingState,
  onUpdateQuick,
  onToggleMode,
  onAddSet,
  onUpdateSet,
  onRemoveSet,
  getCategoryStyles,
}) => {
  const styles = getCategoryStyles(workout.category);
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = (e: React.MouseEvent) => {
    // Prevent flipping when clicking on interactive elements
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'BUTTON' ||
      target.closest('button') ||
      target.closest('input')
    ) {
      return;
    }
    setIsFlipped(!isFlipped);
  };

  return (
    <div className="w-full flex-shrink-0 flex items-center justify-center p-0 md:p-6" style={{ perspective: '1000px', maxHeight: '100%', minHeight: 0 }}>
      <div
        className={`relative w-full max-w-md rounded-[1.5rem] md:rounded-[1.75rem] shadow-2xl transition-all duration-500 ease-in ${
          isJustCompleted && isCurrentCard ? 'ring-2 ring-green-500/30' : ''
        }`}
        style={{
          transform: isAnimatingOut
            ? 'scale(0.6) rotateY(-20deg) translateZ(-300px) translateY(20px)'
            : 'scale(1) rotateY(0deg) translateZ(0px) translateY(0px)',
          opacity: isAnimatingOut ? 0 : 1,
          transformStyle: 'preserve-3d',
          filter: isAnimatingOut ? 'blur(4px)' : 'blur(0px)',
          zIndex: isAnimatingOut ? 0 : 1,
        }}
      >
        <div
          className="relative w-full h-full"
          style={{
            transformStyle: 'preserve-3d',
            transition: 'transform 0.6s',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front of card - Exercise details */}
          <div
            className="w-full h-full relative"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'translateZ(0)',
            }}
          >
            <div
              className={`w-full h-full rounded-[1.5rem] md:rounded-[1.75rem] overflow-hidden bg-[#151515] border flex flex-col relative ${
                isJustCompleted && isCurrentCard ? 'border-green-500/40' : 'border-gray-800/80'
              }`}
            >
              {/* Category accent bar */}
              <div className={`h-1 w-full bg-gradient-to-r ${styles.gradient} flex-shrink-0`} />

              {isJustCompleted && isCurrentCard && (
                <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center backdrop-blur-[2px] transition-opacity duration-300 z-50 rounded-[1.5rem] md:rounded-[1.75rem]">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-green-500 flex items-center justify-center shadow-2xl shadow-green-500/50 animate-pulse">
                    <svg className="w-12 h-12 md:w-14 md:h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}

              <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative" onClick={handleFlip}>
                {/* Tap to view bar */}
                <div className="flex-shrink-0 cursor-pointer">
                  <div className="w-full relative overflow-hidden h-11">
                    {/* Animated gradient background */}
                    <div className={`absolute inset-0 bg-gradient-to-r ${styles.gradient} opacity-20`}></div>
                    <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent"></div>
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 overflow-hidden">
                      <div 
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                        style={{ animation: 'shimmer 2s infinite linear' }}
                      ></div>
                    </div>
                    
                    {/* "Tap to view" label */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span className="text-white/90 text-xs font-semibold uppercase tracking-wider">Tap to view</span>
                      </div>
                    </div>
                    
                    {/* Bottom border accent */}
                    <div className={`absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r ${styles.gradient}`}></div>
                  </div>
                </div>

                {/* Content area - flashcard back */}
                <div 
                  className="p-4 md:p-6 pb-6 md:pb-6 flex flex-col gap-2 md:gap-5 flex-1 min-h-0 overflow-hidden"
                  style={{ 
                    WebkitOverflowScrolling: 'touch',
                    overscrollBehaviorY: 'contain'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
            <div>
              <span className={`inline-block px-2 py-0.5 md:px-2.5 md:py-1 ${styles.bg} text-[9px] md:text-[10px] font-black rounded-lg uppercase tracking-wider mb-1.5 md:mb-3`}>
                {workout.tag}
              </span>
              <h3 className="text-lg md:text-2xl font-bold leading-tight mb-1.5 md:mb-2">{workout.name}</h3>
            </div>
            <p className="text-gray-400 text-[10px] md:text-sm leading-relaxed line-clamp-1 md:line-clamp-2 mb-1.5 md:mb-2">{workout.description}</p>
            <div className="flex flex-wrap gap-1.5 md:gap-2 mb-2 md:mb-3">
              {workout.targetMuscles.map((m) => (
                <span key={m} className="px-2 py-0.5 md:px-2.5 md:py-1 bg-gray-800/60 text-gray-400 text-[9px] md:text-[10px] font-bold rounded-md">
                  {m}
                </span>
              ))}
            </div>
            <div className="bg-[#0f0f0f] border border-gray-800/60 rounded-xl p-4 min-h-0 flex flex-col">
              <div className="mb-4 flex-shrink-0">
                <span className="text-[10px] md:text-xs text-gray-400 uppercase tracking-widest font-bold">
                  Track Sets
                </span>
              </div>

              {/* Scrollable sets grid container */}
              <div className="relative min-h-0 flex flex-col">
                {/* Top fade gradient */}
                <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-[#0f0f0f] to-transparent pointer-events-none z-10 rounded-t-lg"></div>
                
                {/* Scrollable area - stopPropagation so carousel never sees touches; explicit h for iOS scroll; min-h-0 + isolate so nested scroll works */}
                <div 
                  data-scrollable-panel="true"
                  className="min-h-0 h-[180px] sm:h-[220px] md:h-[300px] overflow-y-auto overflow-x-hidden space-y-2 pr-1 overscroll-contain relative z-[1]"
                  style={{ 
                    WebkitOverflowScrolling: 'touch',
                    touchAction: 'pan-y',
                    overscrollBehaviorY: 'contain',
                  }}
                  onTouchMove={(e) => {
                    // Stop propagation for vertical movements to prevent carousel from twitching
                    const touch = e.touches[0];
                    if (touchStart) {
                      const dx = Math.abs(touch.clientX - touchStart.x);
                      const dy = Math.abs(touch.clientY - touchStart.y);
                      if (dy > dx) {
                        e.stopPropagation();
                      }
                    }
                  }}
                >
                  <div className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 text-[9px] md:text-[10px] text-gray-500 uppercase font-bold px-2 pb-1 sticky top-0 bg-[#0f0f0f] z-0 pt-2">
                    <span className="text-center">SET</span>
                    <span className="text-center">LBS</span>
                    <span className="text-center">REPS</span>
                    <span></span>
                  </div>
                  {trackingState.sets.map((set, idx) => {
                    const isEmptyWeight = set.weight === '';
                    const isEmptyReps = set.reps === '';
                    return (
                      <div
                        key={set.id}
                        className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 items-center bg-[#121212] border border-gray-800 rounded-lg px-2 py-2"
                      >
                        <span className="text-sm md:text-base text-white font-bold text-center">{idx + 1}</span>
                        <input
                          type="number"
                          min={0}
                          inputMode="decimal"
                          value={set.weight}
                          onChange={(e) => onUpdateSet(set.id, 'weight', e.target.value)}
                          className={`w-full px-2 py-2 bg-[#151515] border border-gray-800 rounded-md text-xs md:text-sm focus:outline-none focus:border-gray-600 text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-moz-appearance]:textfield placeholder:text-gray-500 focus:placeholder:opacity-0 ${
                            isEmptyWeight ? 'text-gray-500' : 'text-white'
                          }`}
                          placeholder="0"
                        />
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={set.reps}
                          onChange={(e) => onUpdateSet(set.id, 'reps', e.target.value)}
                          className={`w-full px-2 py-2 bg-[#151515] border border-gray-800 rounded-md text-xs md:text-sm focus:outline-none focus:border-gray-600 text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-moz-appearance]:textfield placeholder:text-gray-500 focus:placeholder:opacity-0 ${
                            isEmptyReps ? 'text-gray-500' : 'text-white'
                          }`}
                          placeholder="0"
                        />
                        <button
                          onClick={() => onRemoveSet(set.id)}
                          className="p-1.5 text-gray-500 hover:text-red-400 transition-colors w-8 h-8 flex items-center justify-center"
                          aria-label="Remove set"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
                
                {/* Bottom fade gradient */}
                <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#0f0f0f] to-transparent pointer-events-none z-10 rounded-b-lg"></div>
              </div>

              {/* Add Set button - outside scrollable area */}
              <button
                onClick={onAddSet}
                className="w-full mt-3 py-2.5 bg-gray-800/70 hover:bg-gray-700/70 text-gray-100 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Set
              </button>
            </div>
                  <button
                    onClick={onMarkComplete}
                    className={`mt-4 md:mt-6 w-full py-3 md:py-4 rounded-xl text-sm md:text-base font-bold transition-all duration-200 active:scale-[0.98] flex-shrink-0 ${
                      isJustCompleted
                        ? 'bg-green-600 text-white cursor-default'
                        : isCompleted
                        ? 'bg-gray-500/50 text-gray-300 cursor-default'
                        : 'bg-white text-black hover:bg-gray-100 shadow-lg'
                    }`}
                  >
                    {isCompleted ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Done
                      </span>
                    ) : (
                      'Mark Complete'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Back of card - GIF view */}
          <div
            className="absolute inset-0 w-full"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <div
              className={`w-full h-full rounded-[1.5rem] md:rounded-[1.75rem] overflow-hidden bg-[#151515] border flex flex-col ${
                isJustCompleted && isCurrentCard ? 'border-green-500/40' : 'border-gray-800/80'
              }`}
              onClick={handleFlip}
            >
              {/* Category accent bar */}
              <div className={`h-1 w-full bg-gradient-to-r ${styles.gradient} flex-shrink-0`} />

              {/* GIF display */}
              <div className="flex-1 flex flex-col items-center justify-center p-4 bg-black/80 relative cursor-pointer">
                {workout.gifUrl ? (
                  <img
                    src={workout.gifUrl}
                    alt={workout.name}
                    className="max-w-full max-h-full object-contain rounded-lg"
                    loading="lazy"
                  />
                ) : (
                  <EmptyGifPlaceholder size="large" />
                )}
                
                {/* Tap to close hint */}
                <div className="absolute bottom-6 left-0 right-0 text-center">
                  <span className="text-white/50 text-xs uppercase tracking-wider">tap anywhere to close</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Workout Carousel Component
interface WorkoutCarouselProps {
  workoutName: string;
  workouts: Workout[];
  completedExercises: Set<string>;
  trackingByExercise: Record<string, ExerciseTrackingState>;
  onUpdateQuick: (workoutId: string, field: 'quickSets' | 'quickReps' | 'quickWeight', value: string) => void;
  onToggleMode: (workoutId: string) => void;
  onAddSet: (workoutId: string) => void;
  onUpdateSet: (workoutId: string, setId: string, field: 'weight' | 'reps', value: string) => void;
  onRemoveSet: (workoutId: string, setId: string) => void;
  onMarkComplete: (workoutId: string, isLastExercise?: boolean) => void;
  onBack: () => void;
  getCategoryStyles: (category: Category) => { gradient: string; border: string; text: string; bg: string };
  isMobile: boolean;
}

const SWIPE_THRESHOLD = 50;

const WorkoutCarousel: React.FC<WorkoutCarouselProps> = ({
  workoutName,
  workouts,
  completedExercises,
  trackingByExercise,
  onUpdateQuick,
  onToggleMode,
  onAddSet,
  onUpdateSet,
  onRemoveSet,
  onMarkComplete,
  onBack,
  getCategoryStyles,
  isMobile,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [touchInScrollPanel, setTouchInScrollPanel] = useState(false);
  const [animatingOutId, setAnimatingOutId] = useState<string | null>(null);
  const [justCompletedIds, setJustCompletedIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const total = workouts.length;
  const completedCount = completedExercises.size;
  const allComplete = total > 0 && completedCount === total;

  const goNext = useCallback(() => {
    if (currentIndex < total - 1) {
      // Clear just completed state when navigating away
      const currentWorkoutId = workouts[currentIndex]?.id;
      if (currentWorkoutId) {
        setJustCompletedIds((prev) => {
          const next = new Set(prev);
          next.delete(currentWorkoutId);
          return next;
        });
      }
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, total, workouts]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      // Clear just completed state when navigating away
      const currentWorkoutId = workouts[currentIndex]?.id;
      if (currentWorkoutId) {
        setJustCompletedIds((prev) => {
          const next = new Set(prev);
          next.delete(currentWorkoutId);
          return next;
        });
      }
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex, workouts]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goPrev, goNext]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    const inScrollPanel = !!target.closest('[data-scrollable-panel="true"]');
    setTouchInScrollPanel(inScrollPanel);
    setTouchStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    });
    setTouchDelta(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    
    const deltaX = e.touches[0].clientX - touchStart.x;
    const deltaY = e.touches[0].clientY - touchStart.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // If touch started inside the track sets scroll panel
    if (touchInScrollPanel) {
      // If we are moving more vertically than horizontally, 
      // strictly disable carousel movement to allow nested scroll
      if (absDeltaY > absDeltaX) {
        setTouchDelta(0);
        return;
      }
      
      // If we are swiping horizontally, allow the carousel to move
      if (absDeltaX > SWIPE_THRESHOLD / 2) {
        setTouchDelta(deltaX);
      } else {
        setTouchDelta(0);
      }
      return;
    }

    const target = e.target as HTMLElement;
    const scrollableElement = target.closest('[data-scrollable-panel="true"], [class*="overflow-y-auto"], [class*="overflow-y-scroll"]');

    // If we're on a scrollable element and moving more vertically than horizontally,
    // let the native scroll handle it and don't move the carousel
    if (scrollableElement && absDeltaY > absDeltaX) {
      setTouchDelta(0);
      return;
    }

    setTouchDelta(deltaX);
  };

  const handleTouchEnd = () => {
    if (touchStart === null) return;
    if (touchInScrollPanel) {
      setTouchStart(null);
      setTouchDelta(0);
      setTouchInScrollPanel(false);
      return;
    }
    if (touchDelta < -SWIPE_THRESHOLD) goNext();
    else if (touchDelta > SWIPE_THRESHOLD) goPrev();
    setTouchStart(null);
    setTouchDelta(0);
    setTouchInScrollPanel(false);
  };

  const progressPercent = total > 0 ? (completedCount / total) * 100 : 0;

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-[#0c0c0c] to-[#0a0a0a] text-white selection:bg-blue-500/30">
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
        >
          <svg className="w-6 h-6 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-bold uppercase tracking-wider text-sm">Back</span>
        </button>
        <div className="flex flex-col items-center flex-1 min-w-0">
          <h1 className="text-base font-bold truncate w-full text-center max-w-[200px] md:max-w-sm">{workoutName}</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {completedCount} of {total} complete
          </p>
        </div>
        <div className="w-16" />
      </header>

      <div className="flex-1 min-h-0 relative overflow-hidden flex items-center" style={{ perspective: '1000px' }}>
        <div
          ref={containerRef}
          className="h-full w-full flex transition-transform duration-300 ease-out"
          style={{
            transform: `translateX(calc(-${currentIndex * 100}% + ${touchDelta}px))`,
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {workouts.map((workout, idx) => {
            const isCurrentCard = idx === currentIndex;
            const isAnimatingOut = animatingOutId === workout.id;
            
            return (
              <div key={workout.id} className="w-full flex-shrink-0 h-full flex items-start md:items-center justify-center px-3 py-4 md:p-0 overflow-hidden">
                <ExerciseCard
                  workout={workout}
                  index={idx}
                  total={total}
                  isCompleted={completedExercises.has(workout.id)}
                  isCurrentCard={isCurrentCard}
                  isAnimatingOut={isAnimatingOut}
                  trackingState={trackingByExercise[workout.id] || createDefaultTrackingState()}
                  onUpdateQuick={(field, value) => onUpdateQuick(workout.id, field, value)}
                  onToggleMode={() => onToggleMode(workout.id)}
                  onAddSet={() => onAddSet(workout.id)}
                  onUpdateSet={(setId, field, value) => onUpdateSet(workout.id, setId, field, value)}
                  onRemoveSet={(setId) => onRemoveSet(workout.id, setId)}
                  onMarkComplete={() => {
                    if (isCurrentCard && !isAnimatingOut) {
                      const isAlreadyCompleted = completedExercises.has(workout.id);
                      const isLastExercise = currentIndex === total - 1;
                      
                      // Always call onMarkComplete to update the log with current data
                      // Pass isLastExercise flag so summary only triggers on last tile
                      onMarkComplete(workout.id, isLastExercise);
                      
                      // If it's the last exercise, skip animation and go straight to summary
                      if (isLastExercise) {
                        // Summary will be triggered by handleCompleteExercise
                        // No card flip animation needed
                        return;
                      }
                      
                      // For non-final tiles: do card flip animation
                      setAnimatingOutId(workout.id);
                      
                      // Only add to justCompletedIds if not already completed (to show green animation)
                      // If already completed (editing), just do the flip without green checkmark
                      if (!isAlreadyCompleted) {
                        setJustCompletedIds((prev) => new Set(prev).add(workout.id));
                      }
                      
                      // Card flip animation for non-final tiles
                      setTimeout(() => {
                        setAnimatingOutId(null);
                        goNext();
                      }, 500);
                    }
                  }}
                  isJustCompleted={justCompletedIds.has(workout.id)}
                  getCategoryStyles={getCategoryStyles}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-shrink-0 p-3 pb-4 md:p-4 md:pb-6">
        {/* Flashcard dots */}
        <div className="flex justify-center gap-1.5 mb-4">
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              onClick={() => {
                // Clear just completed state when navigating away
                const currentWorkoutId = workouts[currentIndex]?.id;
                if (currentWorkoutId) {
                  setJustCompletedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(currentWorkoutId);
                    return next;
                  });
                }
                setCurrentIndex(i);
              }}
              className={`rounded-full transition-all duration-200 ${
                i === currentIndex
                  ? 'w-6 h-2 bg-white'
                  : 'w-2 h-2' +
                    (completedExercises.has(workouts[i].id) ? ' bg-green-500/70 hover:bg-green-500' : ' bg-gray-600 hover:bg-gray-500')
              }`}
              aria-label={`Go to exercise ${i + 1}`}
            />
          ))}
        </div>
        <div className="max-w-sm mx-auto flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-gray-800/50"
            aria-label="Previous card"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-xs text-gray-500">Tap to navigate</span>
          <button
            onClick={goNext}
            disabled={currentIndex === total - 1}
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-gray-800/50"
            aria-label="Next card"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

// Workout Completion Celebration Component
interface WorkoutCompletionCelebrationProps {
  workoutLog: WorkoutLog;
  onSave: () => void;
  onDone: () => void;
  isSaved: boolean;
}

const WorkoutCompletionCelebration: React.FC<WorkoutCompletionCelebrationProps> = ({
  workoutLog,
  onSave,
  onDone,
  isSaved,
}) => {
  const [showContent, setShowContent] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showPig, setShowPig] = useState(false);

  const totalVolume = calculateLogVolume(workoutLog);
  const totalSets = calculateTotalSets(workoutLog);
  const totalReps = calculateTotalReps(workoutLog);

  useEffect(() => {
    const t1 = setTimeout(() => setShowContent(true), 200);
    const t2 = setTimeout(() => setShowMetrics(true), 800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    if (isSaved) {
      setShowPig(true);
      const timer = setTimeout(() => {
        setShowPig(false);
        onDone(); // Navigate back after animation completes
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSaved, onDone]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm overflow-y-auto p-4">
      {/* Celebrating Pig Animation Overlay */}
      {showPig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md pointer-events-auto">
          <div className="relative scale-125 md:scale-150 flex flex-col items-center">
            <div className="text-[120px] md:text-[180px] animate-bounce filter drop-shadow-[0_0_50px_rgba(255,105,180,1)] select-none">
              <span className="inline-block animate-[wiggle_1s_ease-in-out_infinite]">🐷</span>
            </div>
            
            <div className="mt-8 text-center">
              <div className="text-pink-400 font-black text-5xl md:text-7xl italic tracking-tighter animate-pulse uppercase drop-shadow-[0_0_20px_rgba(255,105,180,0.5)]">
                OINK-TASTIC!
              </div>
              <div className="text-white/60 text-xl md:text-2xl font-bold mt-4 animate-bounce delay-100">
                (•◡•)
              </div>
            </div>
          </div>
          <style>{`
            @keyframes wiggle {
              0%, 100% { transform: rotate(-5deg) scale(1); }
              50% { transform: rotate(5deg) scale(1.1); }
            }
          `}</style>
        </div>
      )}

      <div className="flex flex-col items-center px-6 max-w-2xl w-full text-center">
        {/* Checkmark Animation */}
        <div
          className={`w-28 h-28 md:w-36 md:h-36 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-2xl shadow-green-500/30 transition-all duration-500 ${
            showContent ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
          }`}
          style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        >
          <svg className="w-14 h-14 md:w-16 md:h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Title */}
        <h2 className={`text-2xl md:text-3xl font-bold mt-8 mb-2 transition-all duration-500 delay-200 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          Workout Complete!
        </h2>
        <p className={`text-gray-400 mb-8 transition-all duration-500 delay-300 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
          You finished <strong className="text-white">{workoutLog.workoutName}</strong>
        </p>

        {/* Metrics Grid */}
        <div className={`w-full grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 transition-all duration-500 delay-400 ${showMetrics ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {/* Total Volume - Larger card */}
          <div className="col-span-2 md:col-span-2 bg-[#0d0d0d] border border-gray-800 rounded-2xl p-4 md:p-6 hover:border-green-500/50 transition-all">
            <div className="text-gray-400 text-xs md:text-sm font-bold uppercase tracking-wider mb-2">Total Volume</div>
            <div className="text-3xl md:text-4xl font-bold text-white">{Math.round(totalVolume)}</div>
            <div className="text-gray-500 text-xs md:text-sm mt-1">lbs</div>
          </div>

          {/* Total Sets */}
          <div className="bg-[#0d0d0d] border border-gray-800 rounded-2xl p-4 md:p-6 hover:border-green-500/50 transition-all">
            <div className="text-gray-400 text-xs md:text-sm font-bold uppercase tracking-wider mb-2">Sets</div>
            <div className="text-2xl md:text-3xl font-bold text-white">{totalSets}</div>
          </div>

          {/* Total Reps */}
          <div className="bg-[#0d0d0d] border border-gray-800 rounded-2xl p-4 md:p-6 hover:border-green-500/50 transition-all">
            <div className="text-gray-400 text-xs md:text-sm font-bold uppercase tracking-wider mb-2">Reps</div>
            <div className="text-2xl md:text-3xl font-bold text-white">{totalReps}</div>
          </div>
        </div>

        {/* Exercise Breakdown - Expandable */}
        <div className={`w-full mb-6 transition-all duration-500 delay-500 ${showMetrics ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full bg-[#0d0d0d] border border-gray-800 rounded-2xl p-4 hover:border-gray-700 transition-all flex items-center justify-between"
          >
            <span className="text-gray-400 text-sm font-bold uppercase tracking-wider">Exercise Breakdown</span>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${showBreakdown ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showBreakdown && (
            <div className="mt-3 space-y-3">
              {workoutLog.exercises.map((exercise) => {
                const exerciseVolume = exercise.sets.reduce((sum, set) => {
                  const weight = set.weight ?? 0;
                  return sum + weight * set.reps;
                }, 0);
                const exerciseSets = exercise.sets.length;
                const exerciseReps = exercise.sets.reduce((sum, set) => sum + set.reps, 0);
                return (
                  <div key={exercise.exerciseId} className="bg-[#111111] border border-gray-800 rounded-xl p-4 text-left">
                    <h4 className="text-white font-bold mb-2">{exercise.exerciseName}</h4>
                    <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                      <span>{exerciseSets} {exerciseSets === 1 ? 'set' : 'sets'}</span>
                      <span>{exerciseReps} reps</span>
                      {exerciseVolume > 0 && <span>{Math.round(exerciseVolume)} lbs volume</span>}
                    </div>
                    {exercise.sets.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-800 space-y-1">
                        {exercise.sets.map((set) => (
                          <div key={set.setNumber} className="flex justify-between text-xs text-gray-500">
                            <span>Set {set.setNumber}</span>
                            <span>
                              {set.weight !== undefined ? `${set.weight} lbs × ` : ''}
                              {set.reps} reps
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className={`w-full flex flex-col gap-3 transition-all duration-500 delay-600 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
          {!isSaved && (
            <button
              onClick={onSave}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-lg shadow-lg shadow-green-500/30 transition-all duration-200 active:scale-95"
            >
              Save Workout
            </button>
          )}
          <button
            onClick={onDone}
            className={`px-8 py-4 ${isSaved ? 'bg-white text-black' : 'bg-gray-800 text-white hover:bg-gray-700'} rounded-2xl font-bold transition-all duration-200 active:scale-95`}
          >
            {isSaved ? 'Back to Workout Selection' : 'Go Back'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Workout Log Detail Modal
interface WorkoutLogDetailModalProps {
  log: WorkoutLog;
  onClose: () => void;
}

const WorkoutLogDetailModal: React.FC<WorkoutLogDetailModalProps> = ({ log, onClose }) => {
  const totalVolume = calculateLogVolume(log);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#0d0d0d] border border-gray-800 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-20 p-2 bg-black/60 hover:bg-gray-800 rounded-full transition-colors text-white border border-gray-800"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="p-6 md:p-8">
          <div className="mb-6">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">{log.workoutName}</h2>
            <p className="text-gray-500 text-sm">
              Completed {new Date(log.completedAt).toLocaleString()}
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-3">
              <span>{log.exercises.length} exercises</span>
              <span>{Math.round(totalVolume)} total volume</span>
            </div>
          </div>
          <div className="space-y-4">
            {log.exercises.map((exercise) => (
              <div key={exercise.exerciseId} className="bg-[#111111] border border-gray-800 rounded-2xl p-4">
                <h3 className="text-lg font-bold mb-2">{exercise.exerciseName}</h3>
                {exercise.sets.length === 0 ? (
                  <p className="text-gray-500 text-sm">No sets recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {exercise.sets.map((set) => (
                      <div key={`${exercise.exerciseId}-${set.setNumber}`} className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Set {set.setNumber}</span>
                        <span className="text-gray-200">
                          {set.weight !== undefined ? `${set.weight} x ` : ''}
                          {set.reps} reps
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Workout Routine Drawer Component
interface WorkoutRoutineDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  workouts: Workout[];
  onRemove: (workoutId: string) => void;
  onClick: (workout: Workout) => void;
  onSave: () => void;
  onClear: () => void;
  onReorder: (oldIndex: number, newIndex: number) => void;
  getCategoryStyles: (category: Category) => { gradient: string; border: string; text: string; bg: string };
  hasWorkoutChanges: boolean;
  editingWorkoutId: string | null;
  isMobile: boolean;
}

const WorkoutRoutineDrawer: React.FC<WorkoutRoutineDrawerProps> = ({
  isOpen,
  onClose,
  workouts,
  onRemove,
  onClick,
  onSave,
  onClear,
  onReorder,
  getCategoryStyles,
  hasWorkoutChanges,
  editingWorkoutId,
  isMobile,
}) => {
  // Configure sensors for both mouse/pointer and touch
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // 150ms hold before drag starts on touch
        tolerance: 5, // 5px movement tolerance during delay
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = workouts.findIndex(w => w.id === active.id);
      const newIndex = workouts.findIndex(w => w.id === over.id);
      onReorder(oldIndex, newIndex);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full ${
          isMobile ? 'w-full' : 'w-full max-w-md'
        } bg-[#0d0d0d] border-l border-gray-800 z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-2xl font-bold">Your Routine</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close drawer"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 p-6 border-b border-gray-800">
          <button
            onClick={onSave}
            disabled={editingWorkoutId && !hasWorkoutChanges}
            className={`flex-1 px-6 py-2.5 rounded-2xl text-sm font-bold transition-all active:scale-95 ${
              editingWorkoutId && !hasWorkoutChanges
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            Save
          </button>
          <button
            onClick={onClear}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-sm font-bold transition-all active:scale-95"
          >
            Clear
          </button>
        </div>

        {/* Content */}
        <div 
          className="flex-1 overflow-y-auto p-6"
          style={{ 
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {workouts.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-400 text-lg mb-2">No workouts added yet</p>
              <p className="text-gray-500 text-sm">Tap workouts below to add them to your routine</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={workouts.map(w => w.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {workouts.map((workout) => (
                    <SortableWorkoutCard
                      key={workout.id}
                      workout={workout}
                      onRemove={onRemove}
                      onClick={onClick}
                      getCategoryStyles={getCategoryStyles}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </>
  );
};

// Drag Handle Icon Component
const DragHandleIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="9" cy="6" r="1.5" />
    <circle cx="15" cy="6" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="18" r="1.5" />
    <circle cx="15" cy="18" r="1.5" />
  </svg>
);

// Sortable Workout Card Component (with drag and drop)
interface SortableWorkoutCardProps {
  workout: Workout;
  onRemove: (workoutId: string) => void;
  onClick: (workout: Workout) => void;
  getCategoryStyles: (category: Category) => { gradient: string; border: string; text: string; bg: string };
}

const SortableWorkoutCard: React.FC<SortableWorkoutCardProps> = ({
  workout,
  onRemove,
  onClick,
  getCategoryStyles,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: workout.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  const styles = getCategoryStyles(workout.category);

  const handleClick = (e: React.MouseEvent) => {
    // Prevent click if clicking on the remove button or drag handle
    const target = e.target as HTMLElement;
    if (target.closest('button[aria-label*="Remove"]') || target.closest('[data-drag-handle]')) {
      return;
    }
    onClick(workout);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={`group bg-[#111111] border border-gray-800 hover:border-gray-700 rounded-2xl overflow-hidden flex gap-3 md:gap-4 p-4 md:p-4 relative select-none ${
        isDragging ? 'shadow-2xl shadow-black/80 scale-[1.02]' : ''
      }`}
    >
      {/* Drag Handle */}
      <div
        data-drag-handle
        {...attributes}
        {...listeners}
        className="flex-shrink-0 flex items-center justify-center w-8 md:w-10 cursor-grab active:cursor-grabbing touch-none"
        style={{ touchAction: 'none' }}
      >
        <DragHandleIcon className="w-5 h-5 md:w-6 md:h-6 text-gray-500 hover:text-gray-300 transition-colors" />
      </div>

      {/* Remove Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(workout.id);
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
        }}
        className="absolute top-3 right-3 md:top-4 md:right-4 z-20 p-2 md:p-2 bg-red-600/80 hover:bg-red-600 active:bg-red-700 rounded-lg text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label={`Remove ${workout.name}`}
        style={{ touchAction: 'manipulation', pointerEvents: 'auto', zIndex: 30 }}
      >
        <svg className="w-5 h-5 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex-1 flex flex-col justify-center pt-1 pr-12">
        <WorkoutBadges
          tag={workout.tag}
          categoryStyles={styles}
        />
        <h3 className="text-lg md:text-xl font-bold mb-2 md:mb-3 transition-colors duration-300 group-hover:text-white select-none">
          {workout.name}
        </h3>
        <p className="text-gray-400 text-sm mb-3 md:mb-4 select-none line-clamp-2">{workout.description}</p>
        <div className="flex flex-wrap gap-2 mt-1">
          {workout.targetMuscles.map(m => (
            <span key={m} className="px-2 md:px-3 py-1 bg-black/40 text-gray-400 text-[9px] md:text-[10px] font-black rounded-lg border border-gray-800 uppercase select-none">
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('landing');
  const [currentTab, setCurrentTab] = useState<TabType>('train');
  const [lastWorkout, setLastWorkout] = useState<WorkoutSelectionItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [customWorkouts, setCustomWorkouts] = useState<Workout[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [savedWorkouts, setSavedWorkouts] = useState<SavedWorkout[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [workoutNameInput, setWorkoutNameInput] = useState('');
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [viewingWorkoutId, setViewingWorkoutId] = useState<string | null>(null);
  const [originalWorkout, setOriginalWorkout] = useState<{ workouts: Workout[]; name: string } | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showCheckmarkAnimation, setShowCheckmarkAnimation] = useState(false);
  const [activeWorkout, setActiveWorkout] = useState<{ name: string; workouts: Workout[] } | null>(null);
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set());
  const [trackingByExercise, setTrackingByExercise] = useState<Record<string, ExerciseTrackingState>>({});
  const [exerciseLogsById, setExerciseLogsById] = useState<Record<string, ExerciseLog>>({});
  const [showWorkoutCompletion, setShowWorkoutCompletion] = useState(false);
  const [wasDrawerOpenBeforeModal, setWasDrawerOpenBeforeModal] = useState(false);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [selectedWorkoutLog, setSelectedWorkoutLog] = useState<WorkoutLog | null>(null);
  const [completedWorkoutLog, setCompletedWorkoutLog] = useState<WorkoutLog | null>(null);
  const [isWorkoutSaved, setIsWorkoutSaved] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedHistoryMetric, setSelectedHistoryMetric] = useState<'volume' | 'reps'>('volume');
  const [historyViewMode, setHistoryViewMode] = useState<'calendar' | 'last7days'>('last7days');

  const isCreateMode = appMode === 'create';
  const isMobile = useIsMobile();

  // Drawer handlers
  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);
  const toggleDrawer = () => setIsDrawerOpen(prev => !prev);

  // Handler to open workout detail modal and keep drawer open (hidden behind modal)
  const handleOpenWorkoutDetail = (workout: Workout) => {
    setWasDrawerOpenBeforeModal(true);
    // Don't close drawer - keep it open but it will be hidden behind modal (z-index)
    setSelectedWorkout(workout);
  };

  // Handler to open workout detail modal (not from drawer)
  const handleOpenWorkoutDetailFromGrid = (workout: Workout) => {
    setWasDrawerOpenBeforeModal(false);
    setSelectedWorkout(workout);
  };

  // Handler to close workout detail modal - drawer stays open (no animation needed)
  const handleCloseWorkoutDetail = () => {
    setSelectedWorkout(null);
    setWasDrawerOpenBeforeModal(false);
    // Drawer is already open, no need to call openDrawer() - it will just be visible again
  };


  // Get unique tags from workout library
  const availableTags = useMemo(() => {
    const tags = Array.from(new Set(WORKOUT_LIBRARY.map(w => w.tag)));
    // Sort tags with "Legs" last
    return tags.sort((a, b) => {
      if (a === 'Legs') return 1;
      if (b === 'Legs') return -1;
      return a.localeCompare(b);
    });
  }, []);

  const filteredWorkouts = useMemo(() => {
    if (isCreateMode) {
      return selectedTag
        ? WORKOUT_LIBRARY.filter(w => w.tag.toLowerCase() === selectedTag.toLowerCase())
        : WORKOUT_LIBRARY;
    }
    return selectedCategory === 'All'
      ? WORKOUT_LIBRARY
      : WORKOUT_LIBRARY.filter(w => w.category === selectedCategory);
  }, [isCreateMode, selectedTag, selectedCategory]);

  const historyPeriod = useMemo(() => pickSmartPeriod(workoutLogs), [workoutLogs]);
  const historyAggregated = useMemo(
    () => {
      const aggregated = aggregateLogsByPeriod(workoutLogs, historyPeriod);
      // If period is 'day', always show last 7 days
      if (historyPeriod === 'day') {
        const now = new Date();
        const last7Days: AggregatedMetrics[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
          const dateKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
          const existing = aggregated.find(a => a.dateKey === dateKey);
          if (existing) {
            last7Days.push(existing);
          } else {
            last7Days.push({
              dateKey,
              date: d,
              totalDurationSeconds: 0,
              totalVolume: 0,
              totalReps: 0,
              workoutCount: 0,
            });
          }
        }
        return last7Days;
      }
      return aggregated;
    },
    [workoutLogs, historyPeriod]
  );
  const historyVolumeData = useMemo(() => formatChartData(historyAggregated, 'volume'), [historyAggregated]);
  const historyRepsData = useMemo(() => formatChartData(historyAggregated, 'reps'), [historyAggregated]);

  // Get tile IDs for prominent tile detection
  const tileIds = useMemo(() => {
    if (appMode === 'view-saved' && viewingWorkoutId) {
      const viewedWorkout = savedWorkouts.find(w => w.id === viewingWorkoutId);
      return viewedWorkout ? viewedWorkout.workouts.map(w => w.id) : [];
    }
    return filteredWorkouts.map(w => w.id);
  }, [appMode, viewingWorkoutId, savedWorkouts, filteredWorkouts]);

  // Prominent tile detection disabled - no longer used
  const shouldUseProminentTile = false;
  const { prominentTileId, getTileRef } = useProminentTile(tileIds, shouldUseProminentTile);

  const getCategoryStyles = (category: Category) => {
    switch (category) {
      case 'Chest + Arms': 
        return { 
          gradient: 'from-blue-500 to-cyan-400',
          border: 'border-2 border-blue-500/20', 
          text: 'text-white', 
          bg: 'bg-blue-600' 
        };
      case 'Legs': 
        return { 
          gradient: 'from-emerald-500 to-green-400',
          border: 'border-2 border-emerald-500/20', 
          text: 'text-white', 
          bg: 'bg-emerald-600' 
        };
      case 'Back + Shoulders': 
        return { 
          gradient: 'from-purple-600 to-pink-500',
          border: 'border-2 border-purple-500/20', 
          text: 'text-white', 
          bg: 'bg-purple-600' 
        };
      case 'All':
      default:
        return { 
          gradient: 'from-gray-600 to-gray-400',
          border: 'border-2 border-gray-800', 
          text: 'text-white', 
          bg: 'bg-gray-700' 
        };
    }
  };

  const handleWorkoutToggle = (workout: Workout) => {
    const wasSelected = customWorkouts.some(w => w.id === workout.id);
    setCustomWorkouts(prev =>
      wasSelected
        ? prev.filter(w => w.id !== workout.id)
        : [workout, ...prev]
    );
  };

  const handleViewWorkouts = () => {
    setAppMode('workout-mode');
  };

  const handleCreateNewWorkout = () => {
    setAppMode('create');
    setCustomWorkouts([]);
    setSelectedTag(null);
    setEditingWorkoutId(null);
    setOriginalWorkout(null);
    closeDrawer();
  };

  const handleBackToProfile = () => {
    handleBackToLanding();
  };

  const handleBackToLanding = () => {
    setAppMode('landing');
    setCurrentTab('train');
    setSelectedWorkout(null);
    setCustomWorkouts([]);
    setEditingWorkoutId(null);
    setViewingWorkoutId(null);
    setOriginalWorkout(null);
    setActiveWorkout(null);
    setCompletedExercises(new Set());
    setTrackingByExercise({});
    setExerciseLogsById({});
    setShowWorkoutCompletion(false);
    setCompletedWorkoutLog(null);
    setIsWorkoutSaved(false);
    setWasDrawerOpenBeforeModal(false);
    setSelectedWorkoutLog(null);
    closeDrawer();
  };

  const handleBackToWorkoutSelection = () => {
    // Navigate back to Train landing page
    setAppMode('landing');
    setCurrentTab('train');
    setSelectedWorkout(null);
    setCustomWorkouts([]);
    setEditingWorkoutId(null);
    setViewingWorkoutId(null);
    setOriginalWorkout(null);
    setActiveWorkout(null);
    setCompletedExercises(new Set());
    setTrackingByExercise({});
    setExerciseLogsById({});
    setShowWorkoutCompletion(false);
    setCompletedWorkoutLog(null);
    setIsWorkoutSaved(false);
    setWasDrawerOpenBeforeModal(false);
    setSelectedWorkoutLog(null);
    closeDrawer();
  };


  const handleStartWorkout = (item: WorkoutSelectionItem) => {
    if (item.workouts.length === 0) return;
    setActiveWorkout({ name: item.name, workouts: item.workouts });
    setCompletedExercises(new Set());
    const trackingState: Record<string, ExerciseTrackingState> = {};
    item.workouts.forEach((workout) => {
      trackingState[workout.id] = createDefaultTrackingState();
    });
    setTrackingByExercise(trackingState);
    setExerciseLogsById({});
    setShowWorkoutCompletion(false);
    setCompletedWorkoutLog(null);
    setIsWorkoutSaved(false);
    setAppMode('workout-active');
  };

  const buildExerciseLog = (workout: Workout, tracking: ExerciseTrackingState, completedAt: number): ExerciseLog => {
    let sets: SetLog[] = [];
    
    // Handle quick mode: if mode is 'quick' and sets array is empty or has no valid reps, use quick mode data
    if (tracking.mode === 'quick') {
      const quickSets = parseNumber(tracking.quickSets);
      const quickReps = parseNumber(tracking.quickReps);
      const quickWeight = parseNumber(tracking.quickWeight);
      
      // If quick mode has valid data, use it
      if (quickSets !== null && quickSets > 0 && quickReps !== null && quickReps > 0) {
        for (let i = 0; i < quickSets; i++) {
          const setLog: SetLog = {
            setNumber: i + 1,
            reps: quickReps,
            completedAt,
          };
          if (quickWeight !== null && quickWeight > 0) {
            setLog.weight = quickWeight;
          }
          sets.push(setLog);
        }
      }
    }
    
    // Handle detailed mode: process sets array
    // If we already have sets from quick mode, use those; otherwise build from detailed sets
    if (sets.length === 0) {
      sets = tracking.sets.reduce<SetLog[]>((acc, set, idx) => {
        const reps = parseNumber(set.reps);
        if (reps === null || reps <= 0) return acc;
        const weight = parseNumber(set.weight);
        const next: SetLog = {
          setNumber: idx + 1,
          reps,
          completedAt,
        };
        // Only include weight if it's greater than 0
        if (weight !== null && weight > 0) {
          next.weight = weight;
        }
        acc.push(next);
        return acc;
      }, []);
    }

    return {
      exerciseId: workout.id,
      exerciseName: workout.name,
      sets,
    };
  };

  const handleCompleteExercise = (workoutId: string, isLastExercise: boolean = false) => {
    if (!activeWorkout) return;
    const workout = activeWorkout.workouts.find((item) => item.id === workoutId);
    if (!workout) return;
    const tracking = trackingByExercise[workoutId] || createDefaultTrackingState();
    const completedAt = Date.now();
    // Always rebuild the log with current tracking data, even if already completed
    // This ensures the summary shows the latest data if user clicks "Done" again
    const log = buildExerciseLog(workout, tracking, completedAt);
    setExerciseLogsById((prev) => ({ ...prev, [workoutId]: log }));
    const newCompletedExercises = new Set(completedExercises);
    newCompletedExercises.add(workoutId);
    setCompletedExercises(newCompletedExercises);
    
    // Only show summary if clicking "Done" on the LAST exercise
    // This prevents summary from triggering when clicking "Done" on any tile when all are already complete
    if (isLastExercise) {
      handleShowWorkoutSummary();
    }
  };

  const handleUpdateQuick = (
    workoutId: string,
    field: 'quickSets' | 'quickReps' | 'quickWeight',
    value: string
  ) => {
    setTrackingByExercise((prev) => {
      const current = prev[workoutId] || createDefaultTrackingState();
      return {
        ...prev,
        [workoutId]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const handleToggleMode = (workoutId: string) => {
    setTrackingByExercise((prev) => {
      const current = prev[workoutId] || createDefaultTrackingState();
      const nextMode: TrackingMode = current.mode === 'quick' ? 'detailed' : 'quick';
      let nextSets = current.sets;
      if (nextMode === 'detailed' && current.sets.length === 0) {
        const quickSets = parseNumber(current.quickSets);
        const count = quickSets && quickSets > 0 ? Math.min(quickSets, 10) : 0;
        const sets: SetInput[] = [];
        for (let i = 0; i < count; i += 1) {
          sets.push({
            id: `${workoutId}-set-${Date.now()}-${i}`,
            weight: current.quickWeight,
            reps: current.quickReps,
          });
        }
        nextSets = sets;
      }
      return {
        ...prev,
        [workoutId]: {
          ...current,
          mode: nextMode,
          sets: nextSets,
        },
      };
    });
  };

  const handleAddSet = (workoutId: string) => {
    setTrackingByExercise((prev) => {
      const current = prev[workoutId] || createDefaultTrackingState();
      const last = current.sets[current.sets.length - 1];
      const nextSet: SetInput = {
        id: `${workoutId}-set-${Date.now()}-${Math.random()}`,
        weight: last?.weight || '',
        reps: last?.reps || '',
      };
      
      const nextSets = [...current.sets, nextSet];
      
      // Scroll the panel to the bottom after adding a set
      setTimeout(() => {
        const panels = document.querySelectorAll('[data-scrollable-panel="true"]');
        panels.forEach(panel => {
          panel.scrollTo({
            top: panel.scrollHeight,
            behavior: 'smooth'
          });
        });
      }, 50);

      return {
        ...prev,
        [workoutId]: {
          ...current,
          sets: nextSets,
        },
      };
    });
  };

  const handleUpdateSet = (
    workoutId: string,
    setId: string,
    field: 'weight' | 'reps',
    value: string
  ) => {
    setTrackingByExercise((prev) => {
      const current = prev[workoutId] || createDefaultTrackingState();
      const nextSets = current.sets.map((set) =>
        set.id === setId ? { ...set, [field]: value } : set
      );
      return {
        ...prev,
        [workoutId]: {
          ...current,
          sets: nextSets,
        },
      };
    });
  };

  const handleRemoveSet = (workoutId: string, setId: string) => {
    setTrackingByExercise((prev) => {
      const current = prev[workoutId] || createDefaultTrackingState();
      const nextSets = current.sets.filter((set) => set.id !== setId);
      return {
        ...prev,
        [workoutId]: {
          ...current,
          sets: nextSets,
        },
      };
    });
  };

  const handleBackFromWorkoutActive = () => {
    const hasProgress = completedExercises.size > 0;
    if (hasProgress && !window.confirm('Leave workout? Your progress will not be saved.')) return;
    setAppMode('landing');
    setCurrentTab('train');
    setActiveWorkout(null);
    setCompletedExercises(new Set());
    setTrackingByExercise({});
    setExerciseLogsById({});
    setCompletedWorkoutLog(null);
    setShowWorkoutCompletion(false);
  };

  const handleShowWorkoutSummary = () => {
    if (!activeWorkout) return;

    const completedAt = Date.now();

    // Always rebuild exercises from current trackingByExercise state to ensure latest data
    // This ensures the summary reflects any changes made, even if exerciseLogsById hasn't updated yet
    const exercises: ExerciseLog[] = activeWorkout.workouts.map((workout) => {
      const currentTracking = trackingByExercise[workout.id] || createDefaultTrackingState();
      // Always rebuild from current tracking state to get latest data
      return buildExerciseLog(workout, currentTracking, completedAt);
    });

    const workoutLog: WorkoutLog = {
      id: `${completedAt}-${activeWorkout.name}`,
      workoutName: activeWorkout.name,
      completedAt,
      exercises,
    };

    // Show summary page (even if invalid - user can still review)
    setCompletedWorkoutLog(workoutLog);
    setIsWorkoutSaved(false);
    setShowWorkoutCompletion(true);
  };

  const handleSaveWorkoutLog = async () => {
    if (!activeWorkout) return;

    // Always rebuild workout log from current trackingByExercise state to ensure latest data
    // This ensures we save the most up-to-date data even if user went back and made changes
    const completedAt = Date.now();

    const exercises: ExerciseLog[] = activeWorkout.workouts.map((workout) => {
      const currentTracking = trackingByExercise[workout.id] || createDefaultTrackingState();
      // Always rebuild from current tracking state to get latest data
      return buildExerciseLog(workout, currentTracking, completedAt);
    });

    const workoutLogToSave: WorkoutLog = {
      id: `${completedAt}-${activeWorkout.name}`,
      workoutName: activeWorkout.name,
      completedAt,
      exercises,
    };

    // Debug: Log the workout log to see what we're trying to save
    const totalRepsDebug = exercises.reduce((sum, ex) => sum + ex.sets.reduce((s, set) => s + set.reps, 0), 0);
    console.log('[Workout] Attempting to save workout log:', {
      workoutName: workoutLogToSave.workoutName,
      exerciseCount: exercises.length,
      exercises: exercises.map(ex => ({
        name: ex.exerciseName,
        setsCount: ex.sets.length,
        sets: ex.sets.map(s => ({ reps: s.reps, weight: s.weight, completedAt: s.completedAt })),
        totalReps: ex.sets.reduce((sum, set) => sum + set.reps, 0)
      })),
      totalReps: totalRepsDebug,
      trackingByExercise: Object.keys(trackingByExercise).map(key => ({
        workoutId: key,
        mode: trackingByExercise[key]?.mode,
        quickSets: trackingByExercise[key]?.quickSets,
        quickReps: trackingByExercise[key]?.quickReps,
        setsCount: trackingByExercise[key]?.sets?.length || 0,
        sets: trackingByExercise[key]?.sets?.map(s => ({ reps: s.reps, weight: s.weight })) || []
      }))
    });

    // CRITICAL: Validate workout log BEFORE saving to prevent phantom/invalid logs
    // Only save if the workout has actual completed exercises with valid sets
    if (!isValidWorkoutLog(workoutLogToSave)) {
      // Calculate what we have for better error message
      const totalReps = exercises.reduce((sum, ex) => sum + ex.sets.reduce((s, set) => s + set.reps, 0), 0);
      const hasValidExercise = exercises.some(ex => 
        ex.sets.some(set => set.reps > 0 && set.completedAt > 0)
      );
      
      console.warn('[Workout] Validation failed:', {
        hasValidExercise,
        totalReps,
        exerciseDetails: exercises.map(ex => ({
          name: ex.exerciseName,
          setsCount: ex.sets.length,
          validSets: ex.sets.filter(s => s.reps > 0 && s.completedAt > 0).length
        }))
      });
      
      alert(`Cannot save workout: No valid exercises with completed sets found.\n\nTotal reps: ${totalReps}\nPlease complete at least one exercise with valid sets.`);
      return;
    }

    try {
      await storage.saveWorkoutLog(workoutLogToSave);
      console.log(`[Workout History] Successfully saved workout log "${workoutLogToSave.workoutName}"`);
      
      // Reload logs from storage to ensure consistency
      const updatedLogs = await storage.loadWorkoutLogs();
      // Filter out invalid/phantom workout logs - only keep completed workouts with actual exercise data
      const validLogs = updatedLogs.filter(isValidWorkoutLog);
      setWorkoutLogs(validLogs);
      console.log(`[Workout History] Total workout logs after save: ${validLogs.length}`);
      
      // Save last workout for quick repeat
      const lastWorkoutItem: WorkoutSelectionItem = {
        id: activeWorkout.name,
        name: activeWorkout.name,
        workouts: activeWorkout.workouts,
      };
      setLastWorkout(lastWorkoutItem);
      try {
        localStorage.setItem('lastWorkout', JSON.stringify(lastWorkoutItem));
        console.log('[Last Workout] Saved last workout for quick repeat');
      } catch (error) {
        console.error('[Last Workout] Error saving last workout:', error);
      }
      
      setIsWorkoutSaved(true);
      // Update completedWorkoutLog to reflect the saved version
      setCompletedWorkoutLog(workoutLogToSave);
    } catch (error) {
      console.error('[Workout History] Error saving workout log:', error);
      alert('Failed to save workout. Please try again.');
    }
  };

  const handleWorkoutCompletionDone = () => {
    // If workout is saved, go back to landing page
    // Otherwise, just hide completion screen to allow review
    if (isWorkoutSaved) {
      // Navigate back to train tab
      setShowWorkoutCompletion(false);
      setActiveWorkout(null);
      setCompletedExercises(new Set());
      setTrackingByExercise({});
      setExerciseLogsById({});
      setCompletedWorkoutLog(null);
      setIsWorkoutSaved(false);
      setAppMode('landing');
      setCurrentTab('train');
      closeDrawer();
    } else {
      // Just hide completion screen - keep workout active for review
      setShowWorkoutCompletion(false);
    }
  };

  const handleRepeatLastWorkout = () => {
    if (!lastWorkout) return;
    handleStartWorkout(lastWorkout);
  };

  const handleClearCustomWorkout = () => {
    setCustomWorkouts([]);
    // Don't clear editingWorkoutId - user might want to clear workouts and add new ones to the same saved workout
    // Keep editingWorkoutId set so they can still save to the same workout
    // Keep originalWorkout as is - we need it to detect changes from the original state
  };

  const handleRemoveWorkout = (workoutId: string) => {
    setCustomWorkouts(prev => prev.filter(w => w.id !== workoutId));
  };

  const handleReorderWorkouts = (oldIndex: number, newIndex: number) => {
    setCustomWorkouts(prev => arrayMove(prev, oldIndex, newIndex));
  };

  const closeSaveModal = () => {
    setShowSaveModal(false);
    setWorkoutNameInput('');
    // Don't clear editingWorkoutId here - keep it set so subsequent saves continue to update the same workout
    // It will be cleared when creating a new workout or going back to landing
    // setEditingWorkoutId(null);
    // Don't clear originalWorkout either - we need it to detect changes
    // setOriginalWorkout(null);
  };

  const handleSaveWorkout = () => {
    if (customWorkouts.length === 0) return;
    // Close drawer before showing save modal/bottom sheet
    closeDrawer();
    setShowSaveModal(true);
    // If editing an existing workout, pre-fill the name
    if (editingWorkoutId) {
      const workout = savedWorkouts.find(w => w.id === editingWorkoutId);
      setWorkoutNameInput(workout?.name || '');
      // Store original state if not already stored
      if (!originalWorkout && workout) {
        setOriginalWorkout({ workouts: [...workout.workouts], name: workout.name });
      }
    } else {
      setWorkoutNameInput('');
    }
  };

  // Check if changes were made when editing (for Save button - doesn't check name since modal isn't open yet)
  const hasWorkoutChanges = useMemo(() => {
    if (!editingWorkoutId || !originalWorkout) return true; // New workout always has "changes"
    
    // Compare workouts by IDs and order
    const originalIds = originalWorkout.workouts.map(w => w.id);
    const currentIds = customWorkouts.map(w => w.id);
    
    // Check if length matches
    if (originalIds.length !== currentIds.length) {
      return true;
    }
    
    // Check if all IDs match in the same order
    const workoutsChanged = originalIds.some((id, index) => id !== currentIds[index]);
    
    return workoutsChanged;
  }, [editingWorkoutId, originalWorkout, customWorkouts]);

  // Check if changes were made when editing (for modal - includes name check)
  const hasChanges = useMemo(() => {
    if (!editingWorkoutId || !originalWorkout) return true; // New workout always has "changes"
    
    const currentName = workoutNameInput.trim();
    const nameChanged = currentName !== originalWorkout.name;
    
    // Compare workouts by IDs and order
    const originalIds = originalWorkout.workouts.map(w => w.id);
    const currentIds = customWorkouts.map(w => w.id);
    
    // Check if length matches
    if (originalIds.length !== currentIds.length) {
      return true;
    }
    
    // Check if all IDs match in the same order
    const workoutsChanged = originalIds.some((id, index) => id !== currentIds[index]);
    
    return nameChanged || workoutsChanged;
  }, [editingWorkoutId, originalWorkout, workoutNameInput, customWorkouts]);

  const handleSaveWorkoutConfirm = async () => {
    const name = workoutNameInput.trim();
    if (!name || name.length === 0 || name.length > 50) return;
    // Don't save if no changes were made
    if (editingWorkoutId && !hasChanges) return;

    try {
      if (editingWorkoutId) {
        // Update existing workout
        await storage.updateWorkout(editingWorkoutId, {
          name,
          workouts: [...customWorkouts]
        });
        // Update originalWorkout to the newly saved state so we can detect future changes
        setOriginalWorkout({ workouts: [...customWorkouts], name });
        // Keep editingWorkoutId set so subsequent saves continue to update the same workout
      } else {
        // Create new workout
        const newWorkout: SavedWorkout = {
          id: Date.now().toString(),
          name,
          workouts: [...customWorkouts],
          createdAt: Date.now()
        };
        await storage.saveWorkout(newWorkout);
      }
      
      // Reload workouts from storage to ensure consistency
      const updatedWorkouts = await storage.loadWorkouts();
      setSavedWorkouts(updatedWorkouts);
      
      console.log(`[Saved Workouts] Successfully saved workout "${name}". Total saved workouts: ${updatedWorkouts.length}`);
      
      closeSaveModal();
      closeDrawer();
      
      // Show checkmark animation
      setShowCheckmarkAnimation(true);
    } catch (error) {
      console.error('[Saved Workouts] Error saving workout:', error);
      alert('Failed to save workout. Please try again.');
    }
  };

  const handleCheckmarkAnimationComplete = () => {
    setShowCheckmarkAnimation(false);
    // Navigate back to Train landing page
    setAppMode('landing');
    setCurrentTab('train');
    setCustomWorkouts([]);
    setEditingWorkoutId(null);
    setOriginalWorkout(null);
    setSelectedTag(null);
  };

  const handleLoadSavedWorkout = (workoutId: string) => {
    const workout = savedWorkouts.find(w => w.id === workoutId);
    if (workout) {
      setCustomWorkouts(workout.workouts);
      setEditingWorkoutId(workoutId);
      setOriginalWorkout({ workouts: [...workout.workouts], name: workout.name });
      setAppMode('create');
      setSelectedTag(null);
    }
  };

  const handleViewSavedWorkout = (workoutId: string) => {
    setViewingWorkoutId(workoutId);
    setAppMode('view-saved');
  };

  const handleEditSavedWorkout = (workoutId: string) => {
    handleLoadSavedWorkout(workoutId);
  };

  const handleDeleteSavedWorkout = async (workoutId: string) => {
    if (window.confirm('Delete this saved workout?')) {
      try {
        await storage.deleteWorkout(workoutId);
        const updatedWorkouts = await storage.loadWorkouts();
        setSavedWorkouts(updatedWorkouts);
      } catch (error) {
        console.error('Error deleting workout:', error);
        // Optionally show user-facing error message here
      }
    }
  };

  const handleViewSavedWorkouts = () => {
    setAppMode('saved');
  };

  const handleViewWorkoutHistory = () => {
    setSelectedWorkoutLog(null);
    setCurrentTab('progress');
    setAppMode('landing');
  };

  const handleClearAllWorkoutLogs = async () => {
    if (workoutLogs.length === 0) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to delete all ${workoutLogs.length} workout log${workoutLogs.length === 1 ? '' : 's'}? This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    try {
      // Delete all workout logs one by one
      for (const log of workoutLogs) {
        await storage.deleteWorkoutLog(log.id);
      }
      
      // Clear the state
      setWorkoutLogs([]);
      setSelectedWorkoutLog(null);
      
      console.log('[Workout History] Cleared all workout logs');
    } catch (error) {
      console.error('Error clearing workout logs:', error);
      alert('Failed to clear workout logs. Please try again.');
    }
  };

  const handleOpenCalendar = (date?: Date) => {
    setCalendarSelectedDate(date);
    setIsCalendarOpen(true);
  };

  const handleCloseCalendar = () => {
    setIsCalendarOpen(false);
    setCalendarSelectedDate(undefined);
  };

  const isWorkoutSelected = (workoutId: string) => {
    return customWorkouts.some(w => w.id === workoutId);
  };

  // Load saved workouts on mount with proper error handling
  useEffect(() => {
    const loadSavedWorkouts = async () => {
      try {
        console.log('[Saved Workouts] Loading saved workouts from storage...');
        const workouts = await storage.loadWorkouts();
        console.log(`[Saved Workouts] Loaded ${workouts.length} saved workouts from storage`);
        setSavedWorkouts(workouts);
      } catch (error) {
        console.error('[Saved Workouts] Error loading saved workouts:', error);
        console.error('[Saved Workouts] Failed to load saved workouts. Error details:', error);
        // Set empty array on error to avoid showing stale data
        setSavedWorkouts([]);
      }
    };
    
    loadSavedWorkouts();
  }, []);

  // Load last workout on mount for quick repeat feature
  useEffect(() => {
    const loadLastWorkout = () => {
      try {
        console.log('[Last Workout] Loading last workout from storage...');
        const lastWorkoutData = localStorage.getItem('lastWorkout');
        if (lastWorkoutData) {
          const parsed = JSON.parse(lastWorkoutData) as WorkoutSelectionItem;
          setLastWorkout(parsed);
          console.log('[Last Workout] Loaded last workout:', parsed.name);
        } else {
          console.log('[Last Workout] No last workout found');
        }
      } catch (error) {
        console.error('[Last Workout] Error loading last workout:', error);
        setLastWorkout(null);
      }
    };
    
    loadLastWorkout();
  }, []);

  useEffect(() => {
    // Load workout logs on mount with proper error handling
    const loadWorkoutHistory = async () => {
      try {
        console.log('[Workout History] Loading workout logs from storage...');
        const logs = await storage.loadWorkoutLogs();
        console.log(`[Workout History] Loaded ${logs.length} workout logs from storage`);
        
        // CRITICAL: Always validate and clean ALL logs on load
        // This ensures users only see their actual tracked workouts
        const validLogs = logs.filter(isValidWorkoutLog);
        const invalidLogs = logs.filter(log => !isValidWorkoutLog(log));
        
        console.log(`[Workout History] Found ${validLogs.length} valid logs and ${invalidLogs.length} invalid logs`);
        
        // If there are ANY invalid logs, delete them immediately
        if (invalidLogs.length > 0) {
          console.log(`[Cleanup] Found ${invalidLogs.length} invalid/phantom workout logs. Removing from storage...`);
          for (const invalidLog of invalidLogs) {
            try {
              await storage.deleteWorkoutLog(invalidLog.id);
            } catch (error) {
              console.error(`[Cleanup] Failed to delete invalid log ${invalidLog.id}:`, error);
            }
          }
          console.log(`[Cleanup] Removed ${invalidLogs.length} invalid logs. ${validLogs.length} valid logs remaining.`);
        }
        
        // Remove duplicates from valid logs - keep first occurrence of each unique workout
        const seenIds = new Set<string>();
        const seenKeys = new Set<string>();
        const deduplicatedValidLogs: WorkoutLog[] = [];
        const duplicateLogsToDelete: WorkoutLog[] = [];
        
        for (const log of validLogs) {
          const key = `${log.completedAt}-${log.workoutName}`;
          if (!seenIds.has(log.id) && !seenKeys.has(key)) {
            seenIds.add(log.id);
            seenKeys.add(key);
            deduplicatedValidLogs.push(log);
          } else {
            // This is a duplicate - mark for deletion
            duplicateLogsToDelete.push(log);
          }
        }
        
        // Delete duplicate logs
        if (duplicateLogsToDelete.length > 0) {
          console.log(`[Cleanup] Found ${duplicateLogsToDelete.length} duplicate logs. Removing duplicates...`);
          let deletedCount = 0;
          for (const duplicate of duplicateLogsToDelete) {
            try {
              await storage.deleteWorkoutLog(duplicate.id);
              deletedCount++;
            } catch (error) {
              console.error(`[Cleanup] Failed to delete duplicate log ${duplicate.id}:`, error);
            }
          }
          console.log(`[Cleanup] Removed ${deletedCount} duplicate logs.`);
        }
        
        // Final count - this is what users will see
        console.log(`[Workout History] Complete. ${deduplicatedValidLogs.length} valid, unique workout logs remaining.`);
        setWorkoutLogs(deduplicatedValidLogs);
      } catch (error) {
        console.error('[Workout History] Error loading workout logs:', error);
        // Don't set empty array on error - try to preserve existing state if possible
        // Only set empty if we're sure there's a critical error
        console.error('[Workout History] Failed to load workout history. Error details:', error);
        // Still set empty array to avoid showing stale data, but log the error clearly
        setWorkoutLogs([]);
      }
    };
    
    loadWorkoutHistory();
  }, []);

  const handleViewWorkoutSelection = () => {
    // Navigate to Train landing page
    setAppMode('landing');
    setCurrentTab('train');
  };

  const handleViewProfile = () => {
    setAppMode('profile');
  };

  // Tab-based navigation for main app modes
  if (appMode === 'landing') {
    const showTabBar = !showWorkoutCompletion;
    
    return (
      <>
        {currentTab === 'train' && (
          <TrainLandingPage
            lastWorkout={lastWorkout}
            onStartWorkout={() => setAppMode('workout-mode')}
            onRepeatLastWorkout={handleRepeatLastWorkout}
            onCreateWorkout={handleCreateNewWorkout}
            onManageWorkouts={handleViewSavedWorkouts}
          />
        )}
        
        {currentTab === 'progress' && (
          <ProgressPage
            workoutLogs={workoutLogs}
            historyViewMode={historyViewMode}
            setHistoryViewMode={setHistoryViewMode}
            selectedHistoryMetric={selectedHistoryMetric}
            setSelectedHistoryMetric={setSelectedHistoryMetric}
            historyVolumeData={historyVolumeData}
            historyRepsData={historyRepsData}
            historyPeriod={historyPeriod}
            calendarSelectedDate={calendarSelectedDate}
            setCalendarSelectedDate={setCalendarSelectedDate}
            selectedWorkoutLog={selectedWorkoutLog}
            setSelectedWorkoutLog={setSelectedWorkoutLog}
            onClearAllWorkoutLogs={handleClearAllWorkoutLogs}
          />
        )}
        
        {showTabBar && (
          <BottomTabBar
            currentTab={currentTab}
            onTabChange={setCurrentTab}
          />
        )}
      </>
    );
  }


  if (appMode === 'profile') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-12 selection:bg-blue-500/30">
        <div className="flex items-center justify-between mb-12 max-w-4xl mx-auto">
          <button 
            onClick={handleBackToLanding}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
          >
            <svg className="w-6 h-6 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-bold uppercase tracking-wider text-sm">Back</span>
          </button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            Profile
          </h1>
          <div className="w-20" />
        </div>

        <main className="max-w-4xl mx-auto space-y-8">
          <div className="bg-[#111111] border border-gray-800 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8">
            <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-2xl shadow-purple-500/20">
              <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="text-center md:text-left">
              <h2 className="text-3xl font-bold mb-2">PulseFit User</h2>
              <p className="text-gray-500 mb-6">Level 1 Athlete</p>
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                <div className="bg-gray-900/50 border border-gray-800 px-4 py-2 rounded-xl">
                  <span className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Workouts</span>
                  <span className="text-xl font-bold text-emerald-400">{workoutLogs.length}</span>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 px-4 py-2 rounded-xl">
                  <span className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Streak</span>
                  <span className="text-xl font-bold text-orange-400">--</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <button
              onClick={handleViewWorkoutHistory}
              className="group bg-[#111111] border border-gray-800 rounded-3xl p-8 hover:border-emerald-500/50 transition-all duration-300 flex items-center justify-between"
            >
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-400 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M4 11h16M5 21h14a2 2 0 002-2V7H3v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-bold group-hover:text-emerald-400 transition-colors">Workout History</h3>
                  <p className="text-gray-500 text-sm">Review your past sessions and progress</p>
                </div>
              </div>
              <svg className="w-6 h-6 text-gray-600 group-hover:text-emerald-400 transition-all group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (appMode === 'workout-mode') {
    return (
      <WorkoutModeSelection
        predefinedWorkouts={PREDEFINED_WORKOUTS}
        savedWorkouts={savedWorkouts}
        onSelectWorkout={handleStartWorkout}
        onBack={() => {
          setAppMode('landing');
          setCurrentTab('train');
        }}
        getCategoryStyles={getCategoryStyles}
      />
    );
  }

  if (appMode === 'workout-active' && activeWorkout) {
    return (
      <>
        {!showWorkoutCompletion && (
          <WorkoutCarousel
            workoutName={activeWorkout.name}
            workouts={activeWorkout.workouts}
            completedExercises={completedExercises}
            trackingByExercise={trackingByExercise}
            onUpdateQuick={handleUpdateQuick}
            onToggleMode={handleToggleMode}
            onAddSet={handleAddSet}
            onUpdateSet={handleUpdateSet}
            onRemoveSet={handleRemoveSet}
            onMarkComplete={handleCompleteExercise}
            onBack={handleBackFromWorkoutActive}
            getCategoryStyles={getCategoryStyles}
            isMobile={isMobile}
          />
        )}
        {showWorkoutCompletion && completedWorkoutLog && (
          <WorkoutCompletionCelebration
            workoutLog={completedWorkoutLog}
            onSave={handleSaveWorkoutLog}
            onDone={handleWorkoutCompletionDone}
            isSaved={isWorkoutSaved}
          />
        )}
      </>
    );
  }

  // Note: 'create', 'saved', and 'view-saved' modes are handled in the fallback return statement below
  // Note: 'workout-history' mode has been replaced with tab-based Progress page

  if (appMode === 'saved') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-12 selection:bg-blue-500/30">
        <Header onBack={handleBackToWorkoutSelection} />

        <main className="max-w-7xl mx-auto">
          {savedWorkouts.length === 0 ? (
            <div className="text-center py-16 bg-[#111111] border border-gray-800 rounded-2xl">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <p className="text-gray-400 text-lg mb-2">No saved workouts yet</p>
              <p className="text-gray-500 text-sm">Create one in the workout builder!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {savedWorkouts.map((savedWorkout) => (
                <div
                  key={savedWorkout.id}
                  className="group bg-[#111111] border border-gray-800 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col md:flex-row gap-4 p-4 hover:border-gray-700 hover:shadow-2xl hover:shadow-black/60"
                >
                  <div className="flex-1 flex flex-col justify-center">
                    <h3 className="text-xl font-bold mb-2 transition-colors duration-300 group-hover:text-white">{savedWorkout.name}</h3>
                    <p className="text-gray-500 text-sm mb-1">
                      {savedWorkout.workouts.length} {savedWorkout.workouts.length === 1 ? 'exercise' : 'exercises'}
                    </p>
                    <p className="text-gray-600 text-xs">Created {formatDate(savedWorkout.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 md:pr-4">
                    <button
                      onClick={() => handleViewSavedWorkout(savedWorkout.id)}
                      className="px-6 py-3 bg-gray-50 hover:bg-gray-100 text-gray-800 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg active:scale-95 whitespace-nowrap"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleEditSavedWorkout(savedWorkout.id)}
                      className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm font-bold transition-all active:scale-95 whitespace-nowrap"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteSavedWorkout(savedWorkout.id)}
                      className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-all active:scale-95 whitespace-nowrap"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  if (appMode === 'view-saved' && viewingWorkoutId) {
    const viewedWorkout = savedWorkouts.find(w => w.id === viewingWorkoutId);
    if (!viewedWorkout) {
      setAppMode('saved');
      return null;
    }

    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-12 selection:bg-blue-500/30">
        <header className="max-w-7xl mx-auto mb-8 md:mb-12 flex justify-between items-start">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent inline-block transition-all duration-500">
              PulseFit Pro
            </h1>
            <p className="text-gray-500 text-sm mt-2">{viewedWorkout.name} • {viewedWorkout.workouts.length} {viewedWorkout.workouts.length === 1 ? 'exercise' : 'exercises'}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleEditSavedWorkout(viewingWorkoutId)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm font-bold transition-all active:scale-95"
            >
              Edit
            </button>
            <button
              onClick={() => setAppMode('saved')}
              className="px-5 py-3 md:px-4 md:py-2 text-gray-400 hover:text-white transition-colors text-base md:text-sm font-medium rounded-lg hover:bg-gray-800/50 active:scale-95 min-w-[88px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
            >
              ← Back
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto">
          <div className="space-y-4">
            {viewedWorkout.workouts.map((workout) => (
              <WorkoutListCard
                key={workout.id}
                workout={workout}
                onClick={setSelectedWorkout}
                getCategoryStyles={getCategoryStyles}
                isProminent={false}
                getTileRef={getTileRef}
                showViewButton={false}
              />
            ))}
          </div>
        </main>

        {selectedWorkout && (
          <WorkoutDetailModal
            workout={selectedWorkout}
            onClose={handleCloseWorkoutDetail}
            getCategoryStyles={getCategoryStyles}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-12 selection:bg-blue-500/30">
      <Header onBack={isCreateMode ? handleBackToWorkoutSelection : handleBackToLanding} />

      {!isCreateMode && (
        <nav className="max-w-7xl mx-auto mb-10">
          <div className="relative">
            <div className="flex gap-3 pb-2 overflow-x-auto scrollbar-hide">
              {CATEGORIES.filter(cat => appMode === 'view' ? cat !== 'All' : true).map((cat) => {
                const isActive = selectedCategory === cat && !isCreateMode;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat as Category)}
                    className={`px-6 py-2.5 rounded-2xl whitespace-nowrap transition-all border text-sm font-bold active:scale-95 flex-shrink-0 ${
                      isActive 
                        ? `bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.1)]` 
                        : `bg-transparent text-gray-500 border-gray-800 hover:border-gray-600`
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
            {isMobile && (
              <div className="absolute top-0 right-0 w-16 h-full pointer-events-none bg-gradient-to-l from-[#0a0a0a] to-transparent" />
            )}
          </div>
        </nav>
      )}

      <main className="max-w-7xl mx-auto">
        {isCreateMode && (
          <nav className="max-w-7xl mx-auto mb-10">
            <div className="relative">
              <div className="flex gap-3 pb-2 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`px-6 py-2.5 rounded-2xl whitespace-nowrap transition-all border text-sm font-bold active:scale-95 flex-shrink-0 ${
                    selectedTag === null
                      ? `bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.1)]`
                      : `bg-transparent text-gray-500 border-gray-800 hover:border-gray-600`
                  }`}
                >
                  All
                </button>
                {availableTags.map((tag) => {
                  const isActive = selectedTag?.toLowerCase() === tag.toLowerCase();
                  return (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(isActive ? null : tag)}
                      className={`px-6 py-2.5 rounded-2xl whitespace-nowrap transition-all border text-sm font-bold active:scale-95 flex-shrink-0 capitalize ${
                        isActive
                          ? `bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.1)]`
                          : `bg-transparent text-gray-500 border-gray-800 hover:border-gray-600`
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
              {isMobile && (
                <div className="absolute top-0 right-0 w-16 h-full pointer-events-none bg-gradient-to-l from-[#0a0a0a] to-transparent" />
              )}
            </div>
          </nav>
        )}

        {appMode === 'view' ? (
          <div className="space-y-4">
            {filteredWorkouts.map((workout) => (
              <WorkoutListCard
                key={workout.id}
                workout={workout}
                onClick={setSelectedWorkout}
                getCategoryStyles={getCategoryStyles}
                isProminent={false}
                getTileRef={getTileRef}
                showViewButton={false}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredWorkouts.map((workout) => {
              const styles = getCategoryStyles(workout.category);
              const isSelected = isWorkoutSelected(workout.id);

              return (
                <div 
                  key={workout.id}
                  ref={getTileRef(workout.id)}
                  onClick={isCreateMode ? () => handleWorkoutToggle(workout) : () => handleOpenWorkoutDetailFromGrid(workout)}
                  className={`group relative bg-[#111111] ${isSelected ? 'border-2 border-orange-500' : styles.border} rounded-[2rem] overflow-hidden flex flex-col ${isCreateMode || appMode === 'view' ? 'cursor-pointer active:scale-[0.98]' : 'active:scale-[0.98]'} hover:shadow-2xl hover:shadow-black/60 hover:-translate-y-1 hover:scale-[1.01] shadow-sm scale-100`}
                  style={{
                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s ease, box-shadow 0.3s ease',
                  }}
                >
                  {isSelected && (
                    <div className="absolute top-4 right-4 z-10 bg-orange-500 rounded-full p-2 shadow-lg">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  <div className="h-48 bg-black/40 overflow-hidden relative transition-all duration-500">
                    {workout.gifUrl ? (
                      <img 
                        src={workout.gifUrl} 
                        alt={workout.name}
                        className="w-full h-full object-cover group-hover:opacity-100 transition-opacity duration-300 opacity-60"
                        loading="lazy"
                      />
                      ) : (
                        <EmptyGifPlaceholder />
                      )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-transparent to-transparent"></div>
                    <div className="absolute top-4 left-4">
                      <WorkoutBadges
                        tag={workout.tag}
                        categoryStyles={styles}
                        variant="compact"
                      />
                    </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="text-xl font-bold mb-4 transition-colors duration-300 text-center group-hover:text-white">{workout.name}</h3>
                    
                    <div className="mt-auto">
                      {isCreateMode ? (
                        <div className={`w-full py-2.5 mt-2 ${isSelected ? 'bg-orange-600' : 'bg-gray-700'} text-white text-[10px] font-black rounded-2xl transition-all shadow-lg uppercase tracking-widest text-center`}>
                          {isSelected ? 'Selected' : 'Tap to Add'}
                        </div>
                      ) : (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenWorkoutDetailFromGrid(workout);
                          }}
                          className="w-full py-4 bg-gray-50 text-gray-800 text-[10px] font-black rounded-2xl transition-all shadow-md hover:shadow-lg hover:bg-gray-100 active:scale-95 uppercase tracking-widest text-center"
                        >
                          View
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Mobile: Bottom Sheet, Desktop: Modal */}
      {showSaveModal && (
        <>
          {isMobile ? (
            <SaveWorkoutBottomSheet
              isOpen={showSaveModal}
              onClose={closeSaveModal}
              workoutNameInput={workoutNameInput}
              setWorkoutNameInput={setWorkoutNameInput}
              onSave={handleSaveWorkoutConfirm}
              editingWorkoutId={editingWorkoutId}
              hasChanges={hasChanges}
            />
          ) : (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-3xl transition-all p-4 overflow-y-auto">
              <div className="bg-[#0d0d0d] border border-gray-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative">
                <button 
                  onClick={closeSaveModal}
                  className="absolute top-6 right-6 z-20 p-2 bg-black/60 hover:bg-gray-800 rounded-full transition-colors text-white border border-gray-800"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="p-6 md:p-8">
                  <h2 className="text-xl md:text-2xl font-bold mb-6">
                    {editingWorkoutId ? 'Update Workout' : 'Save Workout'}
                  </h2>
                  <input
                    type="text"
                    value={workoutNameInput}
                    onChange={(e) => setWorkoutNameInput(e.target.value)}
                    placeholder="Enter workout name..."
                    maxLength={50}
                    className="w-full px-4 py-3 bg-[#111111] border border-gray-800 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 mb-4 text-base"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveWorkoutConfirm();
                      }
                    }}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveWorkoutConfirm}
                      disabled={!workoutNameInput.trim() || (editingWorkoutId && !hasChanges)}
                      className={`flex-1 px-6 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 ${
                        editingWorkoutId && !hasChanges
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-700 disabled:cursor-not-allowed'
                      }`}
                    >
                      {editingWorkoutId ? 'Update' : 'Save'}
                    </button>
                    <button
                      onClick={closeSaveModal}
                      className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-2xl text-sm font-bold transition-all active:scale-95"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {selectedWorkout && (
        <WorkoutDetailModal
          workout={selectedWorkout}
          onClose={handleCloseWorkoutDetail}
          getCategoryStyles={getCategoryStyles}
        />
      )}

      {/* Checkmark Animation */}
      <CheckmarkAnimation
        isVisible={showCheckmarkAnimation}
        onComplete={handleCheckmarkAnimationComplete}
      />

      {/* Floating Action Button */}
      {isCreateMode && (
        <FloatingActionButton
          count={customWorkouts.length}
          onClick={toggleDrawer}
        />
      )}

      {/* Workout Routine Drawer */}
      {isCreateMode && (
        <WorkoutRoutineDrawer
          isOpen={isDrawerOpen}
          onClose={closeDrawer}
          workouts={customWorkouts}
          onRemove={handleRemoveWorkout}
          onClick={handleOpenWorkoutDetail}
          onSave={handleSaveWorkout}
          onClear={handleClearCustomWorkout}
          onReorder={handleReorderWorkouts}
          getCategoryStyles={getCategoryStyles}
          hasWorkoutChanges={hasWorkoutChanges}
          editingWorkoutId={editingWorkoutId}
          isMobile={isMobile}
        />
      )}
    </div>
  );
};

export default App;
