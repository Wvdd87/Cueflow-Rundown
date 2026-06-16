'use client'

import { logout } from '@/app/actions/auth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, User, ChevronDown } from 'lucide-react'

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
          <button className="inline-flex items-center gap-2 h-9 px-2 bg-transparent border border-[#22222a] hover:border-[#3a3a48] hover:bg-[#111116] transition-colors cursor-pointer" />
        }
      >
        <span className="w-6 h-6 bg-[#22222a] flex items-center justify-center font-cond text-[10px] font-bold text-[#c8c9d0]">
          {initials}
        </span>
        <ChevronDown className="w-3 h-3 text-[#9ba0ab]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-[#111116] border-[#2e2e38] text-[#c8c9d0] w-[230px] p-0">
        <div className="px-4 py-3.5 border-b border-[#1d1d24]">
          {fullName && <p className="text-[13px] font-semibold text-[#eef0f3] truncate">{fullName}</p>}
          <p className="text-[11px] text-[#9ba0ab] truncate mt-0.5">{email}</p>
        </div>
        <DropdownMenuItem className="gap-2.5 px-4 py-2.5 font-cond text-[11px] font-bold uppercase tracking-[0.1em] text-[#c8c9d0] focus:bg-[#16161c] focus:text-[#eef0f3] cursor-pointer">
          <User className="w-3.5 h-3.5 text-[#9ba0ab]" /> Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[#1d1d24]" />
        <DropdownMenuItem
          onClick={() => logout()}
          className="gap-2.5 px-4 py-2.5 font-cond text-[11px] font-bold uppercase tracking-[0.1em] text-[#ff5a73] focus:bg-[#16161c] focus:text-[#ff5a73] cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
