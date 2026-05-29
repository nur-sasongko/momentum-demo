import type { AboutContent } from '../-types/about'

export const aboutQueryKeys = {
  all: ['about'] as const,
  content: () => [...aboutQueryKeys.all, 'content'] as const,
}

export function getAboutContent(): AboutContent {
  return {
    kicker: 'About',
    title: 'A small starter with room to grow.',
    description:
      'TanStack Start gives you type-safe routing, server functions, and modern SSR defaults. Use this as a clean foundation, then layer in your own routes, styling, and add-ons.',
  }
}

export const aboutQueryOptions = {
  queryKey: aboutQueryKeys.content(),
  queryFn: () => getAboutContent(),
}
