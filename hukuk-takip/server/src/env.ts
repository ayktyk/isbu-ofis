import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// .env root'ta: server/src/ → server/ → hukuk-takip/
// override: true — sistem env'de boş ANTHROPIC_API_KEY varsa .env'deki değeri yükler
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true })
