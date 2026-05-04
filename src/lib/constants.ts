import type { DayName, DayConfig } from './types';

export const DAYS: DayName[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const DEFAULT_DAY_CONFIG: DayConfig = {
  Monday: 'home', Tuesday: 'home', Wednesday: 'home',
  Thursday: 'home', Friday: 'home', Saturday: 'home', Sunday: 'home',
};

export const HOUSEHOLD_ID_KEY = 'mp2_household_id';

export const P = {
  bg: '#FAFAF7', card: '#FFF',
  accent: '#E07A5F', accentLight: '#F4D1C7', accentDark: '#C25B3F',
  green: '#81B29A', greenLight: '#D4EDDA', greenDark: '#5A8A6E',
  gold: '#D4A017', goldLight: '#FEF3DC',
  text: '#2D3436', muted: '#636E72', border: '#E8E4DF',
  shadow: '0 2px 16px rgba(0,0,0,0.06)', shadowMd: '0 4px 24px rgba(0,0,0,0.10)',
} as const;
