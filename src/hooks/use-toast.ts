import { toast } from 'sonner'

interface ToastOptions {
  description?: string
  variant?: 'default' | 'destructive'
}

export function useToast() {
  return {
    toast: (options: ToastOptions) => {
      if (options.variant === 'destructive') {
        toast.error(options.description || 'Error')
      } else {
        toast.success(options.description || 'Success')
      }
    },
  }
}
