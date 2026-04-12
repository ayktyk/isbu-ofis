import type { Request } from 'express'
import { Router } from 'express'
import fs from 'fs/promises'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { cases, documents } from '../db/schema.js'
import { authenticate } from '../middleware/auth.js'
import { getSingleValue } from '../utils/request.js'
import {
  MAX_DOCUMENT_FILES_PER_REQUEST,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
  formatAllowedDocumentExtensions,
  isSupportedDocumentFile,
} from '../utils/documentUploads.js'

const router = Router()
const CURRENT_FILE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const LOCAL_DOCUMENTS_ROOT = path.resolve(CURRENT_FILE_DIRECTORY, '../../uploads/case-documents')
const TEMP_DOCUMENTS_ROOT = path.resolve(CURRENT_FILE_DIRECTORY, '../../uploads/tmp-documents')

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, TEMP_DOCUMENTS_ROOT),
    filename: (_req, file, callback) => {
      callback(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeFilename(file.originalname)}`)
    },
  }),
  limits: {
    fileSize: MAX_DOCUMENT_FILE_SIZE_BYTES,
    files: MAX_DOCUMENT_FILES_PER_REQUEST,
  },
  fileFilter: (_req, file, callback) => {
    if (!isSupportedDocumentFile(file.originalname, file.mimetype)) {
      callback(
        new Error(
          `Desteklenmeyen dosya tipi: ${file.originalname}. Izin verilen formatlar: ${formatAllowedDocumentExtensions()}`
        )
      )
      return
    }

    callback(null, true)
  },
})

const uploadMiddleware = upload.fields([
  { name: 'files', maxCount: MAX_DOCUMENT_FILES_PER_REQUEST },
  { name: 'file', maxCount: 1 },
])

router.use(authenticate)

type UploadedFileMap = {
  [fieldname: string]: Express.Multer.File[]
}

function sanitizeFilename(fileName: string) {
  const baseName = path.basename(fileName, path.extname(fileName))
  const extension = path.extname(fileName)
  const safeBaseName = baseName
    .replace(/[^a-zA-Z0-9Ã§ÄŸÄ±Ã¶ÅŸÃ¼Ã‡ÄÄ°Ã–ÅÃœ._\s-]+/gu, '-')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')

  const normalizedExtension = extension.replace(/[^a-zA-Z0-9.]+/g, '').slice(0, 20)
  return `${safeBaseName || 'document'}${normalizedExtension || ''}`
}

function normalizeAbsolutePath(targetPath: string) {
  return path.resolve(targetPath)
}

function isPathInside(parentPath: string, targetPath: string) {
  const normalizedParent = normalizeAbsolutePath(parentPath).toLowerCase()
  const normalizedTarget = normalizeAbsolutePath(targetPath).toLowerCase()
  return normalizedTarget === normalizedParent || normalizedTarget.startsWith(`${normalizedParent}${path.sep}`)
}

function getUploadedFiles(req: Request) {
  const fileMap = req.files as UploadedFileMap | undefined
  if (!fileMap) {
    return []
  }

  return [...(fileMap.files ?? []), ...(fileMap.file ?? [])]
}

async function cleanupTemporaryFiles(files: Express.Multer.File[]) {
  await Promise.all(
    files.map(async (file) => {
      if (!file.path) return

      try {
        await fs.unlink(file.path)
      } catch (error: any) {
        if (error?.code !== 'ENOENT') {
          console.error('[Documents][TempCleanup]', error)
        }
      }
    })
  )
}

async function runUploadMiddleware(req: Request, res: Parameters<typeof uploadMiddleware>[1]) {
  await fs.mkdir(TEMP_DOCUMENTS_ROOT, { recursive: true })

  return new Promise<void>((resolve, reject) => {
    uploadMiddleware(req, res, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

async function getOwnedCase(userId: string, caseId: string) {
  const [caseRecord] = await db
    .select({
      id: cases.id,
      title: cases.title,
    })
    .from(cases)
    .where(and(eq(cases.id, caseId), eq(cases.userId, userId)))
    .limit(1)

  return caseRecord ?? null
}

function buildStorageDirectory(caseRecord: { id: string }) {
  return path.join(LOCAL_DOCUMENTS_ROOT, caseRecord.id)
}

function formatUploadError(error: unknown) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return `Her bir belge en fazla ${(MAX_DOCUMENT_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0)} MB olabilir.`
    }

    if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
      return `Tek seferde en fazla ${MAX_DOCUMENT_FILES_PER_REQUEST} belge yukleyebilirsiniz.`
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Belge yuklenemedi.'
}

router.post('/', async (req, res) => {
  let uploadedFiles: Express.Multer.File[] = []

  try {
    await runUploadMiddleware(req, res)
    uploadedFiles = getUploadedFiles(req)

    const caseId = typeof req.body.caseId === 'string' ? req.body.caseId : ''
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : ''

    if (!caseId) {
      await cleanupTemporaryFiles(uploadedFiles)
      res.status(400).json({ error: 'Dava secilmedi.' })
      return
    }

    if (uploadedFiles.length === 0) {
      res.status(400).json({ error: 'Yuklenecek dosya bulunamadi.' })
      return
    }

    const caseRecord = await getOwnedCase(req.user!.userId, caseId)
    if (!caseRecord) {
      await cleanupTemporaryFiles(uploadedFiles)
      res.status(404).json({ error: 'Dava bulunamadi.' })
      return
    }

    const storageDirectory = buildStorageDirectory(caseRecord)
    await fs.mkdir(storageDirectory, { recursive: true })

    const createdDocuments = []

    for (const [index, file] of uploadedFiles.entries()) {
      const storedFileName = `${Date.now()}-${index + 1}-${sanitizeFilename(file.originalname)}`
      const storedFilePath = path.join(storageDirectory, storedFileName)

      await fs.copyFile(file.path, storedFilePath)

      const [document] = await db
        .insert(documents)
        .values({
          caseId,
          uploadedBy: req.user!.userId,
          fileName: file.originalname,
          fileUrl: storedFilePath,
          fileSize: file.size,
          mimeType: file.mimetype || null,
          description: description || null,
        })
        .returning()

      createdDocuments.push({
        ...document,
        downloadUrl: `/api/documents/${document.id}/download`,
      })
    }

    await cleanupTemporaryFiles(uploadedFiles)

    res.status(201).json({
      uploadedCount: createdDocuments.length,
      documents: createdDocuments,
    })
  } catch (error) {
    await cleanupTemporaryFiles(uploadedFiles)

    const message = formatUploadError(error)
    const statusCode =
      error instanceof multer.MulterError ||
      (error instanceof Error && error.message.startsWith('Desteklenmeyen dosya tipi'))
        ? 400
        : 500

    console.error('[Documents][Upload]', error)
    res.status(statusCode).json({ error: message })
  }
})

router.get('/:id/download', async (req, res) => {
  try {
    const documentId = getSingleValue(req.params.id)

    if (!documentId) {
      res.status(400).json({ error: 'Gecersiz belge id.' })
      return
    }

    const [document] = await db
      .select({
        id: documents.id,
        fileName: documents.fileName,
        fileUrl: documents.fileUrl,
      })
      .from(documents)
      .innerJoin(cases, eq(documents.caseId, cases.id))
      .where(and(eq(documents.id, documentId), eq(cases.userId, req.user!.userId)))
      .limit(1)

    if (!document) {
      res.status(404).json({ error: 'Belge bulunamadi.' })
      return
    }

    await fs.access(document.fileUrl)
    res.download(document.fileUrl, document.fileName)
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      res.status(404).json({ error: 'Belge dosyasi bulunamadi.' })
      return
    }

    console.error('[Documents][Download]', error)
    res.status(500).json({ error: 'Belge indirilemedi.' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const documentId = getSingleValue(req.params.id)

    if (!documentId) {
      res.status(400).json({ error: 'Gecersiz belge id.' })
      return
    }

    const [document] = await db
      .select({
        id: documents.id,
        fileUrl: documents.fileUrl,
      })
      .from(documents)
      .innerJoin(cases, eq(documents.caseId, cases.id))
      .where(and(eq(documents.id, documentId), eq(cases.userId, req.user!.userId)))
      .limit(1)

    if (!document) {
      res.status(404).json({ error: 'Belge bulunamadi.' })
      return
    }

    if (isPathInside(LOCAL_DOCUMENTS_ROOT, document.fileUrl)) {
      try {
        await fs.unlink(document.fileUrl)
      } catch (error: any) {
        if (error?.code !== 'ENOENT') {
          throw error
        }
      }
    }

    await db.delete(documents).where(eq(documents.id, documentId))
    res.json({ message: 'Belge silindi.' })
  } catch (error) {
    console.error('[Documents][Delete]', error)
    res.status(500).json({ error: 'Belge silinemedi.' })
  }
})

export default router
