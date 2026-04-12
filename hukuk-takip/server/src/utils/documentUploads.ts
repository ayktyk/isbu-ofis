import path from 'path'

export const MAX_DOCUMENT_FILE_SIZE_BYTES = 75 * 1024 * 1024
export const MAX_DOCUMENT_FILES_PER_REQUEST = 20

export const SUPPORTED_DOCUMENT_EXTENSIONS = [
  '.pdf',
  '.udf',
  '.zip',
  '.tif',
  '.tiff',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.bmp',
  '.heic',
  '.heif',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
] as const

export const SUPPORTED_DOCUMENT_EXTENSION_SET = new Set<string>(SUPPORTED_DOCUMENT_EXTENSIONS)

export const SUPPORTED_DOCUMENT_MIME_TYPES = new Set<string>([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
  'image/tiff',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/heic',
  'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

export function getDocumentExtension(fileName: string) {
  return path.extname(fileName || '').toLowerCase()
}

export function isSupportedDocumentFile(fileName: string, mimeType?: string | null) {
  const extension = getDocumentExtension(fileName)
  if (!SUPPORTED_DOCUMENT_EXTENSION_SET.has(extension)) {
    return false
  }

  if (!mimeType || mimeType.trim() === '') {
    return true
  }

  return SUPPORTED_DOCUMENT_MIME_TYPES.has(mimeType.toLowerCase())
}

export function formatAllowedDocumentExtensions() {
  return SUPPORTED_DOCUMENT_EXTENSIONS.join(', ')
}
