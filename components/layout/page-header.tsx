export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6 mb-8">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[11px] uppercase tracking-wider text-[#86868B] mb-1">{eyebrow}</div>
        )}
        <h1 className="text-[34px] font-semibold tracking-display leading-tight">{title}</h1>
        {description && (
          <p className="text-[15px] text-[#6E6E73] mt-2 max-w-xl leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

export function PageShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`max-w-6xl mx-auto px-10 py-10 ${className}`}>
      {children}
    </div>
  )
}
