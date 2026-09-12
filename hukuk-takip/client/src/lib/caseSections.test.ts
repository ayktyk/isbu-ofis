import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'

const fixture = vi.hoisted(() => ({ role: 'lawyer', status: 'active' }))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { role: fixture.role } }) }))
vi.mock('@/hooks/useCases', () => {
  const mutation = () => ({ mutate: vi.fn(), isPending: false })
  return {
    useCaseDetail: () => ({ data: {
      case: { id: 'case-1', title: 'Örnek dava', status: fixture.status, clientName: 'Örnek müvekkil', caseType: 'diger', currency: 'TRY', contractedFee: '1000' },
      tasks: [{ id: 'task-1', title: 'Açık görev', status: 'pending', priority: 'medium' }],
      hearings: [], notes: [{ id: 'note-1', content: 'Korunacak eski not', createdAt: '2026-01-01' }],
      documents: [{ id: 'doc-1', fileName: 'korunan-belge.pdf', fileSize: 1024 }],
      expenses: [], collections: [],
    }, isLoading: false, isError: false }),
    useDeleteCase: mutation, useCreateCollection: mutation, useCreateDocument: mutation,
    useCreateExpense: mutation, useDeleteCollection: mutation, useDeleteDocument: mutation, useDeleteExpense: mutation,
  }
})
vi.mock('@/hooks/useTasks', () => ({
  useCreateTask: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateTaskStatus: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/hooks/useHearings', () => ({
  useCreateHearing: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteHearing: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/hooks/useNotes', () => ({
  useCreateNote: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteNote: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/hooks/useCaseDiary', () => ({
  useCaseDiary: () => ({ data: [], isLoading: false, isError: false }),
  useCaseNextStep: () => ({ data: null }),
  useCreateDiaryEntry: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteDiaryEntry: () => ({ mutate: vi.fn(), isPending: false }),
  useToggleNextStepDone: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/components/cases/FeeInstallmentTable', () => ({ default: () => null }))
vi.mock('@/components/deadlines/NewLegalDeadlineForm', () => ({ NewLegalDeadlineForm: () => null }))
import CaseDetailPage from '@/pages/CaseDetailPage'

function render(section = 'overview') {
  return renderToStaticMarkup(createElement(StaticRouter, { location: `/cases/case-1?section=${section}` }, createElement(CaseDetailPage)))
}

describe('case sections preserve records and respect write permissions', () => {
  beforeEach(() => { fixture.role = 'lawyer'; fixture.status = 'active' })
  it('keeps old records mounted in every section and opens only the requested panel', () => {
    const html = render('documents')
    expect(html).toContain('Korunacak eski not')
    expect(html).toContain('korunan-belge.pdf')
    expect(html).toContain('Açık görev')
    const panels = html.match(/<div[^>]*role="tabpanel"[^>]*>/g) || []
    expect(panels).toHaveLength(4)
    expect(panels.filter(panel => panel.includes('data-state="active"'))).toHaveLength(1)
    expect(panels[2]).toContain('data-state="active"')
    expect(html).toContain('aria-expanded="false"')
  })
  it('allows assistants to complete tasks while keeping creation forms unavailable', () => {
    fixture.role = 'assistant'
    const html = render('work')
    expect(html).toContain('>Tamamla</button>')
    expect(html).not.toContain('Görev ekle')
    expect(html).not.toContain('<form')
    expect(html).toContain('Korunacak eski not')
  })
  it.each(['won', 'lost', 'settled', 'closed'])('makes %s cases read-only, including for admin', status => {
    fixture.role = 'admin'; fixture.status = status
    const html = render('work')
    expect(html).not.toContain('>Tamamla</button>')
    expect(html).not.toContain('<form')
    expect(html).toContain('yalnızca görüntülenebilir')
    expect(html).toContain('korunan-belge.pdf')
  })
})
