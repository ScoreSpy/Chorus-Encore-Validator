/* eslint-disable guard-for-in */
import type { SongArchive, SongData } from '../types'
import { parse } from 'node:path'
import * as formats from '../supportedFiles'
import * as chalk from 'chalk'

export default class Song {
  errors: string[]
  warnings: string[]
  baseDir: string
  files: string[]
  output: SongData = {
    files: {
      video: { highway: false, video: false },
      image: { album: false, background: false, highway: false },
      stems: { guitar: false, bass: false, rhythm: false, vocals: false, vocals_1: false, vocals_2: false, drums: false, drums_1: false, drums_2: false, drums_3: false, drums_4: false, keys: false, song: false, crowd: false },
      chart: { mid: false, chart: false },
      config: { ini: false }
    }
  }

  constructor (data: SongArchive) {
    this.errors = []
    this.warnings = []

    this.baseDir = data.baseFolder
    this.files = data.files

    this.setSupportedFiles()
    this.validate()
    this.printMessages()
  }


  private setSupportedFiles () {
    for (const file of this.files) {
      const File = parse(file)
      const FileName = File.name.toLocaleLowerCase()
      const FileExt = File.ext.toLocaleLowerCase()

      if (formats.SupportedChartNames.includes(FileName) && formats.SupportedChartFormats.includes(FileExt)) {
        if (FileExt === '.mid') { this.output.files.chart.mid = true }
        if (FileExt === '.chart') { this.output.files.chart.chart = true }
        continue
      } else if (formats.SupportedConfigNames.includes(FileName) && formats.SupportedConfigFormats.includes(FileExt)) {
        this.output.files.config.ini = true
      } else if (formats.SupportedVideoNames.includes(FileName) && formats.SupportedVideoFormats.includes(FileExt)) {
        if (FileName === 'highway') { this.output.files.video.highway = true }
        if (FileName === 'video') { this.output.files.video.video = true }
      } else if (formats.SupportedImageNames.includes(FileName) && formats.SupportedImageFormats.includes(FileExt)) {
        if (FileName === 'album') { this.output.files.image.album = true }
        if (FileName === 'background') { this.output.files.image.background = true }
        if (FileName === 'highway') { this.output.files.image.highway = true }
      } else if (formats.SupportedStemNames.includes(FileName) && formats.SupportedAudioFormats.includes(FileExt)) {
        if (FileName === 'guitar') { this.output.files.stems.guitar = true }
        if (FileName === 'bass') { this.output.files.stems.bass = true }
        if (FileName === 'rhythm') { this.output.files.stems.rhythm = true }
        if (FileName === 'vocals') { this.output.files.stems.vocals = true }
        if (FileName === 'vocals_1') { this.output.files.stems.vocals_1 = true }
        if (FileName === 'vocals_2') { this.output.files.stems.vocals_2 = true }
        if (FileName === 'drums') { this.output.files.stems.drums = true }
        if (FileName === 'drums_1') { this.output.files.stems.drums_1 = true }
        if (FileName === 'drums_2') { this.output.files.stems.drums_2 = true }
        if (FileName === 'drums_3') { this.output.files.stems.drums_3 = true }
        if (FileName === 'drums_4') { this.output.files.stems.drums_4 = true }
        if (FileName === 'keys') { this.output.files.stems.keys = true }
        if (FileName === 'song') { this.output.files.stems.song = true }
        if (FileName === 'crowd') { this.output.files.stems.crowd = true }
      }
    }
  }

  private validate () {
    if (!this.output.files.chart.mid && !this.output.files.chart.chart) { this.errors.push('Missing chart') }
    if (!this.output.files.config.ini) { this.errors.push('Missing ini') }
    if (!this.output.files.image.album) { this.warnings.push('Missing album image') }
    if (!this.output.files.stems.song) { this.warnings.push('Missing "song" stem') }
  }

  private printMessages () {
    for (const error of this.errors) {
      console.log(chalk.redBright(`ERROR ${this.baseDir}: ${error}`))
    }

    for (const warning of this.warnings) {
      console.log(chalk.hex('#FFA500')(`WARNING ${this.baseDir}: ${warning}`))
    }
  }

  public toJSON (): SongData {
    return this.output
  }

  public toString (): string {
    return JSON.stringify(this.output, null, 4)
  }

  get hasError (): boolean {
    return this.errors.length > 0
  }
}
