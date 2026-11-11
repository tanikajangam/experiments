// The mic on the screens, with a fake recorder and a fake server.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { analyze } from './lib/consistency.ts'
import { BLANK_ANSWERS } from './lib/decision.ts'
import { seed } from './lib/seed.ts'
import { Create } from './screens/Create.tsx'
import { Decide } from './screens/Decide.tsx'
import { store } from './store.ts'
import { fakeBackend, fakeCache } from './test/fakes.ts'

const TODAY = '2026-11-10'
const trackStop = vi.fn()

class FakeRecorder {
  static isTypeSupported = (t: string) => t === 'audio/mp4' // like an iPhone
  state: 'inactive' | 'recording' = 'inactive'
  mimeType: string
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  constructor(_stream: unknown, opts?: { mimeType?: string }) {
    this.mimeType = opts?.mimeType ?? ''
  }
  start() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob([new Uint8Array(4000)], { type: this.mimeType }) })
    this.onstop?.()
  }
}

beforeEach(() => {
  trackStop.mockClear()
  vi.stubGlobal('MediaRecorder', FakeRecorder)
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: trackStop }] })) },
  })
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone: 'UTC' } as Intl.ResolvedDateTimeFormatOptions)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  window.scrollTo = () => {}
})
afterEach(() => vi.unstubAllGlobals())

async function live() {
  const { fake, backend } = fakeBackend()
  await act(() => store.start(backend, fakeCache()))
  return fake
}

function renderDecide() {
  const ex = seed(TODAY).find((e) => e.id === 'stretch')!
  const a = analyze({ ...ex, logs: { ...ex.logs, [TODAY]: { done: true } } }, TODAY)
  return render(<Decide a={a} initial={BLANK_ANSWERS} onBack={() => {}} onDecide={() => {}} />)
}

describe('voice: the mic', () => {
  it('Decide: tap to listen (red, stop square, timer), tap to stop, and the chips fill in', async () => {
    const fake = await live()
    fake.voice.decide = { effort: 'Around the middle', survive: 'Yes', cost: ['Energy'], cost_note: 'some sleep', change: null }
    renderDecide()

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Answer all four by voice' })))
    const stop = screen.getByRole('button', { name: 'Stop recording' })
    expect(stop).toHaveAttribute('aria-pressed', 'true')
    expect(stop).toHaveStyle('background: #96371C')
    expect(screen.getByRole('status')).toHaveTextContent('Listening… 0:00')

    await act(async () => fireEvent.click(stop))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Around the middle' })).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Energy' })).toHaveAttribute('aria-pressed', 'true')
    expect(fake.voiceCalls).toEqual([{ form: 'decide', format: 'm4a', bytes: expect.any(Number) }])
    expect(trackStop).toHaveBeenCalled() // the microphone is released
    expect(screen.getByRole('button', { name: 'Answer all four by voice' })).toHaveStyle('background: #2F7A4B')
  })

  it('says what went wrong, and fills nothing', async () => {
    await live() // the fake server has no answer for decide
    renderDecide()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Answer all four by voice' })))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Stop recording' })))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Didn’t catch anything.'))
    expect(screen.getByRole('button', { name: 'Around the middle' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('New Experiment: fills title, days, where and why, and doesn’t start it', async () => {
    const fake = await live()
    fake.voice.create = { title: 'Read 10 pages', schedule_days: [1, 3, 5], where: 'On the train', why: null }
    render(<Create today={TODAY} onBack={() => {}} onCreated={() => {}} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Describe your experiment by voice' })))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Stop recording' })))
    await waitFor(() => expect(screen.getByLabelText('Experiment title')).toHaveValue('Read 10 pages'))
    expect(screen.getByLabelText('Monday')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Tuesday')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByLabelText('Where?')).toHaveValue('On the train')
    expect(store.getState().experiments).toHaveLength(0)
  })

  it('leaving the screen while listening turns the microphone off', async () => {
    await live()
    const { unmount } = renderDecide()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Answer all four by voice' })))
    unmount()
    expect(trackStop).toHaveBeenCalled()
  })

  it('on a ?screen= preview link, explains that voice needs the signed-in app', async () => {
    window.history.replaceState(null, '', '/?screen=create')
    render(<App />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Describe your experiment by voice' })))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Stop recording' })))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Voice works in the signed-in app'))
    window.history.replaceState(null, '', '/')
  })
})
