import * as fs from 'node:fs'
import { getFilesafeTimestamp } from '../helpers'

export class FileLogger {
  private readonly name: string;
  private readonly logFile: string;

  constructor (name: string, logFile: string) {
    this.name = name
    this.logFile = logFile
  }

  public log (message: string): void {
    const timestamp = new Date().toLocaleString()
    const logLine = `[${timestamp}] [${this.name}] ${message}\n`
    fs.appendFile(this.logFile, logLine, (err) => {
      if (err) {
        console.error(`Failed to write log to file: ${err}`)
      }
    })
  }
}

export default new FileLogger('ChorusEncore', `encore_${getFilesafeTimestamp()}.log`)
