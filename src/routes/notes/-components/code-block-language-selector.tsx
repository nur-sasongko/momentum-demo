import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { cn } from '#/libs/utils'
import type { CodeBlockLanguage } from '#/routes/notes/-components/code-block-languages'
import { CODE_BLOCK_LANGUAGES } from '#/routes/notes/-components/code-block-languages'

interface CodeBlockLanguageSelectorProps {
  value: string
  onChange: (language: CodeBlockLanguage) => void
  disabled?: boolean
  className?: string
}

export function CodeBlockLanguageSelector({
  value,
  onChange,
  disabled = false,
  className,
}: CodeBlockLanguageSelectorProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as CodeBlockLanguage)}
      disabled={disabled}
    >
      <SelectTrigger
        size="sm"
        className={cn('h-7 w-[9.5rem] text-xs', className)}
        aria-label="Code block language"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CODE_BLOCK_LANGUAGES.map(({ label, value: lang }) => (
          <SelectItem key={lang} value={lang}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
