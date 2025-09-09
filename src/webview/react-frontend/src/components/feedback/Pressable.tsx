import React from 'react'
import { cn } from '../../lib/utils'

export const Pressable: React.FC<React.PropsWithChildren<{
  className?: string
  disabled?: boolean
  as?: 'button' | 'div'
  onClick?: (e: React.MouseEvent) => void
  title?: string
}>> = ({ className, children, disabled, as = 'button', onClick, title }) => {
  const [pressed, setPressed] = React.useState(false)
  const Comp: any = as
  return (
    <Comp
      className={cn(
        'transition-transform duration-100',
        pressed ? 'scale-[0.99]' : '',
        disabled ? 'opacity-60 pointer-events-none' : '',
        className,
      )}
      onPointerDown={() => !disabled && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={disabled ? undefined : onClick}
      title={title}
    >
      {children}
    </Comp>
  )
}

export default Pressable

