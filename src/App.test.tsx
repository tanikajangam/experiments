import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { seed } from './lib/seed.ts'
import { store } from './store.ts'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0)) // Tue 10 Nov 2026, noon local time
  store.reset({ experiments: seed('2026-11-10'), firstRun: false, reminder: { on: true, time: '20:00' } })
  window.history.replaceState(null, '', '/')
  window.scrollTo = () => {}
})
afterEach(() => vi.useRealTimers())

const todayRow = (title: string) => screen.getByRole('button', { name: `Edit today’s log: ${title}` })

describe('App', () => {
  it('shows the "Tanki’s Experiments" heading styled as in the prototype', () => {
    render(<App />)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('Tanki’s Experiments')
    // Prototype home h1: margin 0; font-size 34px; font-weight 500; line-height 1.2; color #4B5B4F
    expect(h1.style.margin).toBe('0px')
    expect(h1.style.fontSize).toBe('34px')
    expect(h1.style.fontWeight).toBe('500')
    expect(h1.style.lineHeight).toBe('1.2')
    expect(h1).toHaveStyle('color: #4B5B4F')
    expect(screen.getByText('Experiments')).toHaveStyle('color: #4E6B3A')
  })

  it('Home lists today’s experiments and the four tiers', () => {
    render(<App />)
    expect(screen.getByText('Tuesday, Nov 10')).toBeInTheDocument()
    expect(screen.getByText('1/5 logged')).toBeInTheDocument()
    for (const name of ['New Habits', 'Inconsistent Habits', 'Semimature Habits', 'Mature Habits']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Wear retainer, 43%, Day 28/65' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gym session, 71%, Day 39/65' })).toBeInTheDocument()
  })

  it('the one-tap check logs today and the row shows the change', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Done today: Eat 3 meals a day' }))
    expect(within(todayRow('Eat 3 meals a day')).getByText('Done')).toBeInTheDocument()
    expect(within(todayRow('Eat 3 meals a day')).getByText('1/7 → 2/7')).toBeInTheDocument()
  })

  it('the x opens Log preset to Not today; logging the miss shows "43% → 29%" on the row', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Not today: Wear retainer' }))
    expect(screen.getByRole('button', { name: /Not today/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('43% → 29%')).toBeInTheDocument() // the Log preview
    fireEvent.click(screen.getByRole('button', { name: 'Log the miss' }))
    expect(within(todayRow('Wear retainer')).getByText('Missed')).toBeInTheDocument()
    expect(within(todayRow('Wear retainer')).getByText('43% → 29%')).toBeInTheDocument()
  })

  it('logging yes on day 65 opens the celebration, then Decide, and tracking stops', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Done today: Stretch before bed' }))
    expect(screen.getByText('You actually did it.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reflect on it' }))
    fireEvent.click(screen.getByRole('button', { name: 'Around the middle' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(screen.getByRole('heading', { name: 'Decided' })).toBeInTheDocument()
    expect(screen.getByText('Kept on Tue, Nov 10')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /today: Stretch before bed/ })).toBeNull()
  })

  it('a new experiment can be started from Home', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /New Experiment/ }))
    expect(screen.getByText('1/3 new experiments started this week')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Experiment title'), { target: { value: 'Read 10 pages' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start experiment' }))
    expect(screen.getByRole('button', { name: 'Read 10 pages, 0/7 tracked, Day 1/65' })).toBeInTheDocument()
  })

  it('on Create, the mic sits in the bottom bar next to Start experiment, under the thumb', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /New Experiment/ }))
    const mic = screen.getByRole('button', { name: 'Describe your experiment by voice' })
    const start = screen.getByRole('button', { name: 'Start experiment' })
    expect(mic.parentElement).toBe(start.parentElement)
    expect(start.compareDocumentPosition(mic) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('the first run goes Welcome → first experiment → reminder → Home', () => {
    window.history.replaceState(null, '', '/?screen=welcome')
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Start my first experiment' }))
    expect(screen.getByText('experiment')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Eat 3 meals a day' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start experiment' }))
    expect(screen.getByText('When should I nudge you to log?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Morning/ }))
    fireEvent.click(screen.getByRole('button', { name: 'See my experiment' }))
    expect(screen.getByRole('button', { name: 'Daily reminder, 8:00 am' })).toBeInTheDocument()
  })

  it('the bell opens the reminder dial', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Daily reminder, 8:00 pm' }))
    expect(screen.getByText('Daily reminder')).toBeInTheDocument()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Turn off' }))
    })
    expect(screen.getByText('Off')).toBeInTheDocument()
  })
})
