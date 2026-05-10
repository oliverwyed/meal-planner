import type { Plan } from './types';
import { scaledIngredients } from './shopping';

const DAY_OFFSET: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

function nextDateForDayName(dayName: string): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = DAY_OFFSET[dayName] ?? 0;
  const diff = (target - today.getDay() + 7) % 7;
  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  return d;
}

function toICSDate(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function foldLine(line: string): string {
  // RFC 5545: fold lines longer than 75 octets
  let out = '';
  while (line.length > 75) {
    out += line.slice(0, 75) + '\r\n ';
    line = line.slice(75);
  }
  return out + line;
}

function escapeICS(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function generateICS(plan: Plan, familySize: number): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Family Meal Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  const uid = Date.now();

  plan.meals.forEach((meal, i) => {
    const d = nextDateForDayName(meal.day);
    const nd = new Date(d);
    nd.setDate(d.getDate() + 1);

    const scale = familySize / (meal.serves || 4);
    const ing = scaledIngredients(meal.ingredients ?? [], scale);

    const descParts: string[] = [];
    if (meal.description) descParts.push(meal.description);
    if (ing.length) {
      descParts.push('', `INGREDIENTS (serves ${familySize}):`);
      ing.forEach(x => descParts.push(`• ${x.display}`));
    }
    if (meal.steps?.length) {
      descParts.push('', 'RECIPE:');
      meal.steps.forEach((s, n) => descParts.push(`${n + 1}. ${s}`));
    }
    if (meal.tip) descParts.push('', `CHEF'S TIP: ${meal.tip}`);

    const raw = escapeICS(descParts.join('\n'));

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:meal-${uid}-${i}@mealplanner`);
    lines.push(`SUMMARY:Dinner: ${meal.name}`);
    lines.push(`DTSTART;VALUE=DATE:${toICSDate(d)}`);
    lines.push(`DTEND;VALUE=DATE:${toICSDate(nd)}`);
    lines.push(foldLine(`DESCRIPTION:${raw}`));
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(plan: Plan, familySize: number): void {
  const content = generateICS(plan, familySize);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'meal-plan.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
