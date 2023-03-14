/* eslint-disable guard-for-in */
import { findSongs } from './helpers'
import Song from './classes/Song'
import logger from './classes/logger'

async function init () {
  logger.log('Chorus Encore Validator - 14/03/2023')

  const results = await findSongs('C:\\Users\\Ahriana\\Downloads\\test', [])
  logger.log(`found ${results.length} songs`)

  for (const result of results) {
    const song = new Song(result)
    await song.validateSong()
  }
}

init()
