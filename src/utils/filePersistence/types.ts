export const DEFAULT_UPLOAD_CONCURRENCY = 4
export const FILE_COUNT_LIMIT = 100
export const OUTPUTS_SUBDIR = 'outputs'

export type FailedPersistence = { path: string; error: string }
export type PersistedFile = { path: string; url: string }
export type TurnStartTime = { turnId: string; startTime: number }
export type FilesPersistedEventData = {
  files: PersistedFile[]
  failed: FailedPersistence[]
}
