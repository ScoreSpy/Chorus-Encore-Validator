import { findSongs } from './helpers'

async function init () {
  const results = await findSongs('C:\\Users\\Ahriana\\Downloads\\test', [])
  console.log(results)
  console.log(results.length)
}

init()
