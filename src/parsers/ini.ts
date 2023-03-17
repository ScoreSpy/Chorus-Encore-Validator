/* eslint-disable @typescript-eslint/ban-ts-comment */

/*
 * Ported and updated from https://github.com/Paturages/chorus/blob/master/src/utils/meta/ini.js with permission from Paturages
 * this needs to be typed out correctly... hopefully not by me
 */

import * as Iconv from 'iconv-lite'
import { ChorusIni } from '../types/chorus'

const fieldBlacklist = {
  link: true,
  source: true,
  lastModified: true
}

function parse (ini: Buffer): ChorusIni | null {
  let source = Iconv.decode(ini, 'utf8')

  if (source.indexOf('�') > -1) { source = Iconv.decode(ini, 'latin-1') }
  if (source.indexOf('\u0000') > -1) { source = Iconv.decode(ini, 'utf16') }

  return source.split('\n').
    reduce((meta, line) => {
      // eslint-disable-next-line prefer-named-capture-group
      const [, param, value] = line.match(/([^=]+)=(.+)/u) || []

      if (!value || !value.trim() || (fieldBlacklist as unknown as { [x: string]: string })[param]) { return meta }

      // eslint-disable-next-line prefer-named-capture-group
      return Object.assign(meta, { [param.trim()]: value.trim().replace(/<[^>]*(b|i|color|size|material|quad)[^>]*>/ug, '') })
    }, {})
}

export default function parseIni (midiFile: Buffer): ChorusIni | null {
  try {
    return parse(midiFile)
  } catch (err) {
    console.error(err)
    return null
  }
}
