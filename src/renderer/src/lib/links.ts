/** Link to the study screen; `back` is where Finish and Leave return to. */
export function studyLink(params: Record<string, string | undefined>, back: string): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v)
  q.set('back', back)
  return `/study?${q.toString()}`
}
