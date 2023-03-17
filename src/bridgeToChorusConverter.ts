import { ChartIssueType, Difficulty, Instrument, NoteIssueType, NotesData, TrackIssueType } from 'types/notes-data'

export enum ChorusInstrument {
  Guitar = 1 << 0,
  Rhythm = 1 << 1,
  Bass = 1 << 2,
  Drums = 1 << 3,
  Keys = 1 << 4,
  GuitarGHL = 1 << 5,
  BassGHL = 1 << 6,
}

export enum ChorusDifficulty {
  Expert = 1 << 0,
  Hard = 1 << 1,
  Medium = 1 << 2,
  Easy = 1 << 3,
}

export enum ChorusNoteIssueType {
  FiveNoteChord = 1 << 0,
  DifficultyForbiddenNote = 1 << 1,
  ThreeNoteDrumChord = 1 << 2,
  BrokenNote = 1 << 3,
  BadSustainGap = 1 << 4,
  BabySustain = 1 << 5,
}

export enum ChorusTrackIssueType {
  NoStarPower = 1 << 0,
  NoDrumActivationLanes = 1 << 1,
}

export enum ChorusChartIssueType {
  UnparseableSectionsOrBadEncoding = 1 << 0,
  NoResolution = 1 << 1,
  NoSyncTrackSection = 1 << 2,
  NoNotes = 1 << 3,
  NoExpert = 1 << 4,
  IsDefaultBPM = 1 << 5,
  MisalignedTimeSignatures = 1 << 6,
  NoSections = 1 << 7,
  SmallLeadingSilence = 1 << 8,
}

function trackIssueConvert (input: TrackIssueType): ChorusTrackIssueType {
  if (input === 'noStarPower') { return ChorusTrackIssueType.NoStarPower }
  if (input === 'noDrumActivationLanes') { return ChorusTrackIssueType.NoDrumActivationLanes }
  return 0
}

function trackIssueConvertArray (input: TrackIssueType[]): ChorusTrackIssueType {
  let convertedValue: ChorusTrackIssueType = 0
  for (const i of input) {
    convertedValue |= trackIssueConvert(i)
  }
  return convertedValue
}

function noteIssueConvert (input: NoteIssueType): ChorusNoteIssueType {
  if (input === 'fiveNoteChord') { return ChorusNoteIssueType.FiveNoteChord }
  if (input === 'difficultyForbiddenNote') { return ChorusNoteIssueType.DifficultyForbiddenNote }
  if (input === 'threeNoteDrumChord') { return ChorusNoteIssueType.ThreeNoteDrumChord }
  if (input === 'brokenNote') { return ChorusNoteIssueType.BrokenNote }
  if (input === 'badSustainGap') { return ChorusNoteIssueType.BadSustainGap }
  if (input === 'babySustain') { return ChorusNoteIssueType.BabySustain }
  return 0
}

function instConvert (input: Instrument): ChorusInstrument {
  if (input === 'guitar') { return ChorusInstrument.Guitar }
  if (input === 'rhythm') { return ChorusInstrument.Rhythm }
  if (input === 'bass') { return ChorusInstrument.Bass }
  if (input === 'drums') { return ChorusInstrument.Drums }
  if (input === 'keys') { return ChorusInstrument.Keys }
  if (input === 'guitarghl') { return ChorusInstrument.GuitarGHL }
  if (input === 'bassghl') { return ChorusInstrument.BassGHL }
  return 0
}

function instConvertArray (input: Instrument[]): ChorusInstrument {
  let convertedValue: ChorusInstrument = 0
  for (const i of input) {
    convertedValue |= instConvert(i)
  }
  return convertedValue
}

function chartIssueConvert (input: ChartIssueType): ChorusChartIssueType {
  if (input === 'unparseableSectionsOrBadEncoding') { return ChorusChartIssueType.UnparseableSectionsOrBadEncoding }
  if (input === 'noResolution') { return ChorusChartIssueType.NoResolution }
  if (input === 'noSyncTrackSection') { return ChorusChartIssueType.NoSyncTrackSection }
  if (input === 'noNotes') { return ChorusChartIssueType.NoNotes }
  if (input === 'noExpert') { return ChorusChartIssueType.NoExpert }
  if (input === 'isDefaultBPM') { return ChorusChartIssueType.IsDefaultBPM }
  if (input === 'misalignedTimeSignatures') { return ChorusChartIssueType.MisalignedTimeSignatures }
  if (input === 'noSections') { return ChorusChartIssueType.NoSections }
  if (input === 'smallLeadingSilence') { return ChorusChartIssueType.SmallLeadingSilence }
  return 0
}

function chartIssueConvertArray (input: ChartIssueType[]): ChorusChartIssueType {
  let convertedValue: ChorusChartIssueType = 0
  for (const i of input) {
    convertedValue |= chartIssueConvert(i)
  }
  return convertedValue
}

function diffConvert (input: Difficulty): ChorusDifficulty {
  if (input === 'easy') { return ChorusDifficulty.Easy }
  if (input === 'medium') { return ChorusDifficulty.Medium }
  if (input === 'hard') { return ChorusDifficulty.Hard }
  if (input === 'expert') { return ChorusDifficulty.Expert }
  return 0
}

export default function bridgeToChorusConverter (BridgeChart: NotesData) {
  const chorusNoteIssues: { instrument: ChorusInstrument, difficulty: ChorusDifficulty, issueType: ChorusNoteIssueType, tick: number, time: number }[] = []
  for (const issue of BridgeChart.noteIssues) {
    const i = instConvert(issue.instrument)
    const d = diffConvert(issue.difficulty)

    for (const nType of issue.noteIssues) {
      chorusNoteIssues.push({
        instrument: i,
        difficulty: d,
        issueType: noteIssueConvert(nType.issueType),
        tick: nType.tick,
        time: nType.time
      })
    }
  }

  const chorusTrackIssues: { instrument: ChorusInstrument, difficulty: ChorusDifficulty, trackIssues: ChorusTrackIssueType }[] = []
  for (const issue of BridgeChart.trackIssues) {
    chorusTrackIssues.push({
      instrument: instConvert(issue.instrument),
      difficulty: diffConvert(issue.difficulty),
      trackIssues: trackIssueConvertArray(issue.trackIssues)
    })
  }

  const chorusNoteCounts: { instrument: ChorusInstrument, difficulty: ChorusDifficulty, count: number }[] = []
  for (const count of BridgeChart.noteCounts) {
    chorusNoteCounts.push({
      instrument: instConvert(count.instrument),
      difficulty: diffConvert(count.difficulty),
      count: count.count
    })
  }

  const chorusmaxNps: { instrument: ChorusInstrument, difficulty: ChorusDifficulty, tick: number, time: number, nps: number }[] = []
  for (const nps of BridgeChart.maxNps) {
    chorusmaxNps.push({
      instrument: instConvert(nps.instrument),
      difficulty: diffConvert(nps.difficulty),
      tick: nps.tick,
      time: nps.time,
      nps: nps.nps
    })
  }

  const chorusHashes: { instrument: ChorusInstrument, difficulty: ChorusDifficulty, hash: string }[] = []
  for (const hash of BridgeChart.hashes) {
    chorusHashes.push({
      instrument: instConvert(hash.instrument),
      difficulty: diffConvert(hash.difficulty),
      hash: hash.hash
    })
  }

  return {
    instruments: instConvertArray(BridgeChart.instruments),
    hasSoloSections: BridgeChart.hasSoloSections,
    hasLyrics: BridgeChart.hasLyrics,
    hasForcedNotes: BridgeChart.hasForcedNotes,
    hasTapNotes: BridgeChart.hasTapNotes,
    hasOpenNotes: BridgeChart.hasOpenNotes,
    has2xKick: BridgeChart.has2xKick,
    chartIssues: chartIssueConvertArray(BridgeChart.chartIssues),
    tempoMapHash: BridgeChart.tempoMapHash,
    tempoMarkerCount: BridgeChart.tempoMarkerCount,
    length: BridgeChart.length,
    effectiveLength: BridgeChart.effectiveLength,
    noteissues: chorusNoteIssues,
    trackIssues: chorusTrackIssues,
    noteCounts: chorusNoteCounts,
    maxNps: chorusmaxNps,
    hashes: chorusHashes
  }
}
