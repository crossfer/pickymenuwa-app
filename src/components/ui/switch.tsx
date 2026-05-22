import * as React from 'react'
import { cn } from '@/lib/utils'

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, onCheckedChange, onChange, checked, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e)
      onCheckedChange?.(e.target.checked)
    }

    return (
      <label className="relative inline-flex cursor-pointer items-center">
        <input
          type="checkbox"
          ref={ref}
          className="sr-only peer"
          checked={checked}
          onChange={handleChange}
          {...props}
        />
        <div
          className={cn(
            'peer h-5 w-9 rounded-full bg-input transition-colors',
            'peer-checked:bg-primary',
            'peer-focus-visible:outline-none peer-focus-visible:ring-1 peer-focus-visible:ring-ring',
            'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
            'after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4',
            'after:rounded-full after:bg-white after:transition-transform',
            'peer-checked:after:translate-x-4',
            className
          )}
        />
      </label>
    )
  }
)
Switch.displayName = 'Switch'

export { Switch }
