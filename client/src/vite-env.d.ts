/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  readonly VITE_GATEWAY_URL?: string
  readonly VITE_OCR_BASE?: string
}
interface ImportMeta { readonly env: ImportMetaEnv }

// Minimal Web Speech API typings (not shipped in lib.dom for all TS versions)
interface SpeechRecognitionAlternative { transcript: string; confidence: number }
interface SpeechRecognitionResult { readonly isFinal: boolean; readonly length: number; [index: number]: SpeechRecognitionAlternative }
interface SpeechRecognitionResultList { readonly length: number; [index: number]: SpeechRecognitionResult }
interface SpeechRecognitionEvent extends Event { readonly results: SpeechRecognitionResultList; readonly resultIndex: number }
interface SpeechRecognitionErrorEvent extends Event { readonly error: string; readonly message: string }
interface SpeechRecognition extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string; maxAlternatives: number
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void; stop(): void; abort(): void
}
