import { LoginForm } from "./login-form"

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#1D1D1F] mb-4">
            <span className="text-white font-semibold text-[15px]">P</span>
          </div>
          <div className="text-[11px] font-semibold tracking-widest uppercase text-[#86868B]">
            Proud Creative
          </div>
          <h1 className="text-[28px] font-semibold tracking-display mt-1">Email OS</h1>
          <p className="text-[13px] text-[#6E6E73] mt-3 max-w-sm mx-auto leading-relaxed">
            Sign in with your team email. We'll send you a magic link.
          </p>
        </div>
        <div className="glass-strong rounded-2xl p-7">
          <LoginForm />
        </div>
        <p className="text-center text-[11px] text-[#86868B] mt-6">
          Internal tool. New here? Ask an admin to invite you.
        </p>
      </div>
    </main>
  )
}
