/**
 * On-device receipt OCR with tesseract.js (WASM). The engine and English model are fetched on
 * first use and cached by the browser; the image never leaves the device.
 */
import { parseReceiptText, type ReceiptDraft } from '../lib/finance'

export async function scanReceipt(file: Blob, onProgress?: (pct: number) => void): Promise<ReceiptDraft & { text: string }> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: (m: any) => { if (m.status === 'recognizing text' && onProgress) onProgress(Math.round(m.progress * 100)) },
  })
  try {
    const { data } = await worker.recognize(file)
    const draft = parseReceiptText(data.text || '')
    // blend parser confidence with OCR confidence
    const ocr = typeof data.confidence === 'number' ? data.confidence / 100 : 1
    return { ...draft, confidence: Math.round(draft.confidence * Math.min(1, ocr + 0.2) * 100) / 100, text: data.text || '' }
  } finally {
    await worker.terminate()
  }
}
