/* eslint-disable guard-for-in */
import { findSongs } from './helpers'
import Song from './classes/Song'
import logger from './classes/logger'
import { SongData } from './types'
import { writeFile } from 'node:fs/promises'

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
    await song.createEncryptedArchive()
  }

  await writeFile('output.json', JSON.stringify(output, null, 4))
  logger.log('metadata writen to disk')
}

init()
