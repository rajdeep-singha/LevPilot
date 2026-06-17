import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  width?: string
}

export function Modal({ open, onClose, title, children, width = 'max-w-md' }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${width} bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl`}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
