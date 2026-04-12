export const DOCUMENT_ACCEPT_ATTRIBUTE = [
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
].join(',')

export const DOCUMENT_UPLOAD_HELP_TEXT =
  'PDF, UDF, ZIP, TIFF/TIF, JPG, PNG, WEBP, HEIC, Word ve Excel dosyaları desteklenir. PNG/JPG/TIFF için OCR uygulanır.'

export const MAX_DOCUMENT_UPLOAD_FILES = 20
export const MAX_DOCUMENT_UPLOAD_SIZE_MB = 75

export function getDocumentExtension(fileName?: string | null) {
  if (!fileName) {
    return ''
  }

  const lastDotIndex = fileName.lastIndexOf('.')
  return lastDotIndex === -1 ? '' : fileName.slice(lastDotIndex + 1).toLowerCase()
}

export function getDocumentTypeLabel(fileName?: string | null) {
  const extension = getDocumentExtension(fileName)

  switch (extension) {
    case 'pdf':
      return 'PDF'
    case 'udf':
      return 'UDF'
    case 'zip':
      return 'ZIP'
    case 'tif':
    case 'tiff':
      return 'TIFF'
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'webp':
    case 'bmp':
    case 'heic':
    case 'heif':
      return 'Foto'
    case 'doc':
    case 'docx':
      return 'Word'
    case 'xls':
    case 'xlsx':
      return 'Excel'
    default:
      return extension ? extension.toUpperCase() : '-'
  }
}
