"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Menu } from "lucide-react"
import { Sidebar } from "./sidebar"
import type { Notification } from "@/lib/notifications"
import type { Role } from "@/lib/roles"

type Brand = {
  id: string
  slug: string
  name: string
  primary_color: string | null
  website_url: string | null
}

/**
 * Owns the chrome around the dashboard so the mobile top bar and the
 * sidebar drawer can share open/close state without prop-drilling.
 *
 * Desktop (md+): the sidebar sits inline in a flex row next to the page
 * content, exactly like before. The mobile top bar is hidden.
 *
 * Mobile (<md): the sidebar is fixed and translated off-canvas; tapping
 * the hamburger in the top bar slides it in over a backdrop. Route
 * changes auto-close the drawer so navigating doesn't strand it open.
 */
export function MobileNavShell({
  role,
  brands,
  activeBrandSlug,
  userInitials,
  userColor,
  claudeStatus,
  initialNotifications,
  initialUnread,
  children,
}: {
  role: Role
  brands: Brand[]
  activeBrandSlug: string | null
  userInitials: string
  userColor?: string
  claudeStatus: { connected: boolean; docs: number; brandName: string | null }
  initialNotifications: Notification[]
  initialUnread: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close on route change so the drawer doesn't get stuck open after the
  // user taps a nav item.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Escape to close + lock body scroll while open so the backdrop tap
  // target isn't fighting with page scroll.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Mobile top bar. Hidden on md+ since the sidebar handles its own
          branding + bell up there. */}
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-2 px-4 h-12 bg-white/85 backdrop-blur border-b border-[#E5E5EA]">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setOpen(true)}
          className="w-9 h-9 -ml-2 flex items-center justify-center rounded-md text-[#1D1D1F] hover:bg-[#F5F5F7]"
        >
          <Menu className="size-5" />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#1D1D1F] flex items-center justify-center">
            <span className="text-white font-semibold text-[11px]">P</span>
          </div>
          <div className="text-[13px] font-semibold text-[#1D1D1F] tracking-display">PUNCH</div>
        </Link>
        {/* Spacer to balance the hamburger so the wordmark stays centred. */}
        <div className="w-9 h-9" aria-hidden />
      </div>

      <div className="flex flex-1 min-h-0 relative">
        {/* Backdrop. Only meaningful on mobile when the drawer is open. */}
        {open && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="md:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm fade-in"
          />
        )}

        {/* The sidebar itself. On desktop it sits static in the flex row.
            On mobile it's fixed/translated off-screen and slides in when
            `open` flips. We rely on the same Sidebar component for both
            so we don't fork the nav structure. */}
        <div
          className={`fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:static md:translate-x-0 ${
            open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <Sidebar
            role={role}
            brands={brands}
            activeBrandSlug={activeBrandSlug}
            userInitials={userInitials}
            userColor={userColor}
            claudeStatus={claudeStatus}
            initialNotifications={initialNotifications}
            initialUnread={initialUnread}
            onCloseDrawer={() => setOpen(false)}
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </div>
  )
}
