import type { ReactNode } from 'react'

export function Panel({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
        {actions}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export const inputClass =
  'w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-violet-500'

export const buttonClass =
  'rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40'

export const ghostButtonClass =
  'rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-40'
