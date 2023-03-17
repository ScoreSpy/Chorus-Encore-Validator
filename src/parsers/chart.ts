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
import { Difficulty, Instrument, NoteIssue, NoteIssueType, NotesData, TrackIssueType } from './../types/notes-data'

const LEADING_SILENCE_THRESHOLD_MS = 1000
const MIN_SUSTAIN_GAP_MS = 40
const MIN_SUSTAIN_MS = 100
const NPS_GROUP_SIZE_MS = 1000

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


class TrackParser {
  private instrument: Instrument
  private difficulty: Difficulty

  private ungroupedNotes: { tick: number; note: number; endTick: number }[]
  private groupedNotes: { tick: number; note: number[] }[]

  private noteIssues: NoteIssue[] = []
  private trackIssues: TrackIssueType[] = []

  constructor (
    private notesData: NotesData,
    track: TrackName,
    private lines: string[],
    private resolution: number,
    private tempoMap: { tick: number; bpm: number }[]
  ) {
    this.instrument = trackNameMap[track].instrument
    this.difficulty = trackNameMap[track].difficulty
    if (!notesData.instruments.includes(this.instrument)) { notesData.instruments.push(this.instrument) }

    this.ungroupedNotes = _.chain(this.lines).
      map((line) => {
        const result = (/(\d+) = N (\d+) (\d+)/).exec(line) || []
        return {
          tick: parseInt(result[1], 10),
          note: parseInt(result[2], 10),
          endTick: parseInt(result[1], 10) + parseInt(result[3], 10)
        }
      }).
      filter((line) => !isNaN(line.tick) && !isNaN(line.note)). // Keep only regular notes and note modifiers
      value()

    this.groupedNotes = _.chain(this.ungroupedNotes).
      groupBy((note) => note?.tick).
      values().
      map((noteGroup) => ({
        tick: noteGroup[0].tick,
        note: noteGroup.map((note) => note.note)
      })).
      value()
  }

  public get firstNote () { return _.first(this.groupedNotes) ?? null }
  public get lastNote () { return _.last(this.groupedNotes) ?? null }

  private addNoteIssue (issueType: NoteIssueType, tick: number) { this.noteIssues.push({ issueType, tick, time: 0 }) }
  private addTrackIssue (issueType: TrackIssueType) { this.trackIssues.push(issueType) }

  public parseTrack () {
    if (this.instrument === 'drums') {
      this.parseDrumTrack()
    } else {
      this.parseNonDrumTrack()
    }

    // Add notes hash
    this.notesData.hashes.push({
      instrument: this.instrument,
      difficulty: this.difficulty,
      hash: createHash('md5').update(this.lines.join('')).digest('hex')
    })

    // Add tempo map hash
    this.notesData.tempoMapHash = createHash('md5').update(this.tempoMap.map((t) => `${t.tick}_${t.bpm}`).join(':')).digest('hex')
    this.notesData.tempoMarkerCount = this.tempoMap.length

    // Add note count
    this.notesData.noteCounts.push({ instrument: this.instrument, difficulty: this.difficulty, count: this.groupedNotes.length })

    // Check for broken notes (note: false positives are possible)
    for (let i = 1; i < this.groupedNotes.length; i++) {
      const distance = this.groupedNotes[i].tick - this.groupedNotes[i - 1].tick
      if (distance > 0 && distance < 5) {
        this.addNoteIssue('brokenNote', this.groupedNotes[i].tick)
      }
    }

    if (this.noteIssues.length) {
      this.notesData.noteIssues.push({ instrument: this.instrument, difficulty: this.difficulty, noteIssues: this.noteIssues })
    }
    if (this.trackIssues.length) {
      this.notesData.trackIssues.push({ instrument: this.instrument, difficulty: this.difficulty, trackIssues: this.trackIssues })
    }
  }

  private parseDrumTrack () {
    let trackHasStarPower = false
    let trackHasActivationLanes = false
    // Check for drum note type properties
    for (const line of this.lines) {
      if (!trackHasStarPower && line.includes('S 2')) { trackHasStarPower = true }
      if (!trackHasActivationLanes && line.includes('S 64 ')) { trackHasActivationLanes = true }
      if (!this.notesData.has2xKick && line.includes('N 32 ')) { this.notesData.has2xKick = true }
    }
    // Check for three-note drum chords (not including kicks)
    for (const note of this.groupedNotes) {
      const nonKickDrumNoteIds = [1, 2, 3, 4, 5]
      if (_.sumBy(nonKickDrumNoteIds, (id) => (note.note.includes(id) ? 1 : 0)) >= 3) {
        this.addNoteIssue('threeNoteDrumChord', note.tick)
      }
    }
    if (!trackHasStarPower) { this.addTrackIssue('noStarPower') }
    if (!trackHasActivationLanes) { this.addTrackIssue('noDrumActivationLanes') }
  }

  private parseNonDrumTrack () {
    let trackHasStarPower = false
    // Check for guitar note type properties
    for (const line of this.lines) {
      if (!this.notesData.hasSoloSections && line.includes('E solo')) { this.notesData.hasSoloSections = true }
      if (!this.notesData.hasForcedNotes && line.includes('N 5 ')) { this.notesData.hasForcedNotes = true }
      if (!this.notesData.hasOpenNotes && line.includes('N 7 ')) { this.notesData.hasOpenNotes = true }
      if (!trackHasStarPower && line.includes('S 2')) { trackHasStarPower = true }
      if (!this.notesData.hasTapNotes && line.includes('N 6 ')) { this.notesData.hasTapNotes = true }
    }
    // Check for sustain properties
    this.setSustainProperties()
    // Calculate NPS properties
    this.setNpsProperties()
    if (this.instrument !== 'guitarghl' && this.instrument !== 'bassghl') {
      const fiveNoteChordIds = [0, 1, 2, 3, 4]
      const greenBlueChordIds = [0, 3]
      const redOrangeChordIds = [1, 4]
      const greenOrangeChordIds = [0, 4]
      const openIds = [7]
      const openOrangeIds = [7, 4]
      const openOrangeBlueIds = [7, 4, 3]
      for (const note of this.groupedNotes) {
        // Check for five-note chords
        if (fiveNoteChordIds.every((id) => note.note.includes(id))) {
          this.addNoteIssue('fiveNoteChord', note.tick)
        }
        // Check for notes forbidden on lower difficulties
        if (this.difficulty === 'hard') {
          if (openIds.some((id) => note.note.includes(id))) { this.addNoteIssue('difficultyForbiddenNote', note.tick) }
          if (greenBlueChordIds.every((id) => note.note.includes(id))) { this.addNoteIssue('difficultyForbiddenNote', note.tick) }
          if (redOrangeChordIds.every((id) => note.note.includes(id))) { this.addNoteIssue('difficultyForbiddenNote', note.tick) }
          if (greenOrangeChordIds.every((id) => note.note.includes(id))) { this.addNoteIssue('difficultyForbiddenNote', note.tick) }
        } else if (this.difficulty === 'medium') {
          if (openOrangeIds.some((id) => note.note.includes(id))) { this.addNoteIssue('difficultyForbiddenNote', note.tick) }
          if (greenBlueChordIds.every((id) => note.note.includes(id))) { this.addNoteIssue('difficultyForbiddenNote', note.tick) }
        } else if (this.difficulty === 'easy') {
          if (openOrangeBlueIds.some((id) => note.note.includes(id))) { this.addNoteIssue('difficultyForbiddenNote', note.tick) }
        }
      }
    }
    if (!trackHasStarPower) { this.addTrackIssue('noStarPower') }
  }

  private setSustainProperties () {
    /** The index of the tempo marker that applies to the current note being checked in the for loop. */
    let currentTempoMarkerIndex = 0
    /** @returns the tick delta between `tick` and `tick` + `deltaMs`. */
    const getTickDeltaMs = (tick: number, deltaMs: number) => {
      let tickTempoMarkerIndex = currentTempoMarkerIndex
      while (this.tempoMap[tickTempoMarkerIndex + 1] && this.tempoMap[tickTempoMarkerIndex + 1].tick <= tick) {
        tickTempoMarkerIndex++
      }
      return (deltaMs / 1000) * ((this.tempoMap[tickTempoMarkerIndex].bpm * this.resolution) / 60)
    }

    /** Sustain gaps at the end of notes already checked in the for loop. `startTick` is inclusive, `endTick` is exclusive. */
    const futureSustainGaps: { startTick: number; endTick: number }[] = []
    for (const note of this.ungroupedNotes) {
      const nextMarker = this.tempoMap[currentTempoMarkerIndex + 1]
      if (nextMarker && nextMarker.tick <= note.tick) { currentTempoMarkerIndex++ }

      _.remove(futureSustainGaps, (r) => r.endTick <= note.tick)
      if (futureSustainGaps.find((r) => note.tick >= r.startTick && note.tick < r.endTick)) {
        this.addNoteIssue('badSustainGap', note.tick)
      }
      if (note.tick !== note.endTick) {
        futureSustainGaps.push({
          startTick: note.endTick,
          endTick: note.endTick + getTickDeltaMs(note.endTick, MIN_SUSTAIN_GAP_MS)
        })
        if (note.endTick - note.tick < getTickDeltaMs(note.tick, MIN_SUSTAIN_MS)) {
          this.addNoteIssue('babySustain', note.tick)
        }
      }
    }
  }

  private setNpsProperties () {
    /** The index of the tempo marker that applies to the current note being checked in the for loop. */
    let currentTempoMarkerIndex = 0
    /** @returns the number of ticks that correspond to `deltaMs` milliseconds at the current bpm. */
    const getTickDeltaMs = (deltaMs: number) => (deltaMs / 1000) * ((this.tempoMap[currentTempoMarkerIndex].bpm * this.resolution) / 60)

    let currentNpsGroupSizeInTicks = getTickDeltaMs(NPS_GROUP_SIZE_MS)
    /** The list of ticks that contain previous notes that are within `NPS_GROUP_SIZE_MS` milliseconds of `note`. */
    const recentNoteTicks: number[] = []
    let highestNpsNote = { noteCount: 1, note: this.groupedNotes[0] }
    for (const note of this.groupedNotes) {
      const nextMarker = this.tempoMap[currentTempoMarkerIndex + 1]
      if (nextMarker && nextMarker.tick <= note.tick) {
        currentTempoMarkerIndex++
        currentNpsGroupSizeInTicks = getTickDeltaMs(NPS_GROUP_SIZE_MS)
      }

      _.remove(recentNoteTicks, (r) => r <= note.tick - currentNpsGroupSizeInTicks)
      recentNoteTicks.push(note.tick)
      if (highestNpsNote.noteCount < recentNoteTicks.length) {
        highestNpsNote = { noteCount: recentNoteTicks.length, note }
      }
    }

    this.notesData.maxNps.push({
      instrument: this.instrument,
      difficulty: this.difficulty,
      nps: (highestNpsNote.noteCount * 1000) / NPS_GROUP_SIZE_MS,
      tick: highestNpsNote.note.tick,
      time: 0
    })
  }
}

class ChartParser {
  private notesData: NotesData

  private resolution: number
  private tempoMap: { tick: number; bpm: number }[]
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
    const tempoMap: { tick: number; bpm: number }[] = []
    const syncTrack = this.fileSections.SyncTrack ?? []
    for (const line of syncTrack) {
      const [, stringTick, stringBpm] = (/\s*(\d+) = B (\d+)/).exec(line) || []
      const tick = parseInt(stringTick, 10)
      const bpm = parseInt(stringBpm, 10) / 1000
      if (isNaN(tick) || isNaN(bpm)) { continue } // Not a bpm marker
      tempoMap.push({ tick, bpm })
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

    let globalFirstNote: { tick: number; note: number[] } | null = null
    let globalLastNote: { tick: number; note: number[] } | null = null

    for (const [track, lines] of _.entries(this.trackSections) as [TrackName, string[]][]) {
      const trackParser = new TrackParser(this.notesData, track, lines, this.resolution, this.tempoMap)

      trackParser.parseTrack()

      globalFirstNote = _.minBy([globalFirstNote, trackParser.firstNote], (note) => note?.tick ?? Infinity) ?? null
      globalLastNote = _.maxBy([globalLastNote, trackParser.lastNote], (note) => note?.tick ?? -Infinity) ?? null
    }
    if (globalFirstNote === null || globalLastNote === null) {
      this.notesData.chartIssues.push('noNotes')
      return this.notesData
    }
    this.setEventsProperties()
    this.setMissingExperts()
    this.setTimeSignatureProperties()
    this.setTempomapProperties(globalFirstNote.tick, globalLastNote.tick)

    return this.notesData
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

  /**
   * Scans through the tempo map and sets properties derived from it
   */
  private setTempomapProperties (firstNoteTick: number, lastNoteTick: number) {
    // Add an implied bpm marker at the end
    this.tempoMap.push({ tick: lastNoteTick, bpm: _.last(this.tempoMap)!.bpm })

    let [totalChartTime, timeToFirstNote, timeToLastNote] = [0, 0, 0] // Seconds
    let { tick: lastBpmMarkerTick, bpm: lastBpm } = this.tempoMap[0]
    for (const { tick: nextBpmMarkerTick, bpm: nextBpm } of this.tempoMap) { // Iterate through each tempo map region
      // the "Resolution" parameter is the number of ticks in each beat, so `bpm * resolution` is the ticks per minute
      const secondsPerTickInRegion = 60 / (lastBpm * this.resolution)

      totalChartTime += (nextBpmMarkerTick - lastBpmMarkerTick) * secondsPerTickInRegion

      if (firstNoteTick > lastBpmMarkerTick) { // Calculate the timestamp of the first note
        timeToFirstNote += (Math.min(firstNoteTick, nextBpmMarkerTick) - lastBpmMarkerTick) * secondsPerTickInRegion
      }

      if (lastNoteTick > lastBpmMarkerTick) { // Calculate the timestamp of the last note
        timeToLastNote += (Math.min(lastNoteTick, nextBpmMarkerTick) - lastBpmMarkerTick) * secondsPerTickInRegion
      }

      for (const issueTrack of this.notesData.noteIssues) { // Calculate the timestamp of note issues
        for (const note of issueTrack.noteIssues) {
          if (note.tick > lastBpmMarkerTick) {
            note.time += (Math.min(note.tick, nextBpmMarkerTick) - lastBpmMarkerTick) * secondsPerTickInRegion
          }
        }
      }
      for (const maxNpsNote of this.notesData.maxNps) { // Calculate the timestamp of the max NPS
        if (maxNpsNote.tick > lastBpmMarkerTick) {
          maxNpsNote.time += (Math.min(maxNpsNote.tick, nextBpmMarkerTick) - lastBpmMarkerTick) * secondsPerTickInRegion
        }
      }

      lastBpmMarkerTick = nextBpmMarkerTick
      lastBpm = nextBpm
    }

    this.notesData.noteIssues.forEach((issueTrack) => issueTrack.noteIssues = _.uniqBy(issueTrack.noteIssues, (n) => n.issueType + n.tick))
    this.notesData.noteIssues.forEach((issueTrack) => issueTrack.noteIssues.forEach((n) => n.time = _.round(n.time, 2)))
    this.notesData.maxNps.forEach((m) => m.time = _.round(m.time, 2))
    if (this.tempoMap.length - 1 === 1 && this.tempoMap[0].bpm === 120 && this.timeSignatures.length === 1) {
      this.notesData.chartIssues.push('isDefaultBPM')
    }
    if (timeToFirstNote < (LEADING_SILENCE_THRESHOLD_MS / 1000)) {
      this.notesData.chartIssues.push('smallLeadingSilence')
    }
    this.notesData.length = Math.floor(totalChartTime)
    this.notesData.effectiveLength = Math.floor(timeToLastNote - timeToFirstNote)
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
