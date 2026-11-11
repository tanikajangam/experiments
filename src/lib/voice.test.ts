/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COST, EFFORT, SURVIVE } from './decision.ts'
import { audioFormat, parseReply, prompt, sanitize, schema } from './voice.ts'

describe('voice: audio formats', () => {
  it('iPhone’s audio/mp4 is sent as m4a; webm and ogg as themselves', () => {
    expect(audioFormat('audio/mp4')).toBe('m4a')
    expect(audioFormat('audio/mp4;codecs=mp4a.40.2')).toBe('m4a')
    expect(audioFormat('audio/webm;codecs=opus')).toBe('webm')
    expect(audioFormat('audio/ogg;codecs=opus')).toBe('ogg')
    expect(audioFormat('video/mp4')).toBeNull()
  })
})

describe('voice: the Decide prompt', () => {
  it('is the design doc’s prompt, word for word', () => {
    const doc = readFileSync(join(process.cwd(), 'design/system-design.md'), 'utf8')
    const block = doc.split('```markdown\n').find((b) => b.startsWith('You are filling a form'))!.split('\n```')[0]
    expect(prompt('decide', 'it got easier')).toBe(block.replace('{transcript}', 'it got easier'))
  })

  it('the schema only allows the chips on screen', () => {
    const p = schema('decide').properties as Record<string, { anyOf: { enum?: string[]; items?: { enum: string[] } }[] }>
    expect(p.effort.anyOf[0].enum).toEqual([...EFFORT])
    expect(p.survive.anyOf[0].enum).toEqual([...SURVIVE])
    expect(p.cost.anyOf[0].items!.enum).toEqual([...COST])
    expect(schema('decide').required).toEqual(['effort', 'survive', 'cost', 'cost_note', 'change'])
  })
})

describe('voice: cleaning the model’s answer', () => {
  it('the done-when sentence’s answer fills Around the middle, Yes and Energy', () => {
    expect(sanitize('decide', { effort: 'Around the middle', survive: 'Yes', cost: ['Energy'], cost_note: 'some sleep', change: null })).toEqual({
      effort: 'Around the middle',
      survive: 'Yes',
      cost: ['Energy'],
      cost_note: 'some sleep',
      change: null,
    })
  })

  it('keeps only allowed chip values, whatever the model sends', () => {
    const f = sanitize('decide', { effort: 'week three', survive: 'yes', cost: ['Energy', 'Money', 'energy', 'Not much'], change: '  ', cost_note: 'null' })
    expect(f).toEqual({ effort: null, survive: 'Yes', cost: ['Energy'], cost_note: null, change: null })
  })

  it('a reply that isn’t an object leaves every field empty', () => {
    expect(sanitize('decide', null)).toEqual({ effort: null, survive: null, cost: null, cost_note: null, change: null })
    expect(sanitize('log', 'yes')).toEqual({ done: null, note: null })
  })

  it('New Experiment: days are whole numbers 0–6, once each, in order', () => {
    expect(sanitize('create', { title: ' Read  10 pages ', schedule_days: [5, 1, 3, 3, 7, -1, 2.5], where: 'On the train', why: null })).toEqual({
      title: 'Read 10 pages',
      schedule_days: [1, 3, 5],
      where: 'On the train',
      why: null,
    })
    expect(sanitize('create', { schedule_days: [] }).schedule_days).toBeNull()
  })

  it('Log: yes or no only when said', () => {
    expect(sanitize('log', { done: false, note: 'Too tired after work.' })).toEqual({ done: false, note: 'Too tired after work.' })
    expect(sanitize('log', { done: 'yes', note: '' })).toEqual({ done: null, note: null })
  })

  it('reads a reply wrapped in a ```json fence', () => {
    expect(parseReply('```json\n{"done": true}\n```')).toEqual({ done: true })
    expect(parseReply('not json')).toBeNull()
  })
})
