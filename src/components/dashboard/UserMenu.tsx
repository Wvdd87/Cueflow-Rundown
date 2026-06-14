'use client'

import { logout } from '@/app/actions/auth'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut } from 'lucide-react'

interface UserMenuProps {
  email: string
  fullName: string | null
}

export function UserMenu({ email, fullName }: UserMenuProps) {
  const initials = fullName
    ? fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : email[0].toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-zinc-600" />
        }
      >
        <Avatar className="w-8 h-8 cursor-pointer hover:ring-2 hover:ring-zinc-600 transition-all">
          <AvatarFallback className="bg-zinc-700 text-zinc-300 text-xs font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700 text-zinc-200 w-52">
        <div className="px-2 py-1.5">
          {fullName && <p className="text-sm font-medium text-white truncate">{fullName}</p>}
          <p className="text-xs text-zinc-500 truncate">{email}</p>
        </div>
        <DropdownMenuSeparator className="bg-zinc-800" />
        <DropdownMenuItem
          onClick={() => logout()}
          className="gap-2 focus:bg-zinc-800 focus:text-white cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
