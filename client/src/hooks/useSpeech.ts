/**
 * Reliable Web Speech recognition for desktop and phones.
 * - A fresh recogniser per tap (mobile Chrome often fails silently when an instance is reused).
 * - "Listening" follows the browser's real onstart/onend events, never set optimistically.
 * - Phones often end without a final result: the last phrase heard is used instead.
 * - Hard stop after a timeout, and a forced reset if the browser never reports the end,
 *   so the button can never stay stuck on "listening".
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export type VoiceLang = 'en-LK' | 'si-LK'
const LANG_KEY = 'ff_voice_lang'

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone permission is blocked. Allow the microphone for this site in your browser settings, then try again.',
  'service-not-allowed': 'Speech recognition is turned off on this device or browser.',
  'audio-capture': 'No microphone was found, or another app is using it.',
  'network': 'Speech recognition needs an internet connection.',
  'no-speech': "Didn't hear anything — tap the mic and speak right away.",
  'language-not-supported': 'This browser cannot recognise that language. On phones, use Chrome for Sinhala.',
  'bad-grammar': 'Could not understand that — please try again.',
}

export function useSpeech(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [lang, setLangState] = useState<VoiceLang>(() => { try { return (localStorage.getItem(LANG_KEY) as VoiceLang) || 'en-LK' } catch { return 'en-LK' } })
  const recRef = useRef<any>(null)
  const finalCb = useRef(onFinal)
  finalCb.current = onFinal
  const timers = useRef<number[]>([])

  const SR: any = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null
  const supported = !!SR

  const clearTimers = () => { timers.current.forEach(t => clearTimeout(t)); timers.current = [] }

  const setLang = (l: VoiceLang) => { setLangState(l); try { localStorage.setItem(LANG_KEY, l) } catch { /* ignore */ } }

  const start = useCallback(() => {
    setError(null)
    if (!SR) { setError('Voice input is not supported in this browser. Use Chrome, Edge or Safari, or type below.'); return }
    if (!window.isSecureContext) { setError('Voice input needs a secure (https) connection.'); return }
    try { recRef.current?.abort() } catch { /* ignore */ }
    clearTimers()

    const rec = new SR()
    rec.lang = lang
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1
    let heard = '', finished = false, gotFinal = false

    const finish = () => {
      if (finished) return
      finished = true
      clearTimers()
      setListening(false)
      recRef.current = null
      const text = heard.trim()
      setInterim(text)
      if (text) finalCb.current(text)
    }

    rec.onstart = () => setListening(true)
    rec.onresult = (e: any) => {
      // One utterance per tap: the latest result holds the whole phrase (avoids Android's duplicated results)
      const last = e.results[e.results.length - 1]
      heard = last[0].transcript
      setInterim(heard)
      if (last.isFinal) { gotFinal = true; try { rec.stop() } catch { /* ignore */ } }
    }
    rec.onspeechend = () => { try { rec.stop() } catch { /* ignore */ } }
    rec.onerror = (e: any) => {
      if (e.error !== 'aborted' && !(e.error === 'no-speech' && heard)) setError(ERRORS[e.error] || `Voice error: ${e.error}`)
      if (e.error !== 'no-speech' || !heard) heard = e.error === 'no-speech' ? '' : heard
    }
    rec.onend = finish

    // Safety nets: stop after 12 s; if the browser never reports the end, reset anyway
    timers.current.push(window.setTimeout(() => { try { rec.stop() } catch { /* ignore */ } }, 12000))
    timers.current.push(window.setTimeout(() => { if (!finished) { try { rec.abort() } catch { /* ignore */ } finish() } }, 15000))

    recRef.current = rec
    setInterim('')
    try { rec.start() } catch (err: any) {
      setError(err?.message?.includes('already started') ? 'The microphone is already listening.' : 'Could not start the microphone.')
      finish()
    }
    void gotFinal
  }, [SR, lang])

  const stop = useCallback(() => {
    const rec = recRef.current
    if (!rec) { setListening(false); return }
    try { rec.stop() } catch { /* ignore */ }
    // Some phones never fire onend after stop(): force it shortly after
    timers.current.push(window.setTimeout(() => { if (recRef.current === rec) { try { rec.abort() } catch { /* ignore */ } rec.onend?.() } }, 1500))
  }, [])

  useEffect(() => () => { clearTimers(); try { recRef.current?.abort() } catch { /* ignore */ } }, [])

  return { supported, listening, interim, error, lang, setLang, start, stop, setError }
}
