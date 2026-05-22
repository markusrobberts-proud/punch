import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
  {
    variants: {
      variant: {
        // Manus variants
        primary: "bg-[#1D1D1F] text-white hover:bg-black btn-primary-shadow disabled:bg-[#C7C7CC] disabled:text-white",
        accent: "bg-[#007AFF] text-white hover:bg-[#0062CC] btn-primary-shadow",
        secondary: "bg-white text-[#1D1D1F] border border-[#D2D2D7] hover:bg-[#F5F5F7]",
        outline: "bg-white text-[#1D1D1F] border border-[#D2D2D7] hover:bg-[#F5F5F7]",
        ghost: "text-[#1D1D1F] hover:bg-[#F5F5F7]",
        danger: "bg-white text-[#FF3B30] border border-[#FFD5D1] hover:bg-[#FFF5F4]",
        // shadcn aliases so older call sites keep working
        default: "bg-[#1D1D1F] text-white hover:bg-black btn-primary-shadow disabled:bg-[#C7C7CC] disabled:text-white",
        destructive: "bg-white text-[#FF3B30] border border-[#FFD5D1] hover:bg-[#FFF5F4]",
        link: "text-[#007AFF] hover:underline underline-offset-4 p-0",
      },
      size: {
        sm: "px-3 py-1.5 text-[13px] [&_svg]:size-3.5",
        md: "px-3.5 py-2 text-[13px] [&_svg]:size-3.5",
        lg: "px-5 py-2.5 text-sm [&_svg]:size-4",
        default: "px-3.5 py-2 text-[13px] [&_svg]:size-3.5",
        icon: "h-8 w-8 [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
