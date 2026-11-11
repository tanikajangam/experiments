// Step 8: export, the offline indicator, the save-failed toast and the update prompt.
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { buildExport, exportFileName } from './lib/exportData.ts'
import { seed } from './lib/seed.ts'
import { SyncNotices, UpdatePrompt } from './screens/Overlays.tsx'
import { store } from './store.ts'

const TODAY = '2026-11-10'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0))
  store.reset({ experiments: seed(TODAY) })
  window.history.replaceState(null, '', '/')
  window.scrollTo = () => {}
})

describe('export', () => {
  it('has every experiment, every log in date order, and decisions', () => {
    const file = buildExport({ experiments: seed(TODAY), reminder: { on: true, time: '20:00' } }, new Date('2026-11-10T17:00:00Z'))
    expect(file).toMatchObject({ app: 'Experiments', version: 1, exportedAt: '2026-11-10T17:00:00.000Z' })
    expect(file.experiments).toHaveLength(seed(TODAY).length)
    const gym = file.experiments.find((e) => e.title === 'Gym session')!
    expect(gym.logs.length).toBe(Object.keys(seed(TODAY).find((e) => e.id === 'gym')!.logs).length)
    expect(gym.logs.map((l) => l.day)).toEqual([...gym.logs.map((l) => l.day)].sort())
    expect(exportFileName(TODAY)).toBe('experiments-2026-11-10.json')
  })

  it('the button on Analysis hands the file to the share sheet (Save to Files on iPhone)', async () => {
    const share = vi.fn(async () => {})
    Object.assign(navigator, { share, canShare: () => true })
    window.history.replaceState(null, '', '/?screen=analysis')
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Export all my data' }))
    expect(share).toHaveBeenCalledTimes(1)
    const file = (share.mock.calls[0] as unknown as [{ files: File[] }])[0].files[0]
    expect(file.name).toBe('experiments-2026-11-10.json')
    const data = JSON.parse(await file.text())
    expect(data.experiments.map((e: { title: string }) => e.title)).toContain('Gym session')
  })
})

describe('offline indicator and toasts', () => {
  it('offline: a pill says so, with how many changes are waiting on the phone', () => {
    store.reset({ offline: true, pending: 2 })
    render(<SyncNotices online={false} />)
    expect(screen.getByRole('status')).toHaveTextContent('Offline · 2 changes saved on this phone')
  })

  it('online and synced: nothing shows', () => {
    render(<SyncNotices online />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a failed save offers Retry; a refused one just OK', async () => {
    const retry = vi.spyOn(store, 'retry').mockResolvedValue()
    store.reset({ problem: { kind: 'failed', message: 'Couldn’t save to the server. Your change is kept on this phone.' } })
    const { unmount } = render(<SyncNotices online />)
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t save to the server.')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retry).toHaveBeenCalled()
    unmount()

    store.reset({ problem: { kind: 'rejected', message: 'The server refused a change' } })
    render(<SyncNotices online />)
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    act(() => fireEvent.click(screen.getByRole('button', { name: 'OK' })))
    expect(store.getState().problem).toBeNull()
  })

  it('update prompt: Update installs the new version, Later hides it', () => {
    const onUpdate = vi.fn()
    const onLater = vi.fn()
    render(<UpdatePrompt onUpdate={onUpdate} onLater={onLater} />)
    expect(screen.getByRole('alert')).toHaveTextContent('A new version of the app is ready.')
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))
    fireEvent.click(screen.getByRole('button', { name: 'Later' }))
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onLater).toHaveBeenCalledTimes(1)
  })
})
