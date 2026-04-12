import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Gavel, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'

const loginSchema = z.object({
  email: z.string().email('Geçerli bir e-posta girin'),
  password: z.string().min(1, 'Şifre gereklidir'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const loginMutation = useMutation({
    mutationFn: (data: LoginForm) => api.post('/auth/login', data),
    onSuccess: (res) => {
      queryClient.setQueryData(['auth', 'me'], res.data.user)
      navigate('/dashboard', { replace: true })
    },
    onError: (err: { response?: { data?: { error?: string }; status?: number } }) => {
      if (err.response?.status === 401) {
        toast.error('E-posta veya şifre hatalı.')
      } else {
        toast.error('Giriş yapılamadı. Lütfen tekrar deneyin.')
      }
    },
  })

  return (
    <div className="min-h-screen flex">
      {/* Left — decorative panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-law-primary relative overflow-hidden items-center justify-center">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        {/* Gradient accent */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-law-gold/50 to-transparent" />

        <div className="relative z-10 px-12 max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-law-gold/10 border border-law-gold/20 mb-8">
            <Gavel className="w-8 h-8 text-law-gold-light" />
          </div>
          <h1 className="text-4xl font-serif font-semibold text-white tracking-tight leading-tight mb-4">
            HukukTakip
          </h1>
          <div className="w-12 h-0.5 bg-law-gold/40 mx-auto mb-4" />
          <p className="text-slate-400 text-[15px] leading-relaxed">
            Avukatlık büronuzu tek platformdan yönetin.
            Davalar, duruşmalar, görevler ve müvekkiller — hepsi bir arada.
          </p>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-[380px] animate-fade-in">
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-law-primary mb-3">
              <Gavel className="text-law-gold-light" size={22} />
            </div>
            <h1 className="text-2xl font-serif font-semibold text-law-primary">HukukTakip</h1>
          </div>

          {/* Form card */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-7">
            <div className="mb-6">
              <h2 className="text-xl font-serif font-semibold text-law-primary">Giriş Yap</h2>
              <p className="text-sm text-muted-foreground mt-1">Hesabınıza erişmek için bilgilerinizi girin</p>
            </div>

            <form onSubmit={handleSubmit((data) => loginMutation.mutate(data))} className="space-y-5">
              <div>
                <label className="block text-[13px] font-medium text-foreground mb-1.5">
                  E-posta
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="avukat@buro.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-law-accent/30 focus:border-law-accent bg-background transition-all duration-200 placeholder:text-muted-foreground"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-destructive mt-1.5">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-[13px] font-medium text-foreground mb-1.5">
                  Şifre
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 pr-10 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-law-accent/30 focus:border-law-accent bg-background transition-all duration-200 placeholder:text-muted-foreground"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive mt-1.5">{errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-law-primary hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group"
              >
                {loginMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    Giriş Yap
                    <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-5">
            Sorun mu yaşıyorsunuz? Yöneticinizle iletişime geçin.
          </p>
        </div>
      </div>
    </div>
  )
}
