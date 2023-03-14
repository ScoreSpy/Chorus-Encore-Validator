import { constants as FS_CONSTANTS } from 'node:fs'
import { access, readdir, stat } from 'node:fs/promises'
import { basename, dirname, join, normalize } from 'node:path'
import { BinaryLike, createHash } from 'node:crypto'
import { createInterface } from 'node:readline'
import type { SongArchive } from './types'

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

export function createMD5 (data: BinaryLike) {
  return createHash('md5').update(data).digest('hex')
}

export function getFilesafeTimestamp () {
  const currentDate = new Date()
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1
  const day = currentDate.getDate()
  const hours = currentDate.getHours()
  const minutes = currentDate.getMinutes()
  const seconds = currentDate.getSeconds()

  return `${year}_${month.toString().padStart(2, '0')}_${day.toString().padStart(2, '0')}__${hours.toString().padStart(2, '0')}_${minutes.toString().padStart(2, '0')}_${seconds.toString().padStart(2, '0')}`
}

export function replacePathPart (filePath: string, oldPart: string, newPart: string): string {
  const dir = dirname(filePath)
  const base = basename(filePath)
  const newDir = dir.replace(normalize(oldPart), normalize(newPart))
  const newPath = join(newDir, base)
  return newPath
}

export function sanitizeFileName (fileName: string): string {
  const invalidChars = /[<>:"/\\|?*\x00-\x1F]/ug
  // eslint-disable-next-line prefer-named-capture-group
  const invalidNames = /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(\..*)?$/ui
  const sanitizedFileName = fileName.replace(invalidChars, '_')

  if (invalidNames.test(sanitizedFileName)) { return 'invalid_file_name' }

  return sanitizedFileName
}

export function askQuestion (question: string, expected: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const rl = createInterface(process.stdin, process.stdout)
    rl.question(`${question}\n`, (answer) => {
      if (answer.toLowerCase() !== expected.toLowerCase()) { return reject(new Error('invalid input')) }
      return resolve()
    })
  })
}

export function keyPress (): Promise<void> {
  console.log('\nPress Any Key To Exit')
  process.stdin.setRawMode(true)
  return new Promise(() => process.stdin.once('data', () => {
    console.log('\n^C')
    process.exit(1)
  }))
}
