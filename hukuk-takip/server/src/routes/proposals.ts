// Avukat tarafı (JWT): asistan önerilerini inceleme, onaylama, reddetme.
import { Router, type Response } from 'express'
import { z } from 'zod'
import {
  approveProposalSchema,
  bulkProposalSchema,
  proposalStatusValues,
  rejectProposalSchema,
} from '@hukuk-takip/shared'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { approveProposal, bulkDecide, listProposals, rejectProposal } from '../services/proposalService.js'
import { HttpError } from '../services/proposalTargets.js'
import { getSingleValue } from '../utils/request.js'
import { schemaNotReadyHandler } from '../middleware/schemaGuard.js'

const router = Router()
router.use(authenticate)

export function sendHttpError(res: Response, error: unknown) {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message, ...(error.details ? { details: error.details } : {}), ...(error.extra ?? {}) })
    return
  }
  throw error
}

router.get('/', async (req, res) => {
  const status = getSingleValue(req.query.status) || 'pending'
  if (status !== 'all' && !(proposalStatusValues as readonly string[]).includes(status)) {
    res.status(400).json({ error: 'Geçersiz durum filtresi.' })
    return
  }
  const caseId = getSingleValue(req.query.caseId)
  if (caseId && !z.string().uuid().safeParse(caseId).success) {
    res.status(400).json({ error: 'Geçersiz dava id.' })
    return
  }
  const rows = await listProposals(req.user!.userId, {
    status,
    kind: getSingleValue(req.query.kind) || undefined,
    caseId: caseId || undefined,
  })
  res.json(rows)
})

router.post('/bulk', validate(bulkProposalSchema), async (req, res) => {
  const { ids, action, note, expected_updated_at } = bulkProposalSchema.parse(req.body)
  res.json({ results: await bulkDecide(req.user!.userId, ids, action, note, expected_updated_at) })
})

router.post('/:id/approve', validate(approveProposalSchema), async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id)
  if (!id.success) {
    res.status(400).json({ error: 'Geçersiz öneri kimliği.' })
    return
  }
  const body = approveProposalSchema.parse(req.body)
  try {
    const result = await approveProposal(req.user!.userId, id.data, body.payload, body.note, {
      expectedUpdatedAt: body.expected_updated_at,
      forceOverwrite: body.force_overwrite === true,
    })
    res.status(result.status === 'failed' ? 422 : 200).json(result)
  } catch (error) {
    sendHttpError(res, error)
  }
})

router.post('/:id/reject', validate(rejectProposalSchema), async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id)
  if (!id.success) {
    res.status(400).json({ error: 'Geçersiz öneri kimliği.' })
    return
  }
  try {
    const body = rejectProposalSchema.parse(req.body)
    res.json(await rejectProposal(req.user!.userId, id.data, body.note, body.expected_updated_at))
  } catch (error) {
    sendHttpError(res, error)
  }
})

// Dağıtım penceresinde (rev14/rev15 henüz kurulmadıysa) 503 SCHEMA_NOT_READY.
router.use(schemaNotReadyHandler)

export default router
