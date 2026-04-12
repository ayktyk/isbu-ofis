import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { Router } from 'express'

const execFileAsync = promisify(execFile)
const router = Router()

// ---------------------------------------------------------------------------
// POST /mediation/generate-udf
// Converts plain-text mediation document content to UDF format via udf-cli.
// ---------------------------------------------------------------------------

router.post('/mediation/generate-udf', async (req, res, next) => {
  try {
    const { content, fileName, documentType } = req.body as {
      content?: string
      fileName?: string
      documentType?: string
    }

    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Belge icerigi bos.' })
      return
    }

    const validTypes = ['invitation', 'first_session', 'final_minutes', 'agreement']
    if (documentType && !validTypes.includes(documentType)) {
      res.status(400).json({ error: 'Gecersiz belge turu.' })
      return
    }

    // Convert plain text to basic HTML for udf-cli input
    const htmlContent = textToHtml(content)

    // Write to temp file
    const tempDir = tmpdir()
    const timestamp = Date.now()
    const htmlPath = join(tempDir, `mediation-${timestamp}.html`)
    const udfPath = join(tempDir, `mediation-${timestamp}.udf`)

    await fs.writeFile(htmlPath, htmlContent, 'utf-8')

    try {
      await execFileAsync('npx', ['udf-cli', 'html2udf', htmlPath, udfPath], {
        timeout: 30000,
        shell: true,
      })
    } catch (execErr) {
      // Clean up
      await fs.unlink(htmlPath).catch(() => {})
      await fs.unlink(udfPath).catch(() => {})

      const msg = execErr instanceof Error ? execErr.message : 'Bilinmeyen hata'
      res.status(500).json({ error: `UDF donusumu basarisiz: ${msg.slice(0, 200)}` })
      return
    }

    // Read UDF file and send
    const udfBuffer = await fs.readFile(udfPath)

    // Clean up temp files
    await fs.unlink(htmlPath).catch(() => {})
    await fs.unlink(udfPath).catch(() => {})

    const safeName = (fileName || 'arabuluculuk-belgesi')
      .replace(/[^a-zA-Z0-9\s_-]/gu, '')
      .replace(/\s+/gu, '_')
      .slice(0, 50)

    const encodedFilename = encodeURIComponent(`${fileName || 'arabuluculuk-belgesi'}.udf`)

    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeName}.udf"; filename*=UTF-8''${encodedFilename}`
    )
    res.send(udfBuffer)
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// Helper: Convert plain text to basic HTML structure
// Preserves line breaks, recognizes simple section headings (ALL CAPS lines),
// and wraps content in a proper HTML document for udf-cli parsing.
// ---------------------------------------------------------------------------

function textToHtml(text: string): string {
  const lines = text.split('\n')
  const bodyParts: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      // Empty line -> paragraph break
      bodyParts.push('<p>&nbsp;</p>')
      continue
    }

    // Detect section headings: all uppercase lines, at least 3 chars, no lowercase
    const isHeading =
      trimmed.length >= 3 &&
      trimmed === trimmed.toUpperCase() &&
      /[A-ZÇĞİÖŞÜ]/.test(trimmed) &&
      !/[a-zçğıöşü]/.test(trimmed)

    if (isHeading) {
      bodyParts.push(`<p><strong>${escapeHtml(trimmed)}</strong></p>`)
    } else {
      bodyParts.push(`<p>${escapeHtml(trimmed)}</p>`)
    }
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
${bodyParts.join('\n')}
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default router
