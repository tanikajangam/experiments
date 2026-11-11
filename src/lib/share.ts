// Hand a file to the user. In the iPhone home-screen app a download link is unreliable, so use the share
// sheet ("Save to Files", AirDrop, Mail) when it can take files, and a download link elsewhere.
// Call straight from a tap: iOS only opens the share sheet inside one.
export function shareFile(name: string, text: string, type = 'application/json'): void {
  const file = new File([text], name, { type })
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    nav.share({ files: [file], title: name }).catch((e: unknown) => {
      // Closing the share sheet is not an error.
      if ((e as { name?: string }).name !== 'AbortError') download(file)
    })
    return
  }
  download(file)
}

function download(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
