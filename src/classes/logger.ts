import * as fs from 'node:fs/promises'
import { getFilesafeTimestamp } from '../helpers'

export class FileLogger {
  private readonly name: string;
  private readonly logFile: string;

  constructor (name: string, logFile: string) {
    this.name = name
    this.logFile = logFile
  }

  public async log (message: string): Promise<void> {
    const timestamp = new Date().toLocaleString()
    const logLine = `[${timestamp}] [${this.name}] ${message}\n`
    try {
      await fs.appendFile(this.logFile, logLine)
    } catch (error) {
      console.error(`Failed to write log to file: ${error}`)
    }
  }
}

export default new FileLogger('ChorusEncore', `encore_${getFilesafeTimestamp()}.log`)
