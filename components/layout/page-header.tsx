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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 mb-6 md:mb-8">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[11px] uppercase tracking-wider text-[#86868B] mb-1">{eyebrow}</div>
        )}
        <h1 className="text-[26px] sm:text-[30px] md:text-[34px] font-semibold tracking-display leading-tight">{title}</h1>
        {description && (
          <p className="text-[14px] md:text-[15px] text-[#6E6E73] mt-2 max-w-xl leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:shrink-0">{actions}</div>}
    </div>
  )
}

export function PageShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-6 md:py-10 ${className}`}>
      {children}
    </div>
  )
}
