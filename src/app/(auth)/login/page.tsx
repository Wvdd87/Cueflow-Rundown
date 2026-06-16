'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { login } from '@/app/actions/auth'

const FIELD =
  'w-full bg-[#16161c] border border-[#2e2e38] px-3 py-2.5 text-sm text-[#eef0f3] placeholder:text-[#5a5c66] outline-none focus:border-[#3a3a48]'
const FIELD_LABEL = 'block font-cond text-[10px] font-bold uppercase tracking-[0.12em] text-[#9ba0ab] mb-1.5'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined)

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 bg-[#f0a838] flex items-center justify-center">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#06060a" strokeWidth="2.5" strokeLinecap="square">
              <line x1="7" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="20" y2="12" /><line x1="7" y1="18" x2="20" y2="18" />
              <line x1="3" y1="6" x2="3" y2="6" strokeLinecap="round" strokeWidth="3.2" />
              <line x1="3" y1="12" x2="3" y2="12" strokeLinecap="round" strokeWidth="3.2" />
              <line x1="3" y1="18" x2="3" y2="18" strokeLinecap="round" strokeWidth="3.2" />
            </svg>
          </div>
          <span className="font-cond text-lg font-bold uppercase tracking-[0.08em] text-[#eef0f3]">Cueflow</span>
        </div>
        <h1 className="text-2xl font-semibold text-[#eef0f3]">Welcome back</h1>
        <p className="text-[#9ba0ab] text-sm mt-1">Sign in to your account</p>
      </div>

      <div className="border-t-2 border-t-[#f0a838] border border-[#1d1d24] bg-[#0c0c11] p-6">
        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className={FIELD_LABEL}>Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" className={FIELD} />
          </div>

          <div>
            <label htmlFor="password" className={FIELD_LABEL}>Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" className={FIELD} />
          </div>

          {state?.error && (
            <p className="text-sm text-[#ff5a73] bg-[rgba(255,40,72,0.1)] border border-[rgba(255,40,72,0.3)] px-3 py-2">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full inline-flex items-center justify-center h-10 font-cond text-[11px] font-bold uppercase tracking-[0.14em] bg-[#f0a838] text-[#06060a] hover:bg-[#ffba50] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>

      <p className="text-center text-[#888b96] text-sm mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-[#f0a838] hover:text-[#ffba50] transition-colors">
          Sign up free
        </Link>
      </p>
    </div>
  )
}
