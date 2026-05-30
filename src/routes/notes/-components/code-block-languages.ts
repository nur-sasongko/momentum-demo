export const CODE_BLOCK_LANGUAGES = [
  { label: 'Plain text', value: 'plaintext' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'Python', value: 'python' },
  { label: 'Bash', value: 'bash' },
  { label: 'CSS', value: 'css' },
  { label: 'HTML', value: 'html' },
  { label: 'JSON', value: 'json' },
] as const

export type CodeBlockLanguage = (typeof CODE_BLOCK_LANGUAGES)[number]['value']

export function getCodeBlockLanguageLabel(value: string | null | undefined) {
  return (
    CODE_BLOCK_LANGUAGES.find((lang) => lang.value === value)?.label ??
    'Plain text'
  )
}
