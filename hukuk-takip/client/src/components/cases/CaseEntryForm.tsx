import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, Plus } from 'lucide-react'

// Keep inputs mounted while collapsed so file selections and draft text survive.
export default function CaseEntryForm({ label, canWrite, children }: {
  label: string
  canWrite: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  if (!canWrite) return null
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)} className="flex min-h-11 w-full items-center gap-2 text-left text-sm font-medium text-law-accent">
        <Plus className="h-4 w-4" />{label}
        <ChevronDown className={`ml-auto h-4 w-4 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </button>
      <div id={id} hidden={!open} className="space-y-3 pt-3">{children}</div>
    </div>
  )
}
