import { parse } from 'node:path'

export const SupportedVideoNames = ['highway', 'video']
export const SupportedVideoFormats = ['.mp4', '.avi', '.webm', '.vp8', '.ogv', '.mpeg']

export const SupportedImageNames = ['album', 'background', 'highway']
export const SupportedImageFormats = ['.png', '.jpg', '.jpeg']

export const SupportedStemNames = ['guitar', 'bass', 'rhythm', 'vocals', 'vocals_1', 'vocals_2', 'drums', 'drums_1', 'drums_2', 'drums_3', 'drums_4', 'keys', 'song', 'crowd']
export const SupportedAudioFormats = ['.ogg', '.mp3', '.wav', '.opus']

export const SupportedChartNames = ['notes']
export const SupportedChartFormats = ['.mid', '.chart']

export const SupportedConfigNames = ['song']
export const SupportedConfigFormats = ['.ini']

export function isSupportedFile (fileName: string, includeVideo = true): boolean {
  const File = parse(fileName)
  const FileName = File.name.toLocaleLowerCase()
  const FileExt = File.ext.toLocaleLowerCase()

  if (SupportedChartNames.includes(FileName) && SupportedChartFormats.includes(FileExt)) {
    return true
  } else if (SupportedConfigNames.includes(FileName) && SupportedConfigFormats.includes(FileExt)) {
    return true
  } else if (includeVideo && SupportedVideoNames.includes(FileName) && SupportedVideoFormats.includes(FileExt)) {
    return true
  } else if (SupportedImageNames.includes(FileName) && SupportedImageFormats.includes(FileExt)) {
    return true
  } else if (SupportedStemNames.includes(FileName) && SupportedAudioFormats.includes(FileExt)) {
    return true
  }

  return false
}

export default {
  SupportedVideoNames,
  SupportedVideoFormats,

  SupportedImageNames,
  SupportedImageFormats,

  SupportedStemNames,
  SupportedAudioFormats,

  SupportedChartNames,
  SupportedChartFormats,

  SupportedConfigNames,
  SupportedConfigFormats,

  isSupportedFile
}
