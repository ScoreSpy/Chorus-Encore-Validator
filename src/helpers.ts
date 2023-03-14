import type { SongArchive } from './types'
import { access, constants as FS_CONSTANTS, readdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export function fileExists (path: string): Promise<boolean> {
  return access(path, FS_CONSTANTS.F_OK).then(() => true).catch(() => false)
}

export async function findSongs (rootDir: string, results: SongArchive[]): Promise<SongArchive[]> {
  const files = await readdir(rootDir)
  let songFound = false

  for (const file of files) {
    const filePath = join(rootDir, file)

    if ((await stat(filePath)).isDirectory()) {
      await findSongs(filePath, results)
    // eslint-disable-next-line prefer-named-capture-group
    } else if (!songFound && (/notes\.(chart|mid)$/iu).test(file)) {
      const dirPath = dirname(filePath)

      let iniExists = false
      for (const subFile of files) {
        if (subFile.toLowerCase() === 'song.ini') {
          iniExists = true
          break
        }
      }

      if (iniExists) {
        songFound = true
        results.push({ baseFolder: dirPath, files })
      }
    }
  }

  return results
}
