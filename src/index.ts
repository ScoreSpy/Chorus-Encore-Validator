/* eslint-disable guard-for-in */
import './shim'
import { fileExists, findSongs, replacePathPart, sanitizeFileName } from './helpers'
import { join, parse } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import type { ApplicationArguments, SongData } from './types'
import logger from './classes/logger'
import Song from './classes/Song'
import yargs from 'yargs'

const isPackaged = Boolean(process.pkg)

async function init () {
  logger.log('Chorus Encore Validator - 14/03/2023')
  console.log('Chorus Encore Validator - 14/03/2023')

  // eslint-disable-next-line init-declarations
  let appArguments: ApplicationArguments

  if (isPackaged) {
    const { argv } = yargs(process.argv.slice(2)).
      option('baseDir', {
        type: 'string',
        description: 'The path to the base directory.',
        demandOption: true
      }).
      option('shadowDir', {
        type: 'string',
        description: 'The path to the shadow directory.',
        demandOption: true
      }).
      option('dryRun', {
        type: 'boolean',
        description: 'Perform a dry run without actually copying files.',
        default: false
      }).
      help().
      alias('help', 'h')

    appArguments = argv as ApplicationArguments
  } else {
    const config = await import('./../devconfig.json')

    appArguments = {
      baseDir: config.baseDir,
      shadowDir: config.shadowDir,
      dryRun: config.dryRun
    }
  }

  const results = await findSongs(appArguments.baseDir, [])
  logger.log(`found ${results.length} songs`)
  console.log(`found ${results.length} songs`)

  const output: SongData[] = []

  for (const result of results) {
    const song = new Song(result)
    await song.validateSong()
    if (appArguments.dryRun) { continue }

    const data = song.toJSON()
    if (data === null) { continue }

    output.push(data)
    const outputPath = replacePathPart(parse(song.baseDir).dir, appArguments.baseDir, appArguments.shadowDir)
    if (!await fileExists(outputPath)) { await mkdir(outputPath, { recursive: true }) }
    await song.createEncryptedArchive(join(outputPath, sanitizeFileName(`${parse(song.baseDir).base}.ce`)))
  }

  if (appArguments.dryRun) {
    await logger.log('Metadata not writen to disk, Application ran in dry mode')
    await console.log('Metadata not writen to disk, Application ran in dry mode')
  } else {
    await writeFile('output.json', JSON.stringify(output, null, 4))
    await logger.log('Metadata writen to disk, upload this to your ScoreSpy dashboard to make them downloadable via Chorus Encore')
    await console.log('Metadata writen to disk, upload this to your ScoreSpy dashboard to make them downloadable via Chorus Encore')
  }
}

init()
