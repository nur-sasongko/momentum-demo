import type { NodeViewProps } from '@tiptap/core'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'

import { CodeBlockCopyButton } from '#/routes/notes/-components/code-block-copy-button'
import { CodeBlockLanguageSelector } from '#/routes/notes/-components/code-block-language-selector'
import type { CodeBlockLanguage } from '#/routes/notes/-components/code-block-languages'
import { cn } from '#/libs/utils'

export function CodeBlockView({
  node,
  updateAttributes,
  editor,
  extension,
}: NodeViewProps) {
  const language = (node.attrs.language as string | null) ?? 'plaintext'
  const languageClassPrefix =
    extension.options.languageClassPrefix ?? 'language-'
  const codeClassName =
    language && language !== 'plaintext'
      ? `${languageClassPrefix}${language}`
      : undefined
  const codeText = node.textContent

  return (
    <NodeViewWrapper className="note-code-block" data-language={language}>
      <div className="note-code-block__header">
        <CodeBlockLanguageSelector
          value={language}
          disabled={!editor.isEditable}
          onChange={(nextLanguage: CodeBlockLanguage) => {
            updateAttributes({
              language: nextLanguage === 'plaintext' ? null : nextLanguage,
            })
          }}
        />
        <CodeBlockCopyButton code={codeText} />
      </div>
      <pre className="note-code-block__pre">
        <NodeViewContent
          as="code"
          className={cn(codeClassName)}
          style={{ whiteSpace: 'pre' }}
        />
      </pre>
    </NodeViewWrapper>
  )
}
