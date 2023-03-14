/* eslint-disable guard-for-in */
import { findSongs } from './helpers'
import Song from './classes/Song'

async function init () {
  const results = await findSongs('C:\\Users\\Ahriana\\Downloads\\test', [])

  for (const result of results) {
    const song = new Song(result)
    await song.validateSong()
  }
}

init()
