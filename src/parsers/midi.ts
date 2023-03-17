/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable no-warning-comments */
/* eslint-disable no-nested-ternary */
/* eslint-disable default-case */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-use-before-define */
/* eslint-disable max-classes-per-file */
import { createHash } from 'crypto'
import { readFile } from 'fs/promises'
import _ from 'lodash'
import { EVENT_DIVSYSEX, EVENT_META, EVENT_META_SET_TEMPO, EVENT_META_TIME_SIGNATURE, EVENT_META_TRACK_NAME, EVENT_MIDI, EVENT_MIDI_NOTE_ON, EVENT_SYSEX, MIDIEvent } from 'midievents'
import MIDIFile from 'midifile'

import { Difficulty, Instrument, NoteIssue, NoteIssueType, NotesData, TrackIssueType } from './../types/notes-data'

const LEADING_SILENCE_THRESHOLD_MS = 1000
const MIN_SUSTAIN_GAP_MS = 40
// const MIN_SUSTAIN_MS = 100 TODO: unchecked for now because determining this in .mid is complicated
const NPS_GROUP_SIZE_MS = 1000

/* eslint-disable @typescript-eslint/naming-convention */
type TrackName = InstrumentName | 'PART VOCALS' | 'EVENTS'
type InstrumentName = keyof typeof instrumentNameMap
const instrumentNameMap = {
  'PART GUITAR': 'guitar',
  'PART RHYTHM': 'rhythm',
  'PART BASS': 'bass',
  'PART DRUMS': 'drums',
  'PART KEYS': 'keys',
  'PART GUITAR GHL': 'guitarghl',
  'PART BASS GHL': 'bassghl'
} as const
/* eslint-enable @typescript-eslint/naming-convention */

enum EventType {
  starPower,
  tap,
  force,
  orange,
  blue,
  yellow,
  red,
  green,
  open,
  soloMarker,

  // 6 fret
  black3,
  black2,
  black1,
  white3,
  white2,
  white1,

  // Drums
  activationLane,
  kick,
  kick2x,
}

interface TrackEventEnd {
  difficulty: Difficulty | null
  time: number
  type: EventType | null
  isStart: boolean
}

interface TrackEvent {
  difficulty: Difficulty
  time: number
  type: EventType
  endTime: number
}

const sysExDifficultyMap = ['easy', 'medium', 'hard', 'expert'] as const
const fiveFretDiffStarts = { easy: 59, medium: 71, hard: 83, expert: 95 }
const sixFretDiffStarts = { easy: 58, medium: 70, hard: 82, expert: 94 }
const drumsDiffStarts = { easy: 60, medium: 72, hard: 84, expert: 96 }

class TrackParser {
  private instrument: Instrument
  // @ts-ignore
  private difficulty: Difficulty

  private ungroupedNotes: TrackEvent[]
  private groupedNotes: { time: number; type: EventType[] }[]

  private noteIssues: NoteIssue[] = []
  private trackIssues: TrackIssueType[] = []

  constructor (private notesData: NotesData, track: { instrument: Instrument; difficulty: Difficulty; trackEvents: TrackEvent[] }) {
    this.instrument = track.instrument

    if (!notesData.instruments.includes(this.instrument)) { notesData.instruments.push(this.instrument) }

    this.ungroupedNotes = track.trackEvents

    this.groupedNotes = _.chain(this.ungroupedNotes).
      groupBy((note) => note?.time).
      values().
      map((noteGroup) => ({
        time: noteGroup[0].time,
        type: noteGroup.map((note) => note.type!)
      })).
      value()
  }

  public get firstNote () { return _.first(this.groupedNotes) ?? null }
  public get lastNote () { return _.last(this.groupedNotes) ?? null }

  private addNoteIssue (issueType: NoteIssueType, time: number) { this.noteIssues.push({ issueType, tick: 0, time }) }
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
      hash: createHash('md5').update(this.ungroupedNotes.map((n) => `${n.time}_${n.type}`).join('')).digest('hex')
    })

    // Add note count
    this.notesData.noteCounts.push({ instrument: this.instrument, difficulty: this.difficulty, count: this.groupedNotes.length })

    // Check for broken notes (note: false positives are possible)
    for (let i = 1; i < this.groupedNotes.length; i++) {
      const distance = this.groupedNotes[i].time - this.groupedNotes[i - 1].time
      if (distance > 0 && distance < 5) {
        this.addNoteIssue('brokenNote', this.groupedNotes[i].time)
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
    for (const event of this.ungroupedNotes) {
      if (event.type === EventType.starPower) { trackHasStarPower = true }
      if (event.type === EventType.soloMarker) { trackHasStarPower = true } // This is to support GH1/GH2 charts
      if (event.type === EventType.activationLane) { trackHasActivationLanes = true }
      if (event.type === EventType.kick2x) { this.notesData.has2xKick = true }
    }
    // Check for three-note drum chords (not including kicks)
    for (const note of this.groupedNotes) {
      const nonKickDrumNoteIds = [EventType.green, EventType.red, EventType.yellow, EventType.blue, EventType.orange]
      if (_.sumBy(nonKickDrumNoteIds, (id) => (note.type.includes(id) ? 1 : 0)) >= 3) {
        this.addNoteIssue('threeNoteDrumChord', note.time)
      }
    }
    if (!trackHasStarPower) { this.addTrackIssue('noStarPower') }
    if (!trackHasActivationLanes) { this.addTrackIssue('noDrumActivationLanes') }
  }

  private parseNonDrumTrack () {
    let trackHasStarPower = false
    // Check for guitar note type properties
    for (const event of this.ungroupedNotes) {
      if (event.type === EventType.soloMarker) { this.notesData.hasSoloSections = true }
      if (event.type === EventType.force) { this.notesData.hasForcedNotes = true }
      if (event.type === EventType.open) { this.notesData.hasOpenNotes = true }
      if (event.type === EventType.starPower) { trackHasStarPower = true }
      if (event.type === EventType.tap) { this.notesData.hasTapNotes = true }
    }
    // Check for sustain properties
    this.setSustainProperties()
    // Calculate NPS properties
    this.setNpsProperties()
    if (this.instrument !== 'guitarghl' && this.instrument !== 'bassghl') {
      const fiveNoteChordIds = [EventType.green, EventType.red, EventType.yellow, EventType.blue, EventType.orange]
      const greenBlueChordIds = [EventType.green, EventType.blue]
      const redOrangeChordIds = [EventType.red, EventType.orange]
      const greenOrangeChordIds = [EventType.green, EventType.orange]
      const openIds = [EventType.open]
      const openOrangeIds = [EventType.open, EventType.orange]
      const openOrangeBlueIds = [EventType.open, EventType.orange, EventType.blue]
      for (const note of this.groupedNotes) {
        // Check for five-note chords
        if (fiveNoteChordIds.every((id) => note.type.includes(id))) {
          this.addNoteIssue('fiveNoteChord', note.time)
        }
        // Check for notes forbidden on lower difficulties
        if (this.difficulty === 'hard') {
          if (openIds.some((id) => note.type.includes(id))) { this.addNoteIssue('difficultyForbiddenNote', note.time) }
          if (greenBlueChordIds.every((id) => note.type.includes(id))) { this.addNoteIssue('difficultyForbiddenNote', note.time) }
          if (redOrangeChordIds.every((id) => note.type.includes(id))) { this.addNoteIssue('difficultyForbiddenNote', note.time) }
          if (greenOrangeChordIds.every((id) => note.type.includes(id))) { this.addNoteIssue('difficultyForbiddenNote', note.time) }
        } else if (this.difficulty === 'medium') {
          if (openOrangeIds.some((id) => note.type.includes(id))) { this.addNoteIssue('difficultyForbiddenNote', note.time) }
          if (greenBlueChordIds.every((id) => note.type.includes(id))) { this.addNoteIssue('difficultyForbiddenNote', note.time) }
        } else if (this.difficulty === 'easy') {
          if (openOrangeBlueIds.some((id) => note.type.includes(id))) { this.addNoteIssue('difficultyForbiddenNote', note.time) }
        }
      }
    }
    if (!trackHasStarPower) { this.addTrackIssue('noStarPower') }
  }

  private setSustainProperties () {
    /** Sustain gaps at the end of notes already checked in the for loop. `startTick` is inclusive, `endTick` is exclusive. */
    const futureSustainGaps: { startTime: number; endTime: number }[] = []
    for (const note of this.ungroupedNotes) {
      _.remove(futureSustainGaps, (r) => r.endTime <= note.time)
      if (futureSustainGaps.find((r) => note.time >= r.startTime && note.time < r.endTime)) {
        this.addNoteIssue('badSustainGap', note.time)
      }
      if (note.time !== note.endTime) {
        futureSustainGaps.push({
          startTime: note.endTime,
          endTime: note.endTime + MIN_SUSTAIN_GAP_MS
        })
      }
    }
  }

  private setNpsProperties () {
    /** The list of ticks that contain previous notes that are within `NPS_GROUP_SIZE_MS` milliseconds of `note`. */
    const recentNoteTicks: number[] = []
    let highestNpsNote = { noteCount: 1, note: this.groupedNotes[0] }
    for (const note of this.groupedNotes) {
      _.remove(recentNoteTicks, (r) => r <= note.time - NPS_GROUP_SIZE_MS)
      recentNoteTicks.push(note.time)
      if (highestNpsNote.noteCount < recentNoteTicks.length) {
        highestNpsNote = { noteCount: recentNoteTicks.length, note }
      }
    }

    this.notesData.maxNps.push({
      instrument: this.instrument,
      difficulty: this.difficulty,
      nps: (highestNpsNote.noteCount * 1000) / NPS_GROUP_SIZE_MS,
      tick: 0,
      time: highestNpsNote.note.time
    })
  }
}

class MidiParser {
  private notesData: NotesData

  private tempoMap: MIDIEvent[] = []
  private tracks: { trackIndex: number; trackName: TrackName; trackEvents: MIDIEvent[] }[]
  private splitTracks: { instrument: Instrument; difficulty: Difficulty; trackEvents: TrackEvent[] }[]

  constructor (private midiFile: MIDIFile) {
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

    const trackNameEvents: MIDIEvent[] = []
    const trackEvents: MIDIEvent[][] = []

    const allEvents = midiFile.getEvents()
    for (const midiEvent of allEvents) {
      midiEvent.playTime = _.round(midiEvent.playTime ?? -1, 3)

      switch (midiEvent.type) {
      case EVENT_META: {
        switch (midiEvent.subtype) {
        case EVENT_META_TRACK_NAME: trackNameEvents.push(midiEvent); break
        case EVENT_META_SET_TEMPO: this.tempoMap.push(midiEvent); break
        case EVENT_META_TIME_SIGNATURE: break
        }
        break
      }
      case EVENT_SYSEX:
      case EVENT_DIVSYSEX: {
        (trackEvents[midiEvent.track!] ??= []).push(midiEvent)
        break
      }
      case EVENT_MIDI: {
        (trackEvents[midiEvent.track!] ??= []).push(midiEvent)
        break
      }
      }
    }

    this.tracks = trackNameEvents.map((event) => ({
      trackIndex: event.track!,
      trackName: event.data.map((dta) => String.fromCharCode(dta)).join('').trim() as TrackName,
      trackEvents: trackEvents[event.track!]
    }))

    this.splitTracks = _.chain(this.tracks).
      filter((t) => _.keys(instrumentNameMap).includes(t.trackName)).
      map((t) => {
        const instrument = instrumentNameMap[t.trackName as InstrumentName]
        const trackEventGroups = _.chain(t.trackEvents).
          map((te) => this.getTrackEventEnds(te, instrument)).
          filter((te) => te.type !== null).
          orderBy((te) => te.time).
          thru((te) => this.getTrackEvents(te)).
          orderBy((te) => te.time).
          groupBy((te) => te.difficulty).
          toPairs().
          value()
        const instrumentEvents = _.remove(trackEventGroups, (g) => g[0] === null)[0][1] // Pull out instrument-wide events
        trackEventGroups.forEach((g) => g[1].push(...instrumentEvents)) // ... and add each one to all difficulties

        return trackEventGroups.map((g) => ({ instrument, difficulty: g[0] as Difficulty, trackEvents: g[1] }))
      }).
      flatMap().
      value()
  }

  private getTrackEventEnds (event: MIDIEvent, instrument: Instrument): TrackEventEnd {
    // SysEx event (tap modifier or open)
    const eventData = event.data.map((dta) => String.fromCharCode(dta))
    if (event.type === EVENT_SYSEX || event.type === EVENT_DIVSYSEX) {
      if (eventData[0] === 'P' && eventData[1] === 'S' && eventData[2] === '\0' && event.data[3] === 0x00) {
        // Phase Shift SysEx event
        return {
          difficulty: sysExDifficultyMap[event.data[4]],
          time: event.playTime!,
          type: event.data[5] === 0x01 ? EventType.open : event.data[5] === 0x04 ? EventType.tap : null,
          isStart: event.data[6] === 0x00
        }
      }
    }

    const note = event.param1!
    const difficulty = note <= 66 ? 'easy' : note <= 78 ? 'medium' : note <= 90 ? 'hard' : note <= 102 ? 'expert' : null
    // Instrument event (solo marker, star power, activation lane) (applies to all difficulties)
    if (!difficulty) {
      return {
        difficulty,
        time: event.playTime!,
        type: note === 103 ? EventType.soloMarker : note === 116 ? EventType.starPower : note >= 120 && note <= 124 ? EventType.activationLane : null,
        isStart: event.data[6] === 0x00
      }
    }

    return {
      difficulty,
      time: event.playTime!,
      type: (instrument === 'guitarghl' || instrument === 'bassghl' ? this.get6FretNoteType(note, difficulty) : instrument === 'drums' ? this.getDrumsNoteType(note, difficulty) : this.get5FretNoteType(note, difficulty)) ?? null,
      isStart: event.subtype === EVENT_MIDI_NOTE_ON
    }
  }

  private get5FretNoteType (note: number, difficulty: Difficulty) {
    switch (note - fiveFretDiffStarts[difficulty]) {
    case 1: return EventType.green
    case 2: return EventType.red
    case 3: return EventType.yellow
    case 4: return EventType.blue
    case 5: return EventType.orange
    case 6: return EventType.force
    case 7: return EventType.force
    default: throw new Error('Missing EventType')
    }
  }

  private get6FretNoteType (note: number, difficulty: Difficulty) {
    switch (note - sixFretDiffStarts[difficulty]) {
    case 0: return EventType.open
    case 1: return EventType.white1
    case 2: return EventType.white2
    case 3: return EventType.white3
    case 4: return EventType.black1
    case 5: return EventType.black2
    case 6: return EventType.black3
    case 7: return EventType.force
    case 8: return EventType.force
    default: throw new Error('Missing EventType')
    }
  }

  private getDrumsNoteType (note: number, difficulty: Difficulty) {
    switch (note - drumsDiffStarts[difficulty]) {
    case -1: return EventType.kick2x
    case 0: return EventType.kick
    case 1: return EventType.red
    case 2: return EventType.yellow
    case 3: return EventType.blue
    case 4: return EventType.orange
    case 5: return EventType.green
    default: throw new Error('Missing EventType')
    }
  }

  private getTrackEvents (trackEventEnds: TrackEventEnd[]) {
    const trackEvents: TrackEvent[] = []
    const lastTrackEventEnds: Partial<{ [type in EventType]: TrackEventEnd }> = {}
    for (const trackEventEnd of trackEventEnds) {
      const lastTrackEventEnd = lastTrackEventEnds[trackEventEnd.type!]
      if (trackEventEnd.isStart) {
        lastTrackEventEnds[trackEventEnd.type!] = trackEventEnd
      } else if (lastTrackEventEnd) {
        trackEvents.push({
          difficulty: trackEventEnd.difficulty!,
          time: lastTrackEventEnd.time,
          endTime: trackEventEnd.time,
          type: lastTrackEventEnd.type!
        })
      }
    }
    return trackEvents
  }

  parse (): NotesData {
    let globalFirstNote: { time: number; type: EventType[] } | null = null
    let globalLastNote: { time: number; type: EventType[] } | null = null

    for (const track of this.splitTracks) {
      const trackParser = new TrackParser(this.notesData, track)

      trackParser.parseTrack()

      globalFirstNote = _.minBy([globalFirstNote, trackParser.firstNote], (note) => note?.time ?? Infinity) ?? null
      globalLastNote = _.maxBy([globalLastNote, trackParser.lastNote], (note) => note?.time ?? -Infinity) ?? null
    }
    if (globalFirstNote === null || globalLastNote === null) {
      this.notesData.chartIssues.push('noNotes')
      return this.notesData
    }

    if (this.tracks.find((t) => t.trackName === 'PART VOCALS')?.trackEvents.length) { this.notesData.hasLyrics = true }

    const sectionEvents = _.chain(this.tracks.find((t) => t.trackName === 'EVENTS')?.trackEvents ?? []).
      map((ete) => ete.data.map((dta) => String.fromCharCode(dta)).join('')).
      filter((name) => name.includes('[section') || name.includes('[prc_')).
      value()
    if (!sectionEvents.length) { this.notesData.chartIssues.push('noSections') }

    this.notesData.tempoMapHash = createHash('md5').update(this.midiFile.header.getTickResolution() +
      this.tempoMap.map((t) => `${t.playTime}_${t.tempoBPM}`).join(':')).digest('hex')
    this.notesData.tempoMarkerCount = this.tempoMap.length + 1 // .mid has an implied starting marker defined in the header

    /*
     * TODO
     * if (this.tempoMap.length === 0 && this.midiFile.header.getTickResolution() === ??? && this.timeSignatures.length === 1) {
     *  this.notesData.chartIssues.push('isDefaultBPM')
     * }
     * TODO: check for misalignedTimeSignatures
     */

    this.notesData.length = Math.floor(globalLastNote.time)
    this.notesData.effectiveLength = Math.floor(globalLastNote.time - globalFirstNote.time)
    if (globalFirstNote.time < (LEADING_SILENCE_THRESHOLD_MS / 1000)) {
      this.notesData.chartIssues.push('smallLeadingSilence')
    }

    this.setMissingExperts()

    return this.notesData
  }

  private setMissingExperts () {
    // TODO
  }
}

export class MidiParserService {
  public async parse (filepath: string): Promise<NotesData> {
    const chartBuffer = await readFile(filepath)
    const midiFile = new MIDIFile(chartBuffer)
    return new MidiParser(midiFile).parse()
  }
}
