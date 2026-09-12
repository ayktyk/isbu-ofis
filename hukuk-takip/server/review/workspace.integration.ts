import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import express from 'express'
import jwt from 'jsonwebtoken'
import postgres from 'postgres'
import workspaceRouter from '../src/routes/workspace.js'
import casesRouter from '../src/routes/cases.js'
import { errorHandler } from '../src/middleware/errorHandler.js'
import type { Server } from 'node:http'

if (process.env.WORKSPACE_ISOLATED_TEST !== '1' || new URL(process.env.DATABASE_URL!).hostname !== '127.0.0.1') throw new Error('Tests require isolated local database')
const client = postgres(process.env.DATABASE_URL!, { max: 1 })
let server: Server, base: string, userId: string, caseId: string, token: string, hearingId: string
async function request(path: string, method = 'GET', body?: any, auth = token) { const r = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json() } }
before(async () => {
  const [owner] = await client`SELECT c.id, c.user_id FROM cases c JOIN users u ON u.id=c.user_id WHERE c.archived_at IS NULL AND c.status='active' AND u.role IN ('admin','lawyer') LIMIT 1`
  assert.ok(owner); userId = owner.user_id; caseId = owner.id
  token = jwt.sign({ userId, email: 'isolated-test@example.invalid' }, process.env.JWT_SECRET!)
  const [h] = await client`INSERT INTO case_hearings(case_id,hearing_date) VALUES(${caseId},'2026-01-01 09:00:00') RETURNING id`
  hearingId = h.id
  const app = express(); app.use(express.json()); app.use('/workspace', workspaceRouter); app.use('/cases', casesRouter)
  // Suppress personal record details in expected failures.
  app.use((err: any, _req: any, res: any, _next: any) => res.status(err.status || 500).json({ error: err.status ? err.message : 'Test transaction rejected' }))
  server = await new Promise<Server>(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  base = `http://127.0.0.1:${(server.address() as any).port}`
})
after(async () => { server?.close(); await client.end(); /* Drizzle pool closes its idle connections after 30 seconds. */ })
test('workflow saves independently, preserves case description and rejects stale revision', async () => {
  const [before] = await client`SELECT description FROM cases WHERE id=${caseId}`
  assert.equal((await request(`/workspace/${caseId}/workflow`)).body.revision, 0)
  const data = { stage: 'İnceleme', waitingFor: 'Test belge', checkDate: '2026-01-01', revision: 0 }
  assert.equal((await request(`/workspace/${caseId}/workflow`, 'PUT', data)).status, 200)
  assert.equal((await request(`/workspace/${caseId}/workflow`, 'PUT', data)).status, 409)
  const [after] = await client`SELECT description FROM cases WHERE id=${caseId}`; assert.deepEqual(after, before)
})
test('portfolio filters work before pagination, include workspace and hide foreign owner data', async () => {
  const list = await request('/cases?includeTracking=true&isCmk=include&trackingFilter=waiting&pageSize=1')
  assert.equal(list.status, 200); assert.equal(list.body.total, 1); assert.equal(list.body.data[0].id, caseId); assert.equal(list.body.data[0].workflow.stage, 'İnceleme')
  const foreign = jwt.sign({ userId: randomUUID() }, process.env.JWT_SECRET!)
  assert.equal((await request(`/workspace/${caseId}/workflow`, 'GET', undefined, foreign)).status, 404)
  assert.equal((await request('/cases?includeTracking=true', 'GET', undefined, foreign)).body.total, 0)
  assert.equal((await request('/cases?trackingFilter=invalid')).status, 400)
})
test('hearing review is atomic and concurrent retries do not duplicate records', async () => {
  const body = { requestId: randomUUID(), result: 'completed', note: 'İzole test sonucu', nextDate: '2026-10-01T09:00:00+03:00', tasks: [{ title: 'İzole test görevi', dueDate: null }] }
  const [before] = await client`SELECT (SELECT count(*)::int FROM tasks) AS tasks, (SELECT count(*)::int FROM case_hearings) AS hearings`
  const responses = await Promise.all([request(`/workspace/hearings/${hearingId}/review`, 'POST', body), request(`/workspace/hearings/${hearingId}/review`, 'POST', body)])
  assert.deepEqual(responses.map(r => r.status), [200, 200])
  assert.equal(responses.filter(r => r.body.repeated).length, 1)
  const [after] = await client`SELECT (SELECT count(*)::int FROM tasks) AS tasks, (SELECT count(*)::int FROM case_hearings) AS hearings`
  assert.equal(after.tasks, before.tasks + 1); assert.equal(after.hearings, before.hearings + 1)
  assert.equal((await request(`/workspace/hearings/${hearingId}/review`, 'POST', { ...body, note: 'Changed' })).status, 409)
})
test('database failure rolls back hearing result, next hearing and task creation together', async () => {
  const [h] = await client`INSERT INTO case_hearings(case_id,hearing_date) VALUES(${caseId},'2026-01-01') RETURNING id`
  await client`CREATE FUNCTION reject_test_task() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.title='FORCE_TEST_FAILURE' THEN RAISE EXCEPTION 'test failure'; END IF; RETURN NEW; END $$`
  await client`CREATE TRIGGER reject_test_task BEFORE INSERT ON tasks FOR EACH ROW EXECUTE FUNCTION reject_test_task()`
  const [before] = await client`SELECT count(*)::int AS n FROM case_hearings`
  const r = await request(`/workspace/hearings/${h.id}/review`, 'POST', { requestId: randomUUID(), result: 'completed', note: 'Rollback test', nextDate: '2026-10-01T09:00:00Z', tasks: [{ title: 'FORCE_TEST_FAILURE', dueDate: null }] })
  assert.equal(r.status, 500)
  const [check] = await client`SELECT result FROM case_hearings WHERE id=${h.id}`; assert.equal(check.result, 'pending')
  const [after] = await client`SELECT count(*)::int AS n FROM case_hearings`; assert.equal(after.n, before.n)
})
test('finished cases and assistant users cannot update workflows', async () => {
  await client`UPDATE cases SET status='closed' WHERE id=${caseId}`
  const body = { stage: 'Forbidden', waitingFor: '', checkDate: null, revision: 1 }
  assert.equal((await request(`/workspace/${caseId}/workflow`, 'PUT', body)).status, 403)
  await client`UPDATE cases SET status='active' WHERE id=${caseId}`
  await client`UPDATE users SET role='assistant' WHERE id=${userId}`
  assert.equal((await request(`/workspace/${caseId}/workflow`, 'PUT', body)).status, 403)
})
