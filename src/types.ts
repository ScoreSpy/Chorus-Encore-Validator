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
