// Avukat tarafı (JWT): dosya nabzı — her açık dosyada "sırada ne var?".
import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { loadCasePulse } from '../utils/pulseLoader.js'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  res.json(await loadCasePulse(req.user!.userId))
})

export default router
