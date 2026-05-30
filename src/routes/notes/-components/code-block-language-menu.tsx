import type { Editor } from '@tiptap/core'

import { cn } from '#/libs/utils'
import { FloatingMenu } from '@tiptap/react/menus'

const CODE_LANGUAGES = [
  { label: 'Plain text', value: 'plaintext' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'Python', value: 'python' },
  { label: 'Bash', value: 'bash' },
  { label: 'CSS', value: 'css' },
  { label: 'HTML', value: 'html' },
  { label: 'JSON', value: 'json' },
]

interface CodeBlockLanguageMenuProps {
  editor: Editor
}

export function CodeBlockLanguageMenu({ editor }: CodeBlockLanguageMenuProps) {
  const currentLanguage =
    (editor.getAttributes('codeBlock').language as string | undefined) ??
    'plaintext'

  return (
    <FloatingMenu
      editor={editor}
      shouldShow={({ editor: currentEditor }) =>
        currentEditor.isActive('codeBlock')
      }
      className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-popover p-1 shadow-lg"
    >
      {CODE_LANGUAGES.map(({ label, value }) => (
        <button
          key={value}
          type="button"
          className={cn(
            'rounded-md px-2 py-1 text-xs font-medium transition-colors',
            currentLanguage === value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          )}
          onMouseDown={(event) => {
            event.preventDefault()
            editor
              .chain()
              .focus()
              .updateAttributes('codeBlock', { language: value })
              .run()
          }}
        >
          {label}
        </button>
      ))}
    </FloatingMenu>
  )
}
