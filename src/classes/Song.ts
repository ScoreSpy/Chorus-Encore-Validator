/* eslint-disable guard-for-in */
import { createWriteStream } from 'node:fs'
import { join, parse } from 'node:path'
import { readFile } from 'node:fs/promises'
import * as formats from '../supportedFiles'
import chalk from 'chalk'
import JSZip from 'jszip'
import logger from './logger'
import parsers from './../parsers'
import type { ChorusIni, SongArchive, SongData } from '../types/chorus'
import { createCipheriv, randomBytes } from 'node:crypto'
import cryptoConfig from './../config/crypto.json'
import { NotesData } from '../types/notes-data'

export default class Song {
  errors: string[]
  warnings: string[]
  baseDir: string
  files: string[]
  output: SongData = {
    iniData: null as any,
    chartData: null as any,
    files: {
      video: { highway: false, video: false },
      image: { album: false, background: false, highway: false },
      stems: { guitar: false, bass: false, rhythm: false, vocals: false, vocals_1: false, vocals_2: false, drums: false, drums_1: false, drums_2: false, drums_3: false, drums_4: false, keys: false, song: false, crowd: false },
      chart: { mid: false, chart: false },
      config: { ini: false }
    }
  }

  chartFile!: string
  iniFile!: string

  constructor (data: SongArchive) {
    this.errors = []
    this.warnings = []

    this.baseDir = data.baseFolder
    this.files = data.files
  }


  private setSupportedFiles () {
    for (const file of this.files) {
      const File = parse(file)
      const FileName = File.name.toLocaleLowerCase()
      const FileExt = File.ext.toLocaleLowerCase()

      if (formats.SupportedChartNames.includes(FileName) && formats.SupportedChartFormats.includes(FileExt)) {
        if (FileExt === '.chart') {
          this.output.files.chart.chart = true
          this.chartFile = file
        }
        if (FileExt === '.mid') {
          this.output.files.chart.mid = true
          this.chartFile = file
        }
        continue
      } else if (formats.SupportedConfigNames.includes(FileName) && formats.SupportedConfigFormats.includes(FileExt)) {
        this.output.files.config.ini = true
        this.iniFile = file
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
      logger.log(`ERROR ${this.baseDir}: ${error}`)
    }

    for (const warning of this.warnings) {
      console.log(chalk.hex('#FFA500')(`WARNING ${this.baseDir}: ${warning}`))
      logger.log(`WARNING ${this.baseDir}: ${warning}`)
    }
  }

  public toJSON (): SongData | null {
    if (this.hasError) { return null }
    return this.output
  }

  public toString (): string | null {
    if (this.hasError) { return null }
    return JSON.stringify(this.output, null, 4)
  }

  get hasError (): boolean {
    return this.errors.length > 0
  }

  private async parseIni (): Promise<ChorusIni> {
    const data = await readFile(join(this.baseDir, this.iniFile))
    const ini = parsers.parseIni(data)
    if (ini === null) { throw new Error('ini read error') }
    return ini
  }

  private async parseChart (): Promise<NotesData> {
    if (this.output.files.chart.mid) {
      const chartParser = new parsers.MidiParserService()
      const chart = await chartParser.parse(join(this.baseDir, this.chartFile))
      if (chart === null) { throw new Error('chart read error') }
      return chart
    } else if (this.output.files.chart.chart) {
      const chartParser = new parsers.ChartParserService()
      const chart = await chartParser.parse(join(this.baseDir, this.chartFile))
      if (chart === null) { throw new Error('chart read error') }
      return chart
    }

    throw new Error('invalid chart')
  }

  public async validateSong (): Promise<void> {
    this.setSupportedFiles()
    this.validate()

    try {
      this.output.iniData = await this.parseIni()
    } catch (error) {
      this.errors.push((error as Error).message)
    }

    if (this.output.iniData.delay && this.output.iniData.delay !== '0') { this.warnings.push(`ini "delay" value unexpected: ${this.output.iniData.delay} (0)`) }
    if (this.output.iniData.hopo_frequency && this.output.iniData.hopo_frequency !== '1') { this.errors.push(`ini "hopo_frequency" value unexpected: ${this.output.iniData.hopo_frequency} (0)`) }
    /*
     * if (this.output.iniData.multiplier_note && this.output.iniData.multiplier_note !== '0') { this.warnings.push(`ini "multiplier_note" value unexpected: ${this.output.iniData.multiplier_note} (0)`) }
     * if (this.output.iniData.sustain_cutoff_threshold && this.output.iniData.sustain_cutoff_threshold !== '0') { this.warnings.push(`ini "sustain_cutoff_threshold" value unexpected: ${this.output.iniData.sustain_cutoff_threshold} (0)`) }
     * if (this.output.iniData.end_events && this.output.iniData.end_events !== '0') { this.warnings.push(`ini "end_events" value unexpected: ${this.output.iniData.end_events} (0)`) }
     */

    try {
      this.output.chartData = await this.parseChart()
    } catch (error) {
      this.errors.push((error as Error).message)
    }

    this.printMessages()
  }

  public async createEncryptedArchive (output: string) {
    const zip = new JSZip()
    for (const file of this.files) {
      if (formats.isSupportedFile(file, true)) {
        zip.file(file, await readFile(join(this.baseDir, file)))
      }
    }

    // generate encrypted buffer
    const buffer = await zip.generateAsync({ type: 'nodebuffer', streamFiles: true })
    const iv = randomBytes(cryptoConfig.IV_LENGTH)
    const cipher = createCipheriv('aes-256-cbc', Buffer.from(cryptoConfig.SECRET_KEY, 'hex'), iv)
    const encryptedBuffer = Buffer.concat([cipher.update(buffer), cipher.final()])

    // write encrypted zip to disk
    const fileStream = createWriteStream(output)
    const ivBuffer = Buffer.from(iv)
    fileStream.write(ivBuffer)
    fileStream.write(encryptedBuffer)
    fileStream.end()

    return new Promise((resolve, reject) => {
      fileStream.on('finish', resolve)
      fileStream.on('error', reject)
    })
  }
}
