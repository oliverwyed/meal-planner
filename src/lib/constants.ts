import type { DayName, DayConfig } from './types';

export const DAYS: DayName[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const DEFAULT_DAY_CONFIG: DayConfig = {
  Monday: 'home', Tuesday: 'home', Wednesday: 'home',
  Thursday: 'home', Friday: 'home', Saturday: 'home', Sunday: 'home',
};

export const HOUSEHOLD_ID_KEY = 'mp2_household_id';

export const P = {
  bg: '#F8FAFC', card: '#FFFFFF',
  accent: '#4F46E5', accentLight: '#EEF2FF', accentDark: '#3730A3',
  green: '#059669', greenLight: '#D1FAE5', greenDark: '#065F46',
  gold: '#D97706', goldLight: '#FEF3C7',
  text: '#0F172A', muted: '#64748B', border: '#E2E8F0',
  shadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
  shadowMd: '0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
} as const;
