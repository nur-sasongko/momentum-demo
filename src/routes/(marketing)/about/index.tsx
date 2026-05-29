import { createFileRoute } from '@tanstack/react-router'
import { AboutHero } from './-components/about-hero'
import { aboutQueryOptions } from './-queries/about-queries'

export const Route = createFileRoute('/(marketing)/about/')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(aboutQueryOptions),
  component: AboutPage,
})

function AboutPage() {
  const content = Route.useLoaderData()

  return (
    <main className="page-wrap px-4 py-12">
      <AboutHero {...content} />
    </main>
  )
}
