import * as React from 'react'
import { cn } from '../../lib/utils'

type Variant = 'default' | 'secondary' | 'destructive' | 'ghost'
type Size = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    const variants: Record<Variant, string> = {
      default: 'bg-primary text-primary-foreground hover:bg-primary/90',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      ghost: 'bg-transparent hover:bg-muted text-foreground',
    }
    const sizes: Record<Size, string> = {
      sm: 'h-8 px-2 text-xs neo:min-h-[44px]',
      md: 'h-9 px-3 text-sm neo:min-h-[44px]',
      lg: 'h-10 px-4 text-sm neo:min-h-[44px]',
      icon: 'h-9 w-9 p-0 neo:min-h-[44px]',
    }
    return (
      <button
        ref={ref}
        className={cn(
          // Base
          'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-not-allowed',
          // Neobrutalist overrides (toggle via .neo on html)
          'neo:rounded-none neo:border-4 neo:border-border neo:font-bold',
          'neo:shadow-[8px_8px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[8px_8px_0_0_rgba(255,255,255,0.9)]',
          'neo:transition-[background,box-shadow,transform] neo:duration-100 neo:ease-linear neo:active:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:active:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]',
          'neo:focus-visible:ring-0 neo:focus-visible:outline-4 neo:focus-visible:outline-black dark:neo:focus-visible:outline-white',
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

