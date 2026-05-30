import { Copy } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import { cn } from '#/libs/utils'

interface CodeBlockCopyButtonProps {
  code: string
  className?: string
}

export async function copyCodeToClipboard(code: string) {
  await navigator.clipboard.writeText(code)
}

export function CodeBlockCopyButton({
  code,
  className,
}: CodeBlockCopyButtonProps) {
  const handleCopy = async () => {
    try {
      await copyCodeToClipboard(code)
      toast.success('Code copied to clipboard')
    } catch {
      toast.error('Failed to copy code')
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn('h-7 shrink-0 gap-1.5 px-2 text-xs', className)}
      aria-label="Copy code"
      onClick={() => {
        void handleCopy()
      }}
    >
      <Copy className="size-3.5" />
      Copy
    </Button>
  )
}
