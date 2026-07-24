import { zodResolver } from '@hookform/resolvers/zod'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { FieldError } from '#/components/ui/field-error'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { signInWithPassword } from '#/libs/auth/auth-adapter'

const routeApi = getRouteApi('/login/')

const loginFormSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormValues = z.infer<typeof loginFormSchema>

export function LoginForm() {
  const navigate = useNavigate()
  const { redirect } = routeApi.useSearch()

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await signInWithPassword(values.email, values.password)
    if (error) {
      toast.error(error.message)
      return
    }
    await navigate({ to: redirect ?? '/habits' })
  })

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <img src="/icon.svg" alt="Momentum" className="size-12 rounded-xl" />
        <span className="text-lg font-semibold tracking-tight">Momentum</span>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Log in</CardTitle>
          <CardDescription>
            Enter your email and password to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="your@mail.com"
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <FieldError>{form.formState.errors.email.message}</FieldError>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="********"
                autoComplete="current-password"
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <FieldError>
                  {form.formState.errors.password.message}
                </FieldError>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Logging in…' : 'Log in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
