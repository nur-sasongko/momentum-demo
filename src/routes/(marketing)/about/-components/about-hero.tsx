import type { AboutContent } from '../-types/about'

type AboutHeroProps = AboutContent

export function AboutHero({ kicker, title, description }: AboutHeroProps) {
  return (
    <section className="island-shell rounded-2xl p-6 sm:p-8">
      <p className="island-kicker mb-2">{kicker}</p>
      <h1 className="display-title mb-3 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
        {title}
      </h1>
      <p className="m-0 max-w-3xl text-base leading-8 text-[var(--sea-ink-soft)]">
        {description}
      </p>
    </section>
  )
}
