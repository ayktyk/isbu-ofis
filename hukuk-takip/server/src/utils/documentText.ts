import { spawn } from 'child_process'
import { fileURLToPath } from 'url'

const DOCUMENT_TEXT_SCRIPT = fileURLToPath(new URL('./document_text_extract.py', import.meta.url))

type ExtractionResult = {
  status: 'extracted' | 'empty' | 'unsupported' | 'error'
  sourceType: string
  text: string
  error?: string | null
}

export type IntakeDocumentEnrichment = {
  extractedText: string | null
  extractionStatus: ExtractionResult['status']
  extractionSourceType: string | null
  extractionError: string | null
}

async function runPythonExtractor(targetPath: string): Promise<ExtractionResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn('python', [DOCUMENT_TEXT_SCRIPT, '--path', targetPath, '--max-chars', '5000'], {
      shell: false,
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8')
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8')
    })

    child.on('error', reject)

    child.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || 'Belge metni okunamadi.'))
        return
      }

      try {
        resolve(JSON.parse(stdout.trim()) as ExtractionResult)
      } catch (error) {
        reject(error)
      }
    })
  })
}

export async function extractDocumentForIntake(targetPath?: string | null): Promise<IntakeDocumentEnrichment> {
  if (!targetPath) {
    return {
      extractedText: null,
      extractionStatus: 'unsupported',
      extractionSourceType: null,
      extractionError: 'Belge yolu yok.',
    }
  }

  try {
    const result = await runPythonExtractor(targetPath)
    return {
      extractedText: result.text?.trim() ? result.text.trim() : null,
      extractionStatus: result.status,
      extractionSourceType: result.sourceType || null,
      extractionError: result.error || null,
    }
  } catch (error: any) {
    return {
      extractedText: null,
      extractionStatus: 'error',
      extractionSourceType: null,
      extractionError: error?.message || 'Belge metni okunamadi.',
    }
  }
}
