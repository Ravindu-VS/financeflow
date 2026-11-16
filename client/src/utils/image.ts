/** Resize an image file in the browser and return a JPEG data URL (keeps Firestore documents small). */
export async function compressImage(file: Blob, max = 1024, quality = 0.6, square = false): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    const c = document.createElement('canvas')
    if (square) {
      // centre-crop to a square avatar
      const side = Math.min(img.width, img.height), out = Math.min(max, side)
      c.width = c.height = out
      c.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, out, out)
    } else {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    }
    return c.toDataURL('image/jpeg', quality)
  } finally { URL.revokeObjectURL(url) }
}
