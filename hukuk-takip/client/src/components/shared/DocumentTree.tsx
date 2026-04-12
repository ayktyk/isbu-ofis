import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  File,
  FileSpreadsheet,
  FileImage,
  Download,
  Trash2,
} from 'lucide-react'

export interface TreeNode {
  id: string | number
  name: string
  type: 'folder' | 'file'
  /** File MIME type or extension hint */
  fileType?: string
  size?: string
  date?: string
  children?: TreeNode[]
  onDownload?: () => void
  onDelete?: () => void
}

interface DocumentTreeProps {
  nodes: TreeNode[]
  className?: string
}

function getFileIcon(fileType?: string) {
  if (!fileType) return File
  if (fileType.includes('pdf') || fileType.includes('doc')) return FileText
  if (fileType.includes('xls') || fileType.includes('sheet')) return FileSpreadsheet
  if (fileType.includes('image') || fileType.includes('jpg') || fileType.includes('png')) return FileImage
  return File
}

function TreeItem({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [open, setOpen] = useState(depth === 0)
  const isFolder = node.type === 'folder'
  const FolderIcon = open ? FolderOpen : Folder
  const FileIcon = getFileIcon(node.fileType)
  const hasChildren = isFolder && node.children && node.children.length > 0

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors',
          isFolder
            ? 'font-medium text-foreground hover:bg-muted/60 cursor-pointer'
            : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => isFolder && setOpen(!open)}
      >
        {/* Chevron for folders */}
        {isFolder ? (
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200',
              open && 'rotate-90'
            )}
          />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        {/* Icon */}
        {isFolder ? (
          <FolderIcon className="h-4 w-4 shrink-0 text-amber-500" />
        ) : (
          <FileIcon className="h-4 w-4 shrink-0 text-law-accent" />
        )}

        {/* Name */}
        <span className="flex-1 truncate">{node.name}</span>

        {/* Meta */}
        {!isFolder && (
          <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            {node.size && (
              <span className="text-xs text-muted-foreground">{node.size}</span>
            )}
            {node.onDownload && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); node.onDownload?.() }}
                className="rounded p-0.5 text-muted-foreground hover:text-law-accent transition-colors"
                title="İndir"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            )}
            {node.onDelete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); node.onDelete?.() }}
                className="rounded p-0.5 text-muted-foreground hover:text-red-500 transition-colors"
                title="Sil"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Folder count badge */}
        {isFolder && node.children && (
          <span className="text-xs text-muted-foreground/60">
            {node.children.length}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && open && (
        <div className="relative">
          {/* Tree line */}
          <div
            className="absolute top-0 bottom-2 w-px bg-border"
            style={{ left: `${depth * 16 + 20}px` }}
          />
          {node.children!.map((child) => (
            <TreeItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function DocumentTree({ nodes, className }: DocumentTreeProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="rounded-full border-2 border-dashed border-muted-foreground/20 p-3">
          <Folder className="h-8 w-8 text-muted-foreground/40" />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Henüz belge yüklenmedi.</p>
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg border bg-card p-2', className)}>
      {nodes.map((node) => (
        <TreeItem key={node.id} node={node} />
      ))}
    </div>
  )
}
