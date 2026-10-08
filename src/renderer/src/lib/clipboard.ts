/** Copy text via the Electron bridge, falling back to the web clipboard (e.g. in tests). */
export async function copyText(text: string): Promise<void> {
  if (window.api?.copyText) {
    window.api.copyText(text)
    return
  }
  await navigator.clipboard.writeText(text)
}
