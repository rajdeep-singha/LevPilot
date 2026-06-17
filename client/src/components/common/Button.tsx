import type { ButtonHTMLAttributes } from 'react'
import { Spinner } from './Spinner'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const variants = {
  primary: 'bg-emerald-500 hover:bg-emerald-400 text-black font-semibold',
  danger: 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30',
  ghost: 'hover:bg-gray-800 text-gray-300',
  outline: 'border border-gray-700 hover:border-gray-500 text-gray-300',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg transition-all
        ${variants[variant]} ${sizes[size]}
        disabled:opacity-40 disabled:cursor-not-allowed
        ${className}
      `}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  )
}
