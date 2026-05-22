import { Sidebar } from "./sidebar"
import { SignOutButton } from "./sign-out-button"
import type { AppUser } from "@/lib/auth"

export function DashboardLayout({ user, children }: { user: AppUser; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-gradient-to-b from-white via-neutral-50 to-neutral-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border/60 bg-white/60 backdrop-blur-md flex items-center justify-end px-8 gap-4">
          <div className="text-right">
            <div className="text-sm font-medium">{user.displayName ?? user.email}</div>
            <div className="text-xs text-muted-foreground capitalize">{user.role}</div>
          </div>
          <SignOutButton />
        </header>
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
