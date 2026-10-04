/// <reference types="bun-types" />

/**
 * Builds `docs/specs/_index.md` (and the part table of every consolidated
 * spec file) from the specs' own frontmatter, so no one edits the index by
 * hand and concurrent spec PRs never conflict on it.
 *
 *   bun scripts/generate-spec-index.ts          # rewrite generated content
 *   bun scripts/generate-spec-index.ts --check  # exit 1 if anything is stale
 *
 * See docs/architecture/spec-workflow.md.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { format, resolveConfig } from 'prettier'

const specsDir = resolve(import.meta.dirname, '../docs/specs')
const indexPath = resolve(specsDir, '_index.md')
const checkOnly = process.argv.includes('--check')

const ID_PATTERN = /^\d{12}$/
const PARTS_START = '<!-- spec-parts:start -->'
const PARTS_END = '<!-- spec-parts:end -->'
const STATUS_ORDER = ['draft', 'in-progress', 'done', 'cancelled']

interface SpecEntry {
  id: string
  title: string
  feature: string
  status: string
  created: string
  updated: string
  legacyId: string
  href: string
}

const errors: string[] = []
const pending = new Map<string, string>()

function parseFrontmatter(text: string) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text)
  if (!match) return null
  const fields: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const field = /^([\w-]+):\s*(.*?)\s*(#.*)?$/.exec(line)
    if (field) fields[field[1]] = field[2].replace(/^'(.*)'$/, '$1')
  }
  return { fields, raw: match[1], end: match[0].length }
}

function aggregateStatus(statuses: string[]) {
  const live = statuses.filter((s) => s !== 'cancelled')
  if (live.length === 0) return 'cancelled'
  return live.reduce((a, b) =>
    STATUS_ORDER.indexOf(a) <= STATUS_ORDER.indexOf(b) ? a : b,
  )
}

function partsTable(parts: SpecEntry[]) {
  return [
    '| ID | Part | Status | Created | Updated | Legacy |',
    '| --- | --- | --- | --- | --- | --- |',
    ...parts.map(
      (p) =>
        `| ${p.id} | [${p.title}](#spec-${p.id}) | ${p.status} | ${p.created} | ${p.updated} | ${p.legacyId || '—'} |`,
    ),
  ].join('\n')
}

function readSpec(file: string): SpecEntry[] {
  const path = resolve(specsDir, file)
  const text = readFileSync(path, 'utf8')
  const fm = parseFrontmatter(text)
  if (!fm) {
    errors.push(`${file}: missing frontmatter`)
    return []
  }
  const { fields } = fm
  if (!file.startsWith(`${fields.id}-`)) {
    errors.push(`${file}: filename must start with its id (${fields.id})`)
  }

  if (!fields.consolidates) {
    return [
      {
        id: fields.id,
        title: fields.title,
        feature: fields.feature,
        status: fields.status,
        created: fields.created,
        updated: fields.updated,
        legacyId: fields['legacy-id'] ?? '',
        href: `./${file}`,
      },
    ]
  }

  // Consolidated file: each part is `<a id="spec-ID"></a>`, `## ID — Title`,
  // then a `**Status:** … · **Created:** … · **Updated:** …` line.
  const parts: SpecEntry[] = []
  const partPattern =
    /<a id="spec-(\d+)"><\/a>\s*\n## (\d+) — (.+)\n\s*\n(\*\*Status:\*\*.*)/g
  for (const m of text.matchAll(partPattern)) {
    const meta = (label: string) =>
      new RegExp(`\\*\\*${label}:\\*\\* ([^·\\n]+)`).exec(m[4])?.[1].trim() ??
      ''
    if (m[1] !== m[2]) errors.push(`${file}: anchor ${m[1]} ≠ heading ${m[2]}`)
    parts.push({
      id: m[2],
      title: m[3].trim(),
      feature: fields.feature,
      status: meta('Status'),
      created: meta('Created'),
      updated: meta('Updated'),
      legacyId: meta('Legacy ID').replace(/^0+/, ''),
      href: `./${file}#spec-${m[2]}`,
    })
  }
  if (parts.length === 0) errors.push(`${file}: no parts found`)
  if (fields.id !== parts[0]?.id) {
    errors.push(`${file}: frontmatter id must equal its first part's id`)
  }

  // Keep the file's own derived fields and part table in sync with its parts.
  const raw = fm.raw
    .replace(
      /^consolidates:.*$/m,
      `consolidates: [${parts.map((p) => p.id).join(', ')}]`,
    )
    .replace(
      /^status:.*$/m,
      `status: ${aggregateStatus(parts.map((p) => p.status))}`,
    )
  let body = text.slice(fm.end)
  const start = body.indexOf(PARTS_START)
  const end = body.indexOf(PARTS_END)
  if (start === -1 || end === -1) {
    errors.push(`${file}: missing ${PARTS_START} / ${PARTS_END} markers`)
  } else {
    body = `${body.slice(0, start + PARTS_START.length)}\n\n${partsTable(parts)}\n\n${body.slice(end)}`
  }
  pending.set(path, `---\n${raw}\n---\n${body}`)
  return parts
}

const files = readdirSync(specsDir)
  .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
  .sort()
const entries = files.flatMap(readSpec)

const seen = new Set<string>()
for (const e of entries) {
  if (!ID_PATTERN.test(e.id)) {
    errors.push(`${e.href}: id "${e.id}" is not a YYYYMMDDHHmm timestamp`)
  }
  if (seen.has(e.id)) errors.push(`${e.href}: duplicate id ${e.id}`)
  seen.add(e.id)
  if (!STATUS_ORDER.includes(e.status)) {
    errors.push(`${e.href}: unknown status "${e.status}"`)
  }
}

if (errors.length > 0) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'))
  process.exit(1)
}

entries.sort((a, b) => b.id.localeCompare(a.id))
pending.set(
  indexPath,
  [
    '# Spec Index',
    '',
    '<!-- Generated by `bun --bun run specs:index` from spec frontmatter — do not edit by hand. -->',
    '',
    'All specs for the Momentum project, newest first. IDs are UTC `YYYYMMDDHHmm` creation timestamps; **Legacy** is the sequential number a spec had before timestamp IDs, still used in older prose ("spec 024").',
    '',
    '| ID | Spec | Feature | Status | Created | Legacy |',
    '| --- | --- | --- | --- | --- | --- |',
    ...entries.map(
      (e) =>
        `| ${e.id} | [${e.title.replaceAll('|', '\\|')}](${e.href}) | ${e.feature} | ${e.status} | ${e.created} | ${e.legacyId || '—'} |`,
    ),
    '',
  ].join('\n'),
)

const stale: string[] = []
for (const [path, content] of pending) {
  const options = await resolveConfig(path)
  const formatted = await format(content, { ...options, filepath: path })
  if (formatted === readFileSync(path, 'utf8')) continue
  stale.push(path.slice(specsDir.length + 1))
  if (!checkOnly) writeFileSync(path, formatted)
}

if (checkOnly && stale.length > 0) {
  console.error(
    `Stale spec index content in: ${stale.join(', ')}\nRun \`bun --bun run specs:index\`.`,
  )
  process.exit(1)
}
console.log(
  stale.length > 0
    ? `Updated ${stale.join(', ')}`
    : `Spec index is up to date (${entries.length} specs).`,
)
