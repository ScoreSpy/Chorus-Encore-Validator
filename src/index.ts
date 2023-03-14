/* eslint-disable guard-for-in */
import { fileExists, findSongs, replacePathPart } from './helpers'
import Song from './classes/Song'
import logger from './classes/logger'
import { SongData } from './types'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, parse } from 'node:path'

const BASE_DIR = 'C:\\Users\\Ahriana\\Downloads\\test'
const SHADOW_DIR = 'C:\\Users\\Ahriana\\Documents\\Projects\\Chorus Encore\\Chorus-Encore-Validator\\shadow'

async function init () {
  logger.log('Chorus Encore Validator - 14/03/2023')

  const results = await findSongs('C:\\Users\\Ahriana\\Downloads\\test', [])
  logger.log(`found ${results.length} songs`)

  const output: SongData[] = []

  for (const result of results) {
    const song = new Song(result)
    await song.validateSong()
    const data = song.toJSON()
    if (data === null) { continue }
    output.push(data)
    const outputPath = replacePathPart(parse(song.baseDir).dir, BASE_DIR, SHADOW_DIR)

    if (!await fileExists(outputPath)) {
      await mkdir(outputPath, { recursive: true })
    }

    await song.createEncryptedArchive(join(outputPath, `${parse(song.baseDir).base}.ce`))
  }

  await writeFile('output.json', JSON.stringify(output, null, 4))
  logger.log('metadata writen to disk')
}

init()
