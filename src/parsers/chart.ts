/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable no-return-assign */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-mixed-operators */
/* eslint-disable no-loop-func */
/* eslint-disable no-plusplus */
/* eslint-disable require-unicode-regexp */
/* eslint-disable prefer-named-capture-group */
/* eslint-disable no-use-before-define */
/* eslint-disable max-classes-per-file */
import { createHash } from 'crypto'
import { readFile } from 'fs/promises'
import * as _ from 'lodash'

import { getEncoding } from './../helpers'
import { EventType, Instrument, NotesData, TrackEvent } from './../types/notes-data'
import { TrackParser } from './track'

/* eslint-disable @typescript-eslint/naming-convention */
type TrackName = keyof typeof trackNameMap
const trackNameMap = {
  ExpertSingle: { instrument: 'guitar', difficulty: 'expert' },
  HardSingle: { instrument: 'guitar', difficulty: 'hard' },
  MediumSingle: { instrument: 'guitar', difficulty: 'medium' },
  EasySingle: { instrument: 'guitar', difficulty: 'easy' },

  ExpertDoubleRhythm: { instrument: 'rhythm', difficulty: 'expert' },
  HardDoubleRhythm: { instrument: 'rhythm', difficulty: 'hard' },
  MediumDoubleRhythm: { instrument: 'rhythm', difficulty: 'medium' },
  EasyDoubleRhythm: { instrument: 'rhythm', difficulty: 'easy' },

  ExpertDoubleBass: { instrument: 'bass', difficulty: 'expert' },
  HardDoubleBass: { instrument: 'bass', difficulty: 'hard' },
  MediumDoubleBass: { instrument: 'bass', difficulty: 'medium' },
  EasyDoubleBass: { instrument: 'bass', difficulty: 'easy' },

  ExpertDrums: { instrument: 'drums', difficulty: 'expert' },
  HardDrums: { instrument: 'drums', difficulty: 'hard' },
  MediumDrums: { instrument: 'drums', difficulty: 'medium' },
  EasyDrums: { instrument: 'drums', difficulty: 'easy' },

  ExpertKeyboard: { instrument: 'keys', difficulty: 'expert' },
  HardKeyboard: { instrument: 'keys', difficulty: 'hard' },
  MediumKeyboard: { instrument: 'keys', difficulty: 'medium' },
  EasyKeyboard: { instrument: 'keys', difficulty: 'easy' },

  ExpertGHLGuitar: { instrument: 'guitarghl', difficulty: 'expert' },
  HardGHLGuitar: { instrument: 'guitarghl', difficulty: 'hard' },
  MediumGHLGuitar: { instrument: 'guitarghl', difficulty: 'medium' },
  EasyGHLGuitar: { instrument: 'guitarghl', difficulty: 'easy' },

  ExpertGHLBass: { instrument: 'bassghl', difficulty: 'expert' },
  HardGHLBass: { instrument: 'bassghl', difficulty: 'hard' },
  MediumGHLBass: { instrument: 'bassghl', difficulty: 'medium' },
  EasyGHLBass: { instrument: 'bassghl', difficulty: 'easy' }
} as const
/* eslint-enable @typescript-eslint/naming-convention */

class ChartParser {
  private notesData: NotesData

  private resolution: number
  private tempoMap: { tick: number; time: number; bpm: number }[]
  private timeSignatures: { tick: number; value: number }[]
  private trackSections: { [trackName in TrackName]: string[] }

  constructor (private fileSections: { [sectionName: string]: string[] }) {
    this.notesData = {
      instruments: [],
      hasSoloSections: false,
      hasLyrics: false,
      hasForcedNotes: false,
      hasTapNotes: false,
      hasOpenNotes: false,
      has2xKick: false,
      noteIssues: [],
      trackIssues: [],
      chartIssues: [],
      noteCounts: [],
      maxNps: [],
      hashes: [],
      tempoMapHash: '',
      tempoMarkerCount: 0,
      length: 0,
      effectiveLength: 0
    }

    this.resolution = this.getResolution()
    this.tempoMap = this.getTempoMap()
    this.timeSignatures = this.getTimeSignatures()
    this.trackSections = _.pick(this.fileSections, _.keys(trackNameMap) as TrackName[])
  }

  private getResolution () {
    const songSection = this.fileSections.Song ?? []
    const songSectionMap = this.getFileSectionMap(songSection)

    const resolution = parseInt(songSectionMap.Resolution, 10)
    if (!resolution) { this.notesData.chartIssues.push('noResolution') }
    return resolution
  }

  private getFileSectionMap (fileSection: string[]) {
    const fileSectionMap: { [key: string]: string } = {}
    for (const line of fileSection) {
      const [key, value] = line.split(' = ').map((s) => s.trim())
      fileSectionMap[key] = value.startsWith('"') ? value.slice(1, -1) : value
    }
    return fileSectionMap
  }

  private getTempoMap () {
    const tempoMap: { tick: number; time: number; bpm: number }[] = []
    const syncTrack = this.fileSections.SyncTrack ?? []
    for (const line of syncTrack) {
      const [, stringTick, stringBpm] = (/\s*(\d+) = B (\d+)/).exec(line) || []
      const tick = parseInt(stringTick, 10)
      const bpm = parseInt(stringBpm, 10) / 1000
      if (isNaN(tick) || isNaN(bpm)) { continue } // Not a bpm marker

      const lastMarker = _.last(tempoMap)
      let time = 0
      if (lastMarker) {
        // the "Resolution" parameter is the number of ticks in each beat, so `bpm * resolution` is the ticks per minute
        const msPerTickInRegion = 60000 / (lastMarker.bpm * this.resolution)
        time = lastMarker.time + (tick - lastMarker.tick) * msPerTickInRegion
      }

      tempoMap.push({ tick, time, bpm })
    }
    if (!tempoMap.length) { this.notesData.chartIssues.push('noSyncTrackSection') }
    return tempoMap
  }

  private getTimeSignatures () {
    const timeSignatures: { tick: number; value: number }[] = []
    const syncTrack = this.fileSections.SyncTrack ?? []
    for (const line of syncTrack) {
      const [, stringTick, stringNumerator, stringDenominatorExp] = (/\s*(\d+) = TS (\d+)(?: (\d+))?/).exec(line) || []
      const [tick, numerator] = [parseInt(stringTick, 10), parseInt(stringNumerator, 10)]
      const denominatorExp = stringDenominatorExp ? parseInt(stringDenominatorExp, 10) : 2
      if (isNaN(tick) || isNaN(numerator) || isNaN(denominatorExp)) { continue } // Not a time signature marker
      timeSignatures.push({ tick, value: numerator / 2 ** denominatorExp })
    }
    if (!timeSignatures.length) { this.notesData.chartIssues.push('noSyncTrackSection') }
    return timeSignatures
  }

  parse (): NotesData {
    if (!this.resolution || !this.tempoMap.length || !this.timeSignatures.length) { return this.notesData }

    const trackParsers = _.chain(this.trackSections).
      entries().
      map(([track, lines]) => new TrackParser(this.notesData, trackNameMap[track as TrackName].instrument, trackNameMap[track as TrackName].difficulty, this.parseTrackLines(lines, trackNameMap[track as TrackName].instrument), 'chart')).
      value()

    trackParsers.forEach((p) => p.parseTrack())

    const globalFirstNote = _.minBy(trackParsers, (p) => p.firstNote?.time ?? Infinity)?.firstNote ?? null
    const globalLastNote = _.maxBy(trackParsers, (p) => p.lastNote?.time ?? -Infinity)?.lastNote ?? null

    if (globalFirstNote === null || globalLastNote === null) {
      this.notesData.chartIssues.push('noNotes')
      return this.notesData
    }
    this.setEventsProperties()
    this.setMissingExperts()
    this.setTimeSignatureProperties()
    if (this.tempoMap.length === 1 && this.tempoMap[0].bpm === 120 && this.timeSignatures.length === 1) {
      this.notesData.chartIssues.push('isDefaultBPM')
    }

    // Add tempo map hash
    this.notesData.tempoMapHash = createHash('md5').
      update(this.tempoMap.map((t) => `${t.time}_${t.bpm}`).join(':')).
      update(this.timeSignatures.map((t) => t.value).join(':')).
      digest('hex')
    this.notesData.tempoMarkerCount = this.tempoMap.length

    // Add lengths
    this.notesData.length = Math.floor(globalLastNote.time)
    this.notesData.effectiveLength = Math.floor(globalLastNote.time - globalFirstNote.time)

    return this.notesData
  }

  private parseTrackLines (lines: string[], instrument: Instrument) {
    let lastBpmIndex = 0
    const trackEvents: TrackEvent[] = []

    for (const line of lines) {
      const parsedLine = _.chain(line).
        trim().
        thru((l) => (/^(\d+) = ([A-Z]+) ([\d\w]+) ?(\d+)?$/).exec(l) || [] as string[]).
        drop(1).
        thru((parts) => ({ tick: Number(parts[0]), typeCode: parts[1], value: parts[2], len: Number(parts[3]) })).
        value()

      // Update lastMarker to the closest BPM marker behind this note
      if (this.tempoMap[lastBpmIndex + 1] && parsedLine.tick >= this.tempoMap[lastBpmIndex + 1].tick) { lastBpmIndex++ }

      const time = this.timeFromTick(lastBpmIndex, parsedLine.tick)
      const length = parsedLine.len ? this.timeFromTick(lastBpmIndex, parsedLine.tick + parsedLine.len) - time : 0
      const type = this.getEventType(parsedLine.typeCode, parsedLine.value, instrument)
      if (type !== null) {
        trackEvents.push({ time, length, type })
      }
    }

    return trackEvents
  }

  private timeFromTick (lastBpmIndex: number, tick: number) {
    while (this.tempoMap[lastBpmIndex + 1] && this.tempoMap[lastBpmIndex + 1].tick < tick) {
      lastBpmIndex++
    }
    // the "Resolution" parameter is the number of ticks in each beat, so `bpm * resolution` is the ticks per minute
    const msPerTickInRegion = 60000 / (this.tempoMap[lastBpmIndex].bpm * this.resolution)
    return _.round(this.tempoMap[lastBpmIndex].time + ((tick - this.tempoMap[lastBpmIndex].tick) * msPerTickInRegion), 3)
  }

  private getEventType (typeCode: string, value: string, instrument: Instrument) {
    switch (typeCode) {
    case 'E': {
      switch (value) {
      case 'solo': return EventType.soloMarker
      default: return null
      }
    }
    case 'S': {
      switch (value) {
      case '2': return EventType.starPower
      case '64': return EventType.activationLane
      default: return null
      }
    }
    case 'N': {
      switch (instrument) {
      case 'drums': {
        switch (value) {
        case '0': return EventType.kick
        case '1': return EventType.red
        case '2': return EventType.yellow
        case '3': return EventType.blue
        case '4': return EventType.orange
        case '5': return EventType.green
        case '32': return EventType.kick2x
        default: return null
        }
      }
      case 'guitarghl':
      case 'bassghl': {
        switch (value) {
        case '0': return EventType.white1
        case '1': return EventType.white2
        case '2': return EventType.white3
        case '3': return EventType.black1
        case '4': return EventType.black2
        case '5': return EventType.force
        case '6': return EventType.tap
        case '7': return EventType.open
        case '8': return EventType.black3
        default: return null
        }
      }
      default: {
        switch (value) {
        case '0': return EventType.green
        case '1': return EventType.red
        case '2': return EventType.yellow
        case '3': return EventType.blue
        case '4': return EventType.orange
        case '5': return EventType.force
        case '6': return EventType.tap
        case '7': return EventType.open
        default: return null
        }
      }
      }
    }
    default: return null
    }
  }

  private setEventsProperties () {
    const events = this.fileSections.Events ?? []
    let hasSections = false
    for (const line of events) {
      if (line.includes('"lyric ')) { this.notesData.hasLyrics = true }
      if (line.includes('"section ')) { hasSections = true }
    }
    if (!hasSections) {
      this.notesData.chartIssues.push('noSections')
    }
  }

  private setMissingExperts () {
    const missingExperts = _.chain(this.trackSections as { [trackName: string]: string[] }).
      keys().
      map((key: TrackName) => trackNameMap[key]).
      // @ts-ignore
      groupBy((trackSection) => trackSection.instrument).
      // @ts-ignore
      mapValues((trackSections) => trackSections.map((trackSection) => trackSection.difficulty)).
      toPairs().
      filter(([, difficulties]) => !difficulties.includes('expert') && difficulties.length > 0).
      map(([instrument]) => instrument as Instrument).
      value()

    if (missingExperts.length > 0) {
      this.notesData.chartIssues.push('noExpert')
    }
  }

  private setTimeSignatureProperties () {
    let lastBeatlineTick = 0
    for (let i = 0; i < this.timeSignatures.length; i++) {
      if (lastBeatlineTick !== this.timeSignatures[i].tick) {
        this.notesData.chartIssues.push('misalignedTimeSignatures')
        break
      }
      while (this.timeSignatures[i + 1] && lastBeatlineTick < this.timeSignatures[i + 1].tick) {
        lastBeatlineTick += this.resolution * this.timeSignatures[i].value * 4
      }
    }
  }
}

export class ChartParserService {
  async parse (filepath: string): Promise<NotesData> {
    const chartBuffer = await readFile(filepath)
    const encoding = getEncoding(chartBuffer)
    const chartText = chartBuffer.toString(encoding)
    const fileSections = this.getFileSections(chartText) ?? {}
    return new ChartParser(fileSections).parse()
  }

  private getFileSections (chartText: string) {
    const sections: { [sectionName: string]: string[] } = {}
    let skipLine = false
    let readStartIndex = 0
    let readingSection = false
    let thisSection: string | null = null
    for (let i = 0; i < chartText.length; i++) {
      if (readingSection) {
        if (chartText[i] === ']') {
          readingSection = false
          thisSection = chartText.slice(readStartIndex, i)
        }
        if (chartText[i] === '\n') { return null }
        continue // Keep reading section until it ends
      }

      if (chartText[i] === '=') { skipLine = true } // Skip all user-entered values
      if (chartText[i] === '\n') { skipLine = false }
      if (skipLine) { continue } // Keep skipping until '\n' is found

      if (chartText[i] === '{') {
        skipLine = true
        readStartIndex = i + 1
      } else if (chartText[i] === '}') {
        if (!thisSection) { return null }
        // Trim each line because of Windows \r\n shenanigans
        sections[thisSection] = chartText.slice(readStartIndex, i).split('\n').map((line) => line.trim()).filter((line) => line.length)
      } else if (chartText[i] === '[') {
        readStartIndex = i + 1
        readingSection = true
      }
    }

    return sections
  }
}
