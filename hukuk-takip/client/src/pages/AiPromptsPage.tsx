import { useState } from 'react'
import { Copy, Download, ChevronDown, ChevronUp, Sparkles, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { promptData, type PromptTemplate } from '@/components/tools/prompts/promptData'

const allCategories = ['Tumu', ...Array.from(new Set(promptData.map((p) => p.category)))]

export default function AiPromptsPage() {
  const [selectedCategory, setSelectedCategory] = useState('Tumu')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const filteredPrompts =
    selectedCategory === 'Tumu'
      ? promptData
      : promptData.filter((p) => p.category === selectedCategory)

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const handleCopy = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = content
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const handleDownload = (prompt: PromptTemplate) => {
    const mdContent = `# ${prompt.title}\n\n**Kategori:** ${prompt.category}\n**Açıklama:** ${prompt.description}\n\n---\n\n${prompt.content}`
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${prompt.id}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Prompt Şablonları"
        description="Hukuki analizler için hazır yapay zeka prompt şablonları"
      />

      {/* Info Box */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
        <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <p className="font-medium">Nasıl Kullanılır?</p>
          <p className="mt-1">
            Aşağıdaki şablonları kopyalayıp Gemini, Claude veya ChatGPT gibi yapay zeka araçlarında
            kullanabilirsiniz. Köşeli parantez içindeki alanları [...] kendi dava bilgilerinizle
            değiştirin.
          </p>
        </div>
      </div>

      {/* Warning Box */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="text-sm text-amber-800 dark:text-amber-300">
          <p className="font-medium">Önemli Uyarı</p>
          <p className="mt-1">
            Bu şablonlar yalnızca referans amaçlıdır. Yapay zeka çıktıları hukuki danışmanlık
            yerine geçmez. Tüm taslaklar mutlaka bir avukat tarafından kontrol edilmelidir.
          </p>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        {allCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              selectedCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Prompt Cards */}
      <div className="space-y-3">
        {filteredPrompts.map((prompt) => {
          const isExpanded = expandedId === prompt.id
          const isCopied = copiedId === prompt.id

          return (
            <div
              key={prompt.id}
              className="rounded-lg border bg-card text-card-foreground shadow-sm"
            >
              {/* Card Header */}
              <button
                onClick={() => toggleExpand(prompt.id)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {prompt.badge}
                  </span>
                  <div>
                    <h3 className="font-semibold">{prompt.title}</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">{prompt.description}</p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                )}
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t px-4 pb-4 pt-3">
                  <pre className="max-h-[500px] overflow-auto rounded-md bg-muted/50 p-4 text-sm leading-relaxed whitespace-pre-wrap break-words font-mono">
                    {prompt.content}
                  </pre>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleCopy(prompt.content, prompt.id)}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <Copy className="h-4 w-4" />
                      {isCopied ? 'Kopyalandi!' : 'Kopyala'}
                    </button>
                    <button
                      onClick={() => handleDownload(prompt)}
                      className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                    >
                      <Download className="h-4 w-4" />
                      MD Indir
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filteredPrompts.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          Bu kategoride henüz şablon bulunmuyor.
        </div>
      )}
    </div>
  )
}
