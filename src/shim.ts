/* eslint-disable @typescript-eslint/no-namespace */
export {}

declare global {
  namespace NodeJS {
    interface Process {
      pkg: {
        entrypoint: string | undefined
        defaultEntrypoint: string | undefined
      } | undefined
    }
  }
}
