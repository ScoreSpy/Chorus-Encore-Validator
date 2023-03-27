/* eslint-disable no-use-before-define */

export type Instrument = 'guitar' | 'rhythm' | 'bass' | 'drums' | 'keys' | 'guitarghl' | 'bassghl'
export type Difficulty = 'expert' | 'hard' | 'medium' | 'easy'

export interface NotesData {
  /** The list of instruments that are charted. */
  instruments: Instrument[]

  /** If the chart has solo sections. */
  hasSoloSections: boolean

  /** If the chart has lyrics. */
  hasLyrics: boolean

  /** If the chart has forced notes in any of its instruments or difficulties. */
  hasForcedNotes: boolean

  /** If the chart has tap notes in any of its instruments or difficulties. */
  hasTapNotes: boolean

  /** If the chart has open notes in any of its instruments or difficulties. */
  hasOpenNotes: boolean

  /** If the drum chart has 2x kick notes. */
  has2xKick: boolean

  /** The list of detected issues with specific notes in each track. */
  noteIssues: { instrument: Instrument; difficulty: Difficulty; noteIssues: NoteIssue[] }[]

  /** The list of detected issues with each track. */
  trackIssues: { instrument: Instrument; difficulty: Difficulty; trackIssues: TrackIssueType[] }[]

  /** The list of detected issues with the entire chart. */
  chartIssues: ChartIssueType[]

  /** The number of notes in each instrument and difficulty. */
  noteCounts: { instrument: Instrument; difficulty: Difficulty; count: number }[]

  /** The highest notes-per-second in each instrument and difficulty. Measured across a 1 second window. */
  maxNps: { instrument: Instrument; difficulty: Difficulty; time: number; nps: number; notes: TrackEvent[] }[]

  /** The MD5 checksums of each instrument and difficulty. */
  hashes: { instrument: Instrument; difficulty: Difficulty; hash: string }[]

  /** The MD5 checksum of the tempo markers and time signature markers. */
  tempoMapHash: string

  /** The number of tempo markers in the chart. */
  tempoMarkerCount: number

  /** The number of milliseconds between the start of the chart and the last note. */
  length: number

  /** The number of milliseconds between the first note of the chart and the last note. */
  effectiveLength: number
}

export interface NoteIssue {
  /** The type of issue. */
  issueType: NoteIssueType

  /** The number of milliseconds into the chart where the broken note appears. */
  time: number
}

export type NoteIssueType =
  /** This is a five-note chord. */
  'fiveNoteChord' |
  /** This is a note that isn't allowed on the track's difficulty. */
  'difficultyForbiddenNote' |
  /** This is a three-note chord on the "drums" instrument. */
  'threeNoteDrumChord' |
  /** This note is so close to the previous note that this was likely a charting mistake. */
  'brokenNote' |
  /** This note is not far enough ahead of the previous sustain. */
  'badSustainGap' |
  /** The sustain on this note is too short. */
  'babySustain'

export type TrackIssueType =
  /** This track has no star power. */
  'noStarPower' |
  /** This drums track has no activation lanes. */
  'noDrumActivationLanes' |
  /** This track has a note that is less than 2000ms after the start of the track. */
  'smallLeadingSilence'

export type ChartIssueType =
  /** This chart's data isn't structured or encoded correctly. */
  'unparseableSectionsOrBadEncoding' |
  /** This chart has no resolution. */
  'noResolution' |
  /** This chart has no tempo map information. */
  'noSyncTrackSection' |
  /** This chart has no notes. */
  'noNotes' |
  /** One of this chart's instruments has Easy, Medium, or Hard charted but not Expert. */
  'noExpert' |
  /** This chart has only one 120 BPM marker and only one 4/4 time signature. This likely means the chart wasn't tempo-mapped. */
  'isDefaultBPM' |
  /** This chart has a time signature marker that doesn't appear at the start of a measure. */
  'misalignedTimeSignatures' |
  /** This chart has no sections. */
  'noSections'

export enum EventType {
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

export interface TrackEvent {
  /** Time of the event in milliseconds. */
  time: number

  /** The type of the event. */
  type: EventType

  /** The length of the event in milliseconds. Some events have a length of zero. */
  length: number
}

export interface GroupedTrackEvent {
  /** Time of the event in milliseconds. Rounded to 3 decimal places. */
  time: number

  /** All `TrackEvents` that occur at `time`. */
  events: TrackEvent[]
}
