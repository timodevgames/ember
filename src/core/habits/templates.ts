import type { Category, Habit } from '../../db/types';

export type HabitTemplate = Pick<Habit, 'name' | 'icon' | 'category' | 'kind' | 'target' | 'unit' | 'schedule' | 'difficulty' | 'autoSource'> & {
  key: string;
  blurb: string;
};

export const TEMPLATES: HabitTemplate[] = [
  { key: 'piano', name: 'Play piano', icon: '🎹', category: 'music', kind: 'duration', target: 15, unit: 'min', schedule: { type: 'daily' }, difficulty: 'medium', autoSource: 'musicCoach', blurb: '15 min a day · counts Music Coach sessions later' },
  { key: 'valorant', name: 'Play Valorant', icon: '🎯', category: 'gaming', kind: 'check', target: 1, schedule: { type: 'daily' }, difficulty: 'easy', autoSource: 'valorant', blurb: 'At least one match · auto-check later' },
  { key: 'gd', name: 'Geometry Dash', icon: '🔺', category: 'gaming', kind: 'check', target: 1, schedule: { type: 'daily' }, difficulty: 'easy', autoSource: 'geometryDash', blurb: 'Practice runs count · auto-check on new stars later' },
  { key: 'water', name: 'Drink water', icon: '💧', category: 'body', kind: 'count', target: 8, unit: 'glasses', schedule: { type: 'daily' }, difficulty: 'easy', blurb: '8 glasses' },
  { key: 'workout', name: 'Workout', icon: '💪', category: 'body', kind: 'check', target: 1, schedule: { type: 'perWeek', times: 3 }, difficulty: 'hard', blurb: '3× per week' },
  { key: 'stretch', name: 'Stretch', icon: '🧘', category: 'body', kind: 'duration', target: 10, unit: 'min', schedule: { type: 'daily' }, difficulty: 'easy', blurb: '10 min' },
  { key: 'read', name: 'Read', icon: '📚', category: 'mind', kind: 'duration', target: 15, unit: 'min', schedule: { type: 'daily' }, difficulty: 'medium', blurb: '15 min' },
  { key: 'study', name: 'Homework / study', icon: '📝', category: 'mind', kind: 'duration', target: 30, unit: 'min', schedule: { type: 'weekdays', days: [0, 1, 2, 3, 4] }, difficulty: 'medium', blurb: '30 min on school days' },
  { key: 'sleep', name: 'In bed before 23:00', icon: '🛏️', category: 'body', kind: 'check', target: 1, schedule: { type: 'daily' }, difficulty: 'medium', blurb: 'Sleep is muscle growth too' },
  { key: 'walk', name: 'Walk 8k steps', icon: '🚶', category: 'body', kind: 'check', target: 1, schedule: { type: 'daily' }, difficulty: 'easy', blurb: 'Daily movement' },
];

export const CATEGORIES: Record<Category, { label: string; icon: string; color: string }> = {
  music: { label: 'Music', icon: '🎵', color: '#a78bfa' },
  gaming: { label: 'Gaming', icon: '🎮', color: '#60a5fa' },
  body: { label: 'Body', icon: '💪', color: '#34d399' },
  mind: { label: 'Mind', icon: '🧠', color: '#fbbf24' },
  other: { label: 'Other', icon: '✨', color: '#f472b6' },
};

export const AUTO_SOURCES = {
  musicCoach: { label: 'Music Coach', icon: '🎹' },
  valorant: { label: 'Valorant match history', icon: '🎯' },
  geometryDash: { label: 'Geometry Dash profile', icon: '🔺' },
} as const;
