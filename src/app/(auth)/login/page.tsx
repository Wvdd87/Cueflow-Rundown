'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { login } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined)

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
            <span className="text-zinc-900 font-bold text-sm">R</span>
          </div>
          <span className="text-white font-semibold text-lg">Rundown Studio</span>
        </div>
        <h1 className="text-2xl font-semibold text-white">Welcome back</h1>
        <p className="text-zinc-400 text-sm mt-1">Sign in to your account</p>
      </div>

      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-zinc-300 text-sm">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-zinc-600"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-zinc-300 text-sm">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-zinc-600"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-red-400 bg-red-950/50 border border-red-900/50 rounded-md px-3 py-2">
            {state.error}
          </p>
        )}

        <Button
          type="submit"
          disabled={pending}
          className="w-full bg-white text-zinc-900 hover:bg-zinc-100 font-medium"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="text-center text-zinc-500 text-sm mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-zinc-300 hover:text-white transition-colors">
          Sign up free
        </Link>
      </p>
    </div>
  )
}
