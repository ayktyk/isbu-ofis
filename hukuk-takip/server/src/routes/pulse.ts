// Avukat tarafı (JWT): dosya nabzı — her açık dosyada "sırada ne var?".
import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { loadCasePulse } from '../utils/pulseLoader.js'
import { schemaNotReadyHandler } from '../middleware/schemaGuard.js'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  res.json(await loadCasePulse(req.user!.userId))
})

// Dağıtım penceresinde (rev14/rev15 henüz kurulmadıysa) 503 SCHEMA_NOT_READY.
router.use(schemaNotReadyHandler)

export default router
