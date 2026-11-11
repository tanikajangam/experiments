// The prototype's seed data (design/prototype.dc.html, `seed`), built relative to `today`.
// Used by the tests and, until step 4, by the store.
import { addDays, occasions, weekday, type DateKey, type Experiment, type Weekday } from './consistency.ts'

interface SeedNote {
  /** 0 = the most recent past scheduled day, 1 = the one before, … */
  ago: number
  text: string
}

export function seed(today: DateKey): Experiment[] {
  const mk = (
    id: string,
    title: string,
    days: Weekday[],
    ago: number,
    missedFromEnd: number[],
    where: string,
    why: string,
    notes: SeedNote[],
    todayDone?: boolean,
  ): Experiment => {
    const ex: Experiment = {
      id,
      title,
      scheduleDays: days,
      startDate: addDays(today, -ago),
      where,
      why,
      tracking: 'check',
      logs: {},
    }
    const all = occasions(ex, today)
    const past = all.filter((d) => d < today)
    past.forEach((d, i) => {
      ex.logs[d] = { done: !missedFromEnd.includes(past.length - 1 - i), note: '' }
    })
    for (const n of notes) {
      const d = past[past.length - 1 - n.ago]
      if (d && ex.logs[d]) ex.logs[d].note = n.text
    }
    if (todayDone !== undefined && all.includes(today)) ex.logs[today] = { done: todayDone, note: '' }
    return ex
  }

  const every = [0, 1, 2, 3, 4, 5, 6]
  const sinceMonday = (weekday(today) + 6) % 7
  return [
    mk('meals', 'Eat 3 meals a day', every, Math.min(3, sinceMonday), [1], 'Home and at work', 'Stop skipping lunch and crashing at 4 pm.', [
      { ago: 0, text: 'Breakfast, lunch at my desk, dinner with my bf.' },
      { ago: 1, text: 'Back-to-back meetings, only ate once.' },
    ]),
    mk('retainer', 'Wear retainer', every, 27, [0, 1, 3, 5, 9, 10, 14, 15, 18, 22], 'Bedroom, before sleep', 'Keep my teeth where the braces put them.', []),
    mk('gym', 'Gym session', [1, 3, 4], 38, [1, 4, 9], 'Gym near work', 'Feel strong and sleep better.', [
      { ago: 0, text: 'Legs. Felt strong.' },
    ]),
    mk('wake', 'Wake up at 5:30', [1, 2, 3, 4, 5], 60, [11, 19, 30], 'Home', '', [], true),
    mk('stretch', 'Stretch before bed', every, 64, [2, 9, 15, 16, 31, 40, 52], 'Bedroom floor', 'Wind down without my phone.', [
      { ago: 0, text: 'Did not even think about it, just did it.' },
    ]),
    mk('grandma', 'Call grandma', [2, 6], 49 + sinceMonday, [3], 'Walk home from work', '', []),
  ]
}
