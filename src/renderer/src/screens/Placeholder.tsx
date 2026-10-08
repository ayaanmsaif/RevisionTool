export function Placeholder({ title }: { title: string }): React.JSX.Element {
  return (
    <div className="mx-auto max-w-5xl px-10 py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
    </div>
  )
}
