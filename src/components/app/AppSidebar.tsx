'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileText, Trash2, LogOut } from 'lucide-react'
import { logout } from '@/app/actions/auth'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AppSidebarProps {
  email: string
  fullName: string | null
  teamName: string
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/rundowns', label: 'All Rundowns', icon: FileText },
  { href: '/trash', label: 'Trash', icon: Trash2 },
]

export function AppSidebar({ email, fullName, teamName }: AppSidebarProps) {
  const pathname = usePathname()

  const initials = fullName
    ? fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : email[0].toUpperCase()

  return (
    <aside className="w-56 flex flex-col bg-zinc-900 border-r border-zinc-800 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-zinc-800">
        <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center shrink-0">
          <span className="text-zinc-900 font-bold text-xs">R</span>
        </div>
        <span className="font-semibold text-white text-sm truncate">Rundown Studio</span>
      </div>

      {/* Team label */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider truncate">
          {teamName}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-zinc-800">
        <div className="flex items-center gap-2.5 mb-2 px-1">
          <Avatar className="w-7 h-7 shrink-0">
            <AvatarFallback className="bg-zinc-700 text-zinc-300 text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            {fullName && <p className="text-sm text-white truncate leading-tight">{fullName}</p>}
            <p className="text-xs text-zinc-500 truncate">{email}</p>
          </div>
        </div>
        <form action={logout}>
          <Button
            variant="ghost"
            size="sm"
            type="submit"
            className="w-full justify-start gap-2 text-zinc-400 hover:text-white hover:bg-zinc-800 h-8 px-3"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  )
}
