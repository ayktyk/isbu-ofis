import { useRef, useState, useCallback } from 'react'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { FileX } from 'lucide-react'

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => React.ReactNode
  className?: string
  hideOnMobile?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  emptyMessage?: string
  emptyIcon?: React.ElementType
  /** Enable spotlight hover effect (radial gradient follows cursor) */
  spotlight?: boolean
}

export function DataTable<T>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'Kayıt bulunamadı.',
  emptyIcon: EmptyIcon = FileX,
  spotlight = true,
}: DataTableProps<T>) {
  const tableRef = useRef<HTMLDivElement>(null)
  const [spotlightPos, setSpotlightPos] = useState({ x: 0, y: 0, visible: false })

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!tableRef.current || !spotlight) return
    const rect = tableRef.current.getBoundingClientRect()
    setSpotlightPos({ x: e.clientX - rect.left, y: e.clientY - rect.top, visible: true })
  }, [spotlight])

  const handleMouseLeave = useCallback(() => {
    setSpotlightPos((prev) => ({ ...prev, visible: false }))
  }, [])

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full border-2 border-dashed border-muted-foreground/20 p-4">
          <EmptyIcon className="h-10 w-10 text-muted-foreground/40" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div
      ref={tableRef}
      className="relative overflow-hidden rounded-lg border bg-card"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Spotlight overlay */}
      {spotlight && spotlightPos.visible && (
        <div
          className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300"
          style={{
            background: `radial-gradient(400px circle at ${spotlightPos.x}px ${spotlightPos.y}px, hsl(var(--law-accent) / 0.06), transparent 60%)`,
            opacity: spotlightPos.visible ? 1 : 0,
          }}
        />
      )}

      <Table>
        <TableHeader>
          <TableRow className="border-b-2 bg-muted/30 hover:bg-muted/30">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  'text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                  col.className,
                  col.hideOnMobile && 'hidden md:table-cell'
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, rowIndex) => (
            <TableRow
              key={rowIndex}
              className={cn(
                'group relative transition-colors',
                onRowClick && 'cursor-pointer',
                rowIndex % 2 === 0 ? 'bg-transparent' : 'bg-muted/20',
                'hover:bg-law-accent/5'
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn(
                    'py-3',
                    col.className,
                    col.hideOnMobile && 'hidden md:table-cell'
                  )}
                >
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
