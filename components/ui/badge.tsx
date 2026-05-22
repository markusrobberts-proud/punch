import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium",
  {
    variants: {
      variant: {
        neutral: "bg-[#F5F5F7] text-[#1D1D1F]",
        success: "bg-[#E3F4E8] text-[#166D2F]",
        warning: "bg-[#FFF4E0] text-[#8B5A00]",
        info: "bg-[#E3F0FB] text-[#004E9B]",
        accent: "bg-[#FFE8DE] text-[#A83A0C]",
        destructive: "bg-[#FFE8E5] text-[#A8160C]",
        // semantic aliases used across the codebase
        default: "bg-[#F5F5F7] text-[#1D1D1F]",
        secondary: "bg-[#F5F5F7] text-[#1D1D1F]",
        outline: "border border-[#D2D2D7] text-[#1D1D1F]",
        plan: "bg-[#F5F5F7] text-[#6E6E73]",
        copy: "bg-[#FFE8DE] text-[#A83A0C]",
        brief: "bg-[#FFF4E0] text-[#8B5A00]",
        approved: "bg-[#E3F4E8] text-[#166D2F]",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
