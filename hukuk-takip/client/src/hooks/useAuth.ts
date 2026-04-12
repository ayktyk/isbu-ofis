import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/axios'
import { toast } from 'sonner'
import type { LoginInput } from '@hukuk-takip/shared'
import { clearAuthTokens, setAuthTokens } from '@/lib/authTokens'

export function useAuth() {
  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await api.get('/auth/me')
      return res.data
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  })

  return { user, isLoading, isAuthenticated: !!user && !isError }
}

export function useLogin() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (data: LoginInput) => api.post('/auth/login', data),
    onSuccess: (res) => {
      setAuthTokens({
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
      })
      queryClient.setQueryData(['auth', 'me'], res.data.user)
      navigate('/dashboard', { replace: true })
    },
    onError: (err: any) => {
      if (err.response?.status === 401) {
        toast.error('E-posta veya şifre hatalı.')
      } else if (err.response?.status === 403) {
        toast.error('Hesabınız devre dışı bırakılmış.')
      } else {
        toast.error('Giriş yapılamadı. Lütfen tekrar deneyin.')
      }
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      clearAuthTokens()
      queryClient.clear()
      navigate('/login', { replace: true })
    },
  })
}
