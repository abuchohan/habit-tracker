import { addDays, backupSchema, dateSchema, day, defaultPreferences, entryId, Habit, HabitRecord, palette, weekday } from './domain';

type SampleHabit = {
  slug: string; name: string; category: string; age: number; description: string;
  frequency?: [number, number]; days?: number[]; consistency?: number; archived?: boolean;
  target?: number; targetType?: Habit['targetType']; unit?: string; range?: [number, number]; precision?: number;
};

const samples: SampleHabit[] = [
  { slug: 'water', name: 'Drink water', category: 'Health', age: 210, description: 'Keep a bottle on the desk and refill it throughout the day.', target: 2, unit: 'litres', range: [1.1, 3.2], precision: 1 },
  { slug: 'sleep', name: 'Sleep for 8 hours', category: 'Health', age: 210, description: 'Track last night\'s sleep, including weekends.', target: 8, unit: 'hours', range: [5.5, 9.2], precision: 1 },
  { slug: 'steps', name: 'Walk 8,000 steps', category: 'Fitness', age: 200, description: 'Walk at lunch and take the longer route home.', target: 8000, unit: 'steps', range: [2200, 13500] },
  { slug: 'meditate', name: 'Morning meditation', category: 'Mindfulness', age: 180, description: 'Ten quiet minutes before opening messages.', consistency: 0.84 },
  { slug: 'read', name: 'Read a book', category: 'Learning', age: 195, description: 'Read before bed; paper books or an e-reader both count.', target: 20, unit: 'pages', range: [0, 45] },
  { slug: 'stretch', name: 'Evening stretch', category: 'Fitness', age: 120, description: 'A short mobility routine after work.', consistency: 0.72 },
  { slug: 'strength', name: 'Strength training', category: 'Fitness', age: 170, description: 'Alternate full-body sessions, allowing rest days.', frequency: [3, 7], days: [1, 3, 5], consistency: 0.88 },
  { slug: 'run', name: 'Go for a run', category: 'Fitness', age: 155, description: 'An easy midweek run and a longer weekend route.', frequency: [2, 7], days: [2, 6], consistency: 0.78 },
  { slug: 'vegetables', name: 'Eat vegetables', category: 'Health', age: 190, description: 'Aim for five portions across meals and snacks.', target: 5, unit: 'portions', range: [1, 7] },
  { slug: 'coffee', name: 'Limit coffee', category: 'Health', age: 100, description: 'Count cups, including the afternoon coffee.', target: 2, targetType: 'atMost', unit: 'cups', range: [0, 4] },
  { slug: 'screen', name: 'Limit social media', category: 'Mindfulness', age: 95, description: 'Use the daily screen-time report.', target: 45, targetType: 'atMost', unit: 'minutes', range: [10, 105] },
  { slug: 'journal', name: 'Write in my journal', category: 'Mindfulness', age: 160, description: 'A few sentences about the day are enough.', consistency: 0.67 },
  { slug: 'plan', name: 'Plan the day', category: 'Work', age: 175, description: 'Choose three priorities before starting work.', frequency: [5, 7], days: [1, 2, 3, 4, 5], consistency: 0.92 },
  { slug: 'focus', name: 'Focused work', category: 'Work', age: 165, description: 'Uninterrupted work with notifications turned off.', target: 90, unit: 'minutes', range: [15, 160], days: [1, 2, 3, 4, 5] },
  { slug: 'language', name: 'Practise Spanish', category: 'Learning', age: 145, description: 'A short lesson or conversation practice.', frequency: [5, 7], days: [0, 1, 2, 4, 6], consistency: 0.78 },
  { slug: 'guitar', name: 'Practise guitar', category: 'Learning', age: 80, description: 'Work on chord changes and one song.', target: 15, unit: 'minutes', range: [0, 35] },
  { slug: 'floss', name: 'Floss teeth', category: 'Health', age: 210, description: 'After brushing at night.', consistency: 0.9 },
  { slug: 'cook', name: 'Cook at home', category: 'Home', age: 140, description: 'Make dinner rather than ordering takeaway.', frequency: [4, 7], days: [0, 1, 3, 4], consistency: 0.82 },
  { slug: 'tidy', name: 'Ten-minute tidy', category: 'Home', age: 110, description: 'Reset the kitchen and living room before bed.', consistency: 0.75 },
  { slug: 'budget', name: 'Review spending', category: 'Money', age: 180, description: 'Check transactions and update the weekly budget.', frequency: [1, 7], days: [0], consistency: 0.89 },
  { slug: 'family', name: 'Call family', category: 'Relationships', age: 200, description: 'Make time for a proper catch-up on Sunday.', frequency: [1, 7], days: [0], consistency: 0.85 },
  { slug: 'outside', name: 'Get outside at lunchtime', category: 'Mindfulness', age: 21, description: 'A new routine: get daylight even on busy days.', consistency: 0.58 },
  { slug: 'no-spend', name: 'No impulse purchases', category: 'Money', age: 14, description: 'Give unplanned purchases a 24-hour pause.', consistency: 0.7 },
  { slug: 'weekly-distance', name: 'Weekly walking distance', category: 'Fitness', age: 60, description: 'Build towards 25 km over the whole week.', target: 25, unit: 'km', frequency: [1, 7], range: [0, 8], precision: 1 },
  { slug: 'cycle', name: 'Cycle to work', category: 'Fitness', age: 205, description: 'Summer commute; paused when the weather changed.', frequency: [3, 7], days: [1, 3, 5], consistency: 0.82, archived: true },
  { slug: 'course', name: 'Complete a course lesson', category: 'Learning', age: 185, description: 'Finished the photography course and kept the history.', frequency: [3, 7], days: [2, 4, 6], consistency: 0.88, archived: true },
  { slug: 'sugar', name: 'No sugary drinks', category: 'Health', age: 175, description: 'A completed challenge from earlier in the year.', consistency: 0.91, archived: true },
  { slug: 'applications', name: 'Work on job applications', category: 'Work', age: 150, description: 'Archived after starting a new role.', target: 30, unit: 'minutes', range: [0, 75], days: [1, 2, 3, 4, 5], archived: true },
];

// Stable per habit/date: no random IDs or wall-clock versions in the fixture.
function fraction(key: string) {
  let hash = 2166136261;
  for (const character of key) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}
function sampleVersion(date: string) { return `${Date.parse(`${date}T00:00:00Z`)}:demo`; }

/** The same snapshot is used for database seeding and the account-free backup. */
export function createDemoBackup(today = day()) {
  dateSchema.parse(today);
  const records: HabitRecord[] = [];
  samples.forEach((sample, order) => {
    const created = addDays(today, -sample.age + 1);
    dateSchema.parse(created);
    const id = `demo:${sample.slug}`;
    const habit: Habit = {
      id, kind: 'habit', version: sampleVersion(created), deleted: false,
      name: sample.name, question: `Did you ${sample.name.toLowerCase()}?`, description: sample.description,
      category: sample.category, color: palette[order % palette.length],
      type: sample.target === undefined ? 'boolean' : 'number', timeFormat: '24h',
      numerator: sample.frequency?.[0] ?? 1, denominator: sample.frequency?.[1] ?? 1,
      target: sample.target ?? 1, targetType: sample.targetType ?? 'atLeast', unit: sample.unit ?? '',
      created, archived: sample.archived ?? false, order,
      reminder: null, reminderDays: sample.days ?? [0, 1, 2, 3, 4, 5, 6], timezone: 'Europe/London',
    };
    records.push(habit);
    for (let ago = sample.age - 1; ago >= (sample.archived ? 60 : 0); ago--) {
      const date = addDays(today, -ago);
      const random = fraction(`${id}:${date}`);
      const recentStreak = sample.slug === 'floss' && ago >= 1 && ago <= 21;
      // Only some morning habits have been logged today; other cells remain editable and empty.
      if (ago === 0 && order > 3) continue;
      if (sample.days && !sample.days.includes(weekday(date))) continue;
      if (random < 0.07 && !recentStreak) continue; // Unlogged dates, distinct from explicit misses.
      const onHoliday = ago >= 38 && ago <= 44;
      const skip = !recentStreak && ((onHoliday && order % 3 !== 0) || random > 0.975);
      const unknown = !recentStreak && !skip && random < 0.09;
      let value: number | null = null;
      if (habit.type === 'number' && !skip && !unknown) {
        const [min, max] = sample.range!;
        const scale = 10 ** (sample.precision ?? 0);
        value = Math.round((min + fraction(`value:${id}:${date}`) * (max - min)) * scale) / scale;
      }
      const state = skip ? 'skip' : unknown ? 'unknown' : habit.type === 'number'
        ? ((habit.targetType === 'atMost' ? value! <= habit.target : value! >= habit.target) ? 'yes' : 'no')
        : recentStreak || random < (sample.consistency ?? 0.8) ? 'yes' : 'no';
      const notes = skip ? (onHoliday ? 'Away on holiday; pausing the usual routine.' : 'Taking a rest day.')
        : unknown ? 'Forgot to log this day.'
        : fraction(`note:${id}:${date}`) < 0.045
          ? state === 'yes' ? `Made time to ${sample.name.toLowerCase()}. Feeling good about the routine.` : 'A busy day; getting back to the routine tomorrow.'
          : '';
      records.push({ id: entryId(id, date), kind: 'entry', habitId: id, date, value, state, notes, deleted: false, version: sampleVersion(date) });
    }
  });
  return backupSchema.parse({ format: 'loop-web', version: 1, records, preferences: { ...defaultPreferences, skip: true, unknown: true } });
}
