import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/axios'
import { toast } from 'sonner'
import { useTheme, themes } from '@/lib/theme'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  User,
  Lock,
  Save,
  Loader2,
  Shield,
  Palette,
  Check,
  Brain,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function ThemeCard({
  theme,
  isSelected,
  onSelect,
}: {
  theme: (typeof themes)[number]
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex flex-col rounded-xl border-2 p-3 text-left transition-all duration-200 cursor-pointer group',
        isSelected
          ? 'border-primary ring-2 ring-primary/20 shadow-sm'
          : 'border-border hover:border-muted-foreground/30 hover:shadow-sm'
      )}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check size={12} />
        </div>
      )}

      {/* Preview miniature */}
      <div
        className="mb-2.5 flex h-[72px] w-full overflow-hidden rounded-lg border"
        style={{ borderColor: theme.preview.bg === '#FFFFFF' ? '#e2e8f0' : theme.preview.bg }}
      >
        {/* Mini sidebar */}
        <div
          className="w-[28%] flex flex-col items-center gap-1 py-2"
          style={{ backgroundColor: theme.preview.sidebar }}
        >
          <div className="h-1.5 w-5 rounded-full" style={{ backgroundColor: theme.preview.accent, opacity: 0.8 }} />
          <div className="h-1 w-4 rounded-full" style={{ backgroundColor: theme.preview.text, opacity: 0.2 }} />
          <div className="h-1 w-4 rounded-full" style={{ backgroundColor: theme.preview.text, opacity: 0.2 }} />
          <div className="h-1 w-4 rounded-full" style={{ backgroundColor: theme.preview.text, opacity: 0.2 }} />
        </div>
        {/* Mini content */}
        <div className="flex-1 p-1.5" style={{ backgroundColor: theme.preview.bg }}>
          <div className="mb-1.5 h-1.5 w-8 rounded-full" style={{ backgroundColor: theme.preview.text, opacity: 0.6 }} />
          <div className="flex gap-1">
            <div
              className="h-6 flex-1 rounded"
              style={{ backgroundColor: theme.preview.card, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}
            />
            <div
              className="h-6 flex-1 rounded"
              style={{ backgroundColor: theme.preview.card, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}
            />
          </div>
          <div
            className="mt-1 h-6 w-full rounded"
            style={{ backgroundColor: theme.preview.card, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}
          />
        </div>
      </div>

      {/* Label */}
      <p className="text-sm font-medium">{theme.label}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{theme.description}</p>

      {/* Accent dot */}
      <div className="mt-2 flex items-center gap-1.5">
        <div className="h-3 w-3 rounded-full border" style={{ backgroundColor: theme.preview.accent }} />
        <div className="h-3 w-3 rounded-full border" style={{ backgroundColor: theme.preview.sidebar }} />
        <div className="h-3 w-3 rounded-full border" style={{ backgroundColor: theme.preview.bg }} />
      </div>
    </button>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { theme: currentTheme, setTheme } = useTheme()

  // Profil formu
  const [fullName, setFullName] = useState(user?.fullName || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [savingProfile, setSavingProfile] = useState(false)

  // AI API Keys
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('anthropic_api_key') || '')
  const [showApiKey, setShowApiKey] = useState(false)
  const hasApiKey = !!localStorage.getItem('anthropic_api_key')

  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('gemini_api_key') || '')
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const hasGeminiKey = !!localStorage.getItem('gemini_api_key')

  // Şifre değiştirme
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  async function handleProfileSave() {
    setSavingProfile(true)
    try {
      await api.put('/auth/me', { fullName, phone })
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      toast.success('Profil güncellendi.')
    } catch {
      toast.error('Profil güncellenemedi.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handlePasswordChange() {
    if (newPassword !== confirmPassword) {
      toast.error('Yeni şifreler eşleşmiyor.')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Yeni şifre en az 6 karakter olmalıdır.')
      return
    }

    setSavingPassword(true)
    try {
      await api.put('/auth/password', { currentPassword, newPassword })
      toast.success('Şifre değiştirildi.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      if (err.response?.status === 401) {
        toast.error('Mevcut şifre hatalı.')
      } else {
        toast.error('Şifre değiştirilemedi.')
      }
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="page-title">Ayarlar</h1>
        <p className="mt-1 text-sm text-muted-foreground">Hesap, profil ve görünüm ayarlarınız</p>
      </div>

      {/* Tema Seçici */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" style={{ color: 'hsl(var(--gold))' }} />
            Görünüm
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Arayüz temasını seçin. Tercih anında uygulanır.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {themes.map((t) => (
              <ThemeCard
                key={t.id}
                theme={t}
                isSelected={currentTheme === t.id}
                onSelect={() => setTheme(t.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Araştırma Ayarları */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-law-accent" />
            Yapay Zeka API Anahtarları
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Araştırma, kritik nokta tespiti, dilekçe yazımı ve diğer AI özellikleri için
            API anahtarlarınızı girin. Anahtarlar yalnızca bu tarayıcıda saklanır.
          </p>

          {/* ── Anthropic (Claude) ── */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold">Anthropic (Claude)</h4>
                <p className="text-xs text-muted-foreground">
                  Araştırma, kritik nokta, usul raporu, dilekçe, savunma simülasyonu
                </p>
              </div>
              {hasApiKey && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <Check className="h-3 w-3" /> Aktif
                </span>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">API Anahtarı</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 pr-10 text-sm font-mono outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
                  placeholder="sk-ant-api03-..."
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasApiKey && (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('anthropic_api_key')
                    setApiKey('')
                    toast.success('Anthropic anahtarı silindi.')
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  Sil
                </button>
              )}
              <button
                onClick={() => {
                  if (!apiKey.trim()) { toast.error('Anahtar boş olamaz.'); return }
                  localStorage.setItem('anthropic_api_key', apiKey.trim())
                  toast.success('Anthropic anahtarı kaydedildi.')
                }}
                disabled={!apiKey.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50 cursor-pointer ml-auto"
              >
                <Save className="h-3 w-3" />
                Kaydet
              </button>
            </div>
          </div>

          {/* ── Google Gemini ── */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold">Google Gemini</h4>
                <p className="text-xs text-muted-foreground">
                  Gelecek entegrasyonlar (alternatif araştırma motoru)
                </p>
              </div>
              {hasGeminiKey && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <Check className="h-3 w-3" /> Aktif
                </span>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">API Anahtarı</label>
              <div className="relative">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 pr-10 text-sm font-mono outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
                  placeholder="AIzaSy..."
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasGeminiKey && (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('gemini_api_key')
                    setGeminiKey('')
                    toast.success('Gemini anahtarı silindi.')
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  Sil
                </button>
              )}
              <button
                onClick={() => {
                  if (!geminiKey.trim()) { toast.error('Anahtar boş olamaz.'); return }
                  localStorage.setItem('gemini_api_key', geminiKey.trim())
                  toast.success('Gemini anahtarı kaydedildi.')
                }}
                disabled={!geminiKey.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50 cursor-pointer ml-auto"
              >
                <Save className="h-3 w-3" />
                Kaydet
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <strong>Nasıl çalışır:</strong> API anahtarlarınız yalnızca bu tarayıcıda (localStorage) saklanır.
            Her istek sırasında anahtarınız sunucuya gönderilir ve işlem sonrası bellekten silinir.
            Sunucudaki .env dosyasında da varsayılan anahtar tanımlıysa, kişisel anahtarınız öncelikli kullanılır.
          </div>
        </CardContent>
      </Card>

      {/* Profil Bilgileri */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-law-accent" />
            Profil Bilgileri
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">E-posta</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full rounded-lg border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground"
            />
            <p className="mt-1 text-xs text-muted-foreground">E-posta adresi değiştirilemez.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Ad Soyad</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Telefon</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
              placeholder="0532 123 4567"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleProfileSave}
              disabled={savingProfile}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Kaydet
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Şifre Değiştir */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4 text-law-accent" />
            Şifre Değiştir
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Mevcut Şifre</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Yeni Şifre</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Yeni Şifre (Tekrar)</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handlePasswordChange}
              disabled={savingPassword || !currentPassword || !newPassword}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              Şifreyi Değiştir
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Hesap Bilgisi */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Rol</span>
            <span className="font-medium capitalize">
              {user?.role === 'admin' ? 'Yönetici' : user?.role === 'lawyer' ? 'Avukat' : 'Asistan'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
