export type SongArchive = {
    baseFolder: string,
    files: string[]
}

export type SongData = {
  files: {
    video: {
      highway: boolean,
      video: boolean
    },
    image: {
      album: boolean,
      background: boolean,
      highway: boolean
    },
    stems: {
      guitar: boolean,
      bass: boolean,
      rhythm: boolean,
      vocals: boolean,
      vocals_1: boolean,
      vocals_2: boolean,
      drums: boolean,
      drums_1: boolean,
      drums_2: boolean,
      drums_3: boolean,
      drums_4: boolean,
      keys: boolean,
      song: boolean,
      crowd: boolean
    },
    chart: {
      mid: boolean,
      chart: boolean,
    },
    config: {
      ini: boolean,
    }
  }
}

export type ChorusDiffMapString = {
  x: string;
  h: string;
  m: string;
  e: string;
}

export type ChorusDiffMapNumber = {
  x: number;
  h: number;
  m: number;
  e: number;
}

export type ChorusChartData = {
  hasSections: boolean
  hasStarPower: boolean
  hasForced: boolean
  hasSoloSections: boolean
  hasTap: boolean
  hasLyrics: boolean
  is120: boolean
  hasBrokenNotes: boolean
  hasOpen: {
    guitar?: boolean
    bass?: boolean
    rhythm?: boolean
    keys?: boolean
    drums?: boolean
    guitarghl?: boolean
    bassghl?: boolean
  }
  noteCounts: {
    guitar?: ChorusDiffMapNumber
    bass?: ChorusDiffMapNumber
    rhythm?: ChorusDiffMapNumber
    keys?: ChorusDiffMapNumber
    drums?: ChorusDiffMapNumber
    guitarghl?: ChorusDiffMapNumber
    bassghl?: ChorusDiffMapNumber
  }
  hashes: {
    file: string,
    guitar?: ChorusDiffMapString
    bass?: ChorusDiffMapString
    rhythm?: ChorusDiffMapString
    keys?: ChorusDiffMapString
    drums?: ChorusDiffMapString
    guitarghl?: ChorusDiffMapString
    bassghl?: ChorusDiffMapString
  }
  chartMeta: {
    length: number,
    effectiveLength: number
  }
}
