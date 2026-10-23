import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-primary to-primary/95 text-primary-foreground border-t border-white/20 shadow-[0_2px_0_0_rgba(0,0,0,0.14),0_4px_10px_rgba(16,185,129,0.25)] hover:shadow-[0_3px_0_0_rgba(0,0,0,0.18),0_6px_14px_rgba(16,185,129,0.35)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.12),0_2px_4px_rgba(16,185,129,0.15)]",
        destructive:
          "bg-gradient-to-b from-destructive to-destructive/95 text-white border-t border-white/20 shadow-[0_2px_0_0_rgba(0,0,0,0.18),0_4px_12px_rgba(239,68,68,0.32)] hover:shadow-[0_3px_0_0_rgba(0,0,0,0.22),0_6px_16px_rgba(239,68,68,0.42)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.15),0_2px_4px_rgba(239,68,68,0.2)] focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border border-border/80 bg-gradient-to-b from-card to-card/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-primary/50 hover:bg-accent/60 hover:text-accent-foreground hover:-translate-y-0.5 hover:shadow-[0_3px_8px_rgba(0,0,0,0.06)] active:translate-y-0.5 active:shadow-xs",
        secondary:
          "bg-secondary text-secondary-foreground border border-border/50 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-secondary/80 hover:-translate-y-0.5 hover:shadow-[0_3px_6px_rgba(0,0,0,0.06)] active:translate-y-0.5 active:shadow-xs",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 hover:-translate-y-0.5 active:translate-y-0",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3 rounded-xl",
        sm: "h-8 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5 text-xs",
        lg: "h-10 rounded-xl px-6 has-[>svg]:px-4 font-semibold",
        icon: "size-9 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
