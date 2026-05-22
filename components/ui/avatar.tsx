import { cn } from "@/lib/utils"

const sizes = {
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-xs",
  lg: "w-10 h-10 text-sm",
} as const

export function Avatar({
  initials,
  color = "#1D1D1F",
  size = "sm",
  className,
}: {
  initials: string
  color?: string
  size?: keyof typeof sizes
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-white shrink-0",
        sizes[size],
        className,
      )}
      style={{ background: color }}
    >
      {initials.slice(0, 2).toUpperCase()}
    </div>
  )
}

export function initialsFromName(s: string | null | undefined): string {
  if (!s) return "?"
  const parts = s.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
