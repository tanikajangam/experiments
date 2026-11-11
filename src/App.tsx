// Screen navigation. All data goes through src/store.ts; every number comes from src/lib/consistency.ts.
import { useEffect, useState } from 'react'
import { analyze, type DateKey } from './lib/consistency.ts'
import { seed } from './lib/seed.ts'
import { currentDay, store, useStore } from './store.ts'
import { Analysis } from './screens/Analysis.tsx'
import { Celebrate } from './screens/Celebrate.tsx'
import { Create } from './screens/Create.tsx'
import { BLANK_ANSWERS, Decide, summarize } from './screens/Decide.tsx'
import { Home } from './screens/Home.tsx'
import { Log } from './screens/Log.tsx'
import { Setup } from './screens/Setup.tsx'
import { Welcome } from './screens/Welcome.tsx'
import { haptic } from './ui.tsx'

export type Screen = 'welcome' | 'setup' | 'home' | 'create' | 'log' | 'analysis' | 'celebrate' | 'decide'
const SCREENS: Screen[] = ['welcome', 'setup', 'home', 'create', 'log', 'analysis', 'celebrate', 'decide']

interface Nav {
  screen: Screen
  selectedId: string
  logReturn: 'home' | 'analysis'
  /** What was tapped on Home before opening Log (the x opens it preset to "Not today"). */
  logPreset: boolean | null
  /** The Home row text right after a log, e.g. "43% → 29%". */
  flash: { id: string; text: string } | null
  dialOpen: boolean
}

/**
 * Start-screen links, as in the prototype's canvas: ?screen=home|welcome|setup|create|log|analysis|celebrate|decide,
 * plus &firstRun=1, &newUser=1 and &dial=1. Lets each canvas frame be opened directly to compare side by side.
 */
function startFromUrl(today: DateKey): Nav {
  const params = new URLSearchParams(window.location.search)
  const asked = params.get('screen') as Screen | null
  const start: Screen = asked && SCREENS.includes(asked) ? asked : 'home'
  const nav: Nav = { screen: start, selectedId: 'meals', logReturn: 'home', logPreset: null, flash: null, dialOpen: params.get('dial') === '1' }
  if (!asked && !params.has('firstRun') && !params.has('newUser')) return nav

  const firstRun = params.get('firstRun') === '1' || start === 'welcome' || start === 'setup'
  let experiments = firstRun ? [] : seed(today)
  if (!firstRun && params.get('newUser') === '1') experiments = experiments.filter((e) => e.id === 'meals')
  if (start === 'setup') {
    experiments = [{ id: 'first', title: 'Eat 3 meals a day', scheduleDays: [0, 1, 2, 3, 4, 5, 6], startDate: today, where: '', why: '', tracking: 'check', logs: {} }]
  }
  store.reset({ experiments, firstRun })
  nav.selectedId =
    start === 'setup' ? 'first' : start === 'decide' || start === 'celebrate' ? 'stretch' : start === 'analysis' ? 'gym' : start === 'log' ? 'retainer' : 'meals'
  return nav
}

/** Today's date, kept current across midnight and when the app comes back to the foreground. */
function useToday(): DateKey {
  const [today, setToday] = useState(currentDay)
  useEffect(() => {
    const check = () => setToday((prev) => (currentDay() === prev ? prev : currentDay()))
    const timer = window.setInterval(check, 30_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  return today
}

export default function App() {
  const today = useToday()
  const { experiments } = useStore()
  const [nav, setNav] = useState<Nav>(() => startFromUrl(today))
  const go = (patch: Partial<Nav>) => setNav((n) => ({ ...n, ...patch }))

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [nav.screen])

  const selected = experiments.find((e) => e.id === nav.selectedId) ?? experiments[0]
  const sel = selected ? analyze(selected, today) : null

  const goHome = () => go({ screen: 'home', dialOpen: false })
  const openAnalysis = (id: string) => go({ screen: 'analysis', selectedId: id })
  const openDecide = (id: string) => go({ screen: 'decide', selectedId: id })
  const openLog = (id: string, ret: 'home' | 'analysis', preset: boolean | null = null) => {
    const ex = experiments.find((e) => e.id === id)
    if (preset === false && ex && !ex.logs[today]) haptic('no')
    go({ screen: 'log', selectedId: id, logReturn: ret, logPreset: preset })
  }
  const writeLog = (id: string, done: boolean, note: string, ret: 'home' | 'analysis') => {
    const result = store.writeLog(id, done, note, today)
    if (!result) return go({ screen: ret })
    haptic(result.celebrate ? 'celebrate' : done ? 'yes' : 'tap')
    go({
      screen: result.celebrate ? 'celebrate' : ret,
      selectedId: result.celebrate ? id : nav.selectedId,
      flash: { id, text: result.flash },
    })
  }

  // Screens that need a selected experiment fall back to Home if there isn't one.
  const needsSel = nav.screen === 'log' || nav.screen === 'analysis' || nav.screen === 'celebrate' || nav.screen === 'decide' || nav.screen === 'setup'
  const screen = needsSel && !sel ? 'home' : nav.screen

  switch (screen) {
    case 'welcome':
      return (
        <div className="app">
          <Welcome
            onStart={() => {
              store.setFirstRun(true)
              go({ screen: 'create' })
            }}
          />
        </div>
      )
    case 'setup':
      return (
        <div className="app">
          <Setup
            title={sel!.title}
            onFinish={() => {
              store.setFirstRun(false)
              goHome()
            }}
          />
        </div>
      )
    case 'create':
      return (
        <div className="app">
          <Create
            today={today}
            onBack={() => go({ screen: store.getState().firstRun ? 'welcome' : 'home' })}
            onCreated={(id) => go({ screen: store.getState().firstRun ? 'setup' : 'home', selectedId: id, flash: null })}
          />
        </div>
      )
    case 'log': {
      const log = sel!.ex.logs[today]
      return (
        <div className="app">
          <Log
            key={sel!.ex.id}
            a={sel!}
            today={today}
            initialDone={log ? log.done : nav.logPreset}
            initialNote={log?.note ?? ''}
            onBack={() => go({ screen: nav.logReturn })}
            onSubmit={(done, note) => writeLog(sel!.ex.id, done, note, nav.logReturn)}
            onClear={() => {
              store.clearLog(sel!.ex.id, today)
              go({ screen: nav.logReturn, flash: null })
            }}
          />
        </div>
      )
    }
    case 'analysis':
      return (
        <div className="app">
          <Analysis
            key={sel!.ex.id}
            a={sel!}
            onBack={goHome}
            onLog={() => openLog(sel!.ex.id, 'analysis')}
            onDecide={() => openDecide(sel!.ex.id)}
          />
        </div>
      )
    case 'celebrate':
      return (
        <div className="app">
          <Celebrate a={sel!} onClose={goHome} onReflect={() => openDecide(sel!.ex.id)} />
        </div>
      )
    case 'decide': {
      const ex = experiments.find((e) => e.id === sel!.ex.id)
      return (
        <div className="app">
          <Decide
            key={sel!.ex.id}
            a={sel!}
            initial={ex?.decision?.answers ?? BLANK_ANSWERS}
            onBack={goHome}
            onDecide={(outcome, answers) => {
              haptic('tap')
              store.decide(sel!.ex.id, outcome, answers, summarize(answers), today)
              goHome()
            }}
          />
        </div>
      )
    }
    default:
      return (
        <div className="app">
          <Home
            today={today}
            flash={nav.flash}
            dialStartsOpen={nav.dialOpen}
            onOpen={openAnalysis}
            onQuickYes={(id) => writeLog(id, true, '', 'home')}
            onNo={(id) => openLog(id, 'home', false)}
            onEdit={(id) => openLog(id, 'home')}
            onDecide={openDecide}
            onCreate={() => go({ screen: 'create' })}
          />
        </div>
      )
  }
}
