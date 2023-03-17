import { NotesData } from './notes-data'

export type SongArchive = {
    baseFolder: string,
    files: string[]
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

export type ChorusIni = {
  album_track?: string
  album?: string
  artist?: string
  charter?: string
  delay?: string
  diff_band?: string
  diff_bass?: string
  diff_bassghl?: string
  diff_drums_real?: string
  diff_drums?: string
  diff_guitar_coop?: string
  diff_guitar?: string
  diff_guitarghl?: string
  diff_keys?: string
  diff_rhythm?: string
  end_events?: string
  five_lane_drums?: string
  frets?: string
  genre?: string
  hopo_frequency?: string
  icon?: string
  loading_phrase?: string
  modchart?: string
  multiplier_note?: string
  name?: string
  playlist_track?: string
  preview_start_time?: string
  pro_drums?: string
  song_length?: string
  sustain_cutoff_threshold?: string
  track?: string
  video_start_time?: string
  year?: string
}

export type SongData = {
  iniData: ChorusIni,
  chartData: NotesData,
  checksums: {
    chart: {
      mid: string | null,
      chart: string | null,
    },
    archive: string
  }
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

export type ApplicationArguments = {
  baseDir: string;
  outputDir: string;
  dryRun: boolean;
}
