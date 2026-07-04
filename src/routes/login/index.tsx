import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { LoginForm } from './-components/login-form'

const loginSearchSchema = z.object({
  redirect: z
    .string()
    .regex(/^\/(?!\/)/, 'Must be a relative path')
    .optional(),
})

export const Route = createFileRoute('/login/')({
  validateSearch: loginSearchSchema,
  beforeLoad: ({ context, search }) => {
    if (context.user) {
      throw redirect({ to: search.redirect ?? '/habits' })
    }
  },
  head: () => ({
    meta: [{ title: 'Log in — Momentum' }],
  }),
  component: LoginPage,
})

function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <LoginForm />
    </main>
  )
}
