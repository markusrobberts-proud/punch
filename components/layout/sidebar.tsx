"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Calendar,
  Home,
  BookOpen,
  Compass,
  Mail,
  Settings,
  Sparkles,
  BarChart3,
  ChevronDown,
  Check,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"

const BRAND_DEFAULT_ACCENT = "#1D1D1F"

type Brand = {
  id: string
  slug: string
  name: string
  primary_color: string | null
}

export function Sidebar({
  brands,
  activeBrandSlug,
  userInitials,
  userColor = "#D84A1F",
  claudeStatus,
}: {
  brands: Brand[]
  activeBrandSlug: string | null
  userInitials: string
  userColor?: string
  claudeStatus: { connected: boolean; docs: number; brandName: string | null }
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [switcherOpen, setSwitcherOpen] = useState(false)

  const activeBrand = brands.find((b) => b.slug === activeBrandSlug) ?? null

  const orgNav = [
    { href: "/", label: "Brands", icon: Home, exact: true },
    { href: "/strategy", label: "Proud Strategy", icon: Compass },
    { href: "/knowledge", label: "Knowledge Bank", icon: BookOpen },
    { href: "/calendar", label: "Calendar", icon: Calendar },
  ]

  const brandNav = activeBrand
    ? [
        { href: `/brands/${activeBrand.slug}`, label: "Dashboard", icon: Home },
        { href: `/brands/${activeBrand.slug}/calendar`, label: "Campaign Calendar", icon: Calendar },
        { href: `/brands/${activeBrand.slug}/knowledge`, label: "Knowledge Bank", icon: BookOpen },
        { href: `/brands/${activeBrand.slug}/klaviyo`, label: "Performance", icon: BarChart3, soon: true },
      ]
    : []

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <aside className="w-[236px] glass-sidebar border-r border-[#E5E5EA] flex flex-col shrink-0">
      <div className="px-4 pt-5 pb-4">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-6 h-6 rounded-md bg-[#1D1D1F] flex items-center justify-center group-hover:bg-black transition">
            <span className="text-white font-semibold text-[11px]">P</span>
          </div>
          <div className="text-[13px] font-semibold text-[#1D1D1F] tracking-display">Proud Email OS</div>
        </Link>
      </div>

      <div className="px-2 pb-1">
        <SectionLabel>Organisation</SectionLabel>
        <div className="space-y-0.5">
          {orgNav.map((item) => (
            <NavLink key={item.href} href={item.href} active={isActive(item.href, item.exact)} icon={item.icon} label={item.label} />
          ))}
        </div>
      </div>

      {brands.length > 0 && (
        <div className="px-2 pt-3 pb-1">
          <SectionLabel>Brand</SectionLabel>
          <button
            onClick={() => setSwitcherOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-white/60 transition"
          >
            <div className="flex items-center gap-2 min-w-0">
              <BrandChip color={activeBrand?.primary_color ?? BRAND_DEFAULT_ACCENT} name={activeBrand?.name ?? "All brands"} />
              <span className="text-[13px] font-medium truncate">{activeBrand?.name ?? "Choose a brand"}</span>
            </div>
            <ChevronDown className={cn("size-3.5 text-[#86868B] transition", switcherOpen && "rotate-180")} />
          </button>

          {switcherOpen && (
            <div className="mt-1 bg-white rounded-lg p-1 card-shadow fade-in">
              {brands.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    setSwitcherOpen(false)
                    router.push(`/brands/${b.slug}`)
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] hover:bg-[#F5F5F7]",
                    b.slug === activeBrand?.slug && "bg-[#F5F5F7]",
                  )}
                >
                  <BrandChip color={b.primary_color ?? BRAND_DEFAULT_ACCENT} name={b.name} />
                  <span className="truncate">{b.name}</span>
                  {b.slug === activeBrand?.slug && <Check className="size-3 ml-auto text-[#007AFF]" />}
                </button>
              ))}
              <Link
                href="/brands/new"
                onClick={() => setSwitcherOpen(false)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] text-[#6E6E73] hover:bg-[#F5F5F7]"
              >
                <div className="w-5 h-5 rounded-md border border-dashed border-[#D2D2D7] flex items-center justify-center">
                  <Plus className="size-2.5" />
                </div>
                <span>Add brand</span>
              </Link>
            </div>
          )}

          {activeBrand && (
            <div className="mt-1 space-y-0.5">
              {brandNav.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  active={isActive(item.href, item.href === `/brands/${activeBrand.slug}`)}
                  icon={item.icon}
                  label={item.label}
                  soon={item.soon}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1" />

      <div className="px-3 pb-3">
        <div className="bg-white rounded-lg p-3 card-shadow">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="size-3 text-[#007AFF]" />
            <span className="text-[11px] font-medium">
              {claudeStatus.connected ? "Claude is connected" : "Add an API key to enable Claude"}
            </span>
          </div>
          <p className="text-[11px] text-[#6E6E73] leading-relaxed">
            {claudeStatus.connected && claudeStatus.brandName
              ? `Reading Proud Strategy + ${claudeStatus.docs} docs from ${claudeStatus.brandName}.`
              : claudeStatus.connected
                ? `Reading Proud Strategy across all brands.`
                : `Set ANTHROPIC_API_KEY to wire up generations.`}
          </p>
        </div>
      </div>

      <div className="px-3 pb-4">
        <Link
          href="/settings"
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition",
            pathname.startsWith("/settings") ? "bg-white card-shadow" : "hover:bg-white/60",
          )}
        >
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0" style={{ background: userColor }}>
            {userInitials}
          </div>
          <span className="text-[#1D1D1F]">Settings</span>
          <Settings className="size-3.5 text-[#86868B] ml-auto" />
        </Link>
      </div>
    </aside>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider px-2 pb-1">
      {children}
    </div>
  )
}

function NavLink({
  href,
  active,
  icon: Icon,
  label,
  soon,
}: {
  href: string
  active: boolean
  icon: React.ComponentType<{ className?: string }>
  label: string
  soon?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition",
        active ? "bg-white text-[#1D1D1F] card-shadow" : "text-[#1D1D1F] hover:bg-white/60",
      )}
    >
      <Icon className="size-4 text-[#6E6E73]" />
      <span>{label}</span>
      {soon && <span className="ml-auto text-[9px] uppercase tracking-wider text-[#86868B]">Soon</span>}
    </Link>
  )
}

function BrandChip({ color, name }: { color: string; name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
  return (
    <div
      className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-semibold text-white shrink-0"
      style={{ background: color }}
    >
      {initials}
    </div>
  )
}
