import { useState, useRef, useCallback, useEffect } from "react";

interface SpeechRecognitionOptions {
  language: string;
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
  getCurrentText: () => string;
}

interface SpeechRecognitionHook {
  isRecording: boolean;
  isSupported: boolean;
  toggleRecording: () => void;
  stopRecording: () => void;
}

// Local type declarations for the Web Speech API (not in default DOM lib)
interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: { transcript: string; confidence: number } | undefined;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult | undefined;
}

interface SpeechRecogResultEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecogErrorEvent extends Event {
  readonly error: string;
}

interface SpeechRecogInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecogResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecogErrorEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecogConstructor {
  new (): SpeechRecogInstance;
}

interface WindowWithSpeech {
  SpeechRecognition?: SpeechRecogConstructor;
  webkitSpeechRecognition?: SpeechRecogConstructor;
}

const getWindow = () => typeof window !== "undefined" ? window as unknown as WindowWithSpeech : undefined;

const isSupported = !!getWindow()?.SpeechRecognition || !!getWindow()?.webkitSpeechRecognition;

export function useSpeechRecognition({
  language,
  onTranscript,
  onError,
  getCurrentText,
}: SpeechRecognitionOptions): SpeechRecognitionHook {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecogInstance | null>(null);
  const isRecordingRef = useRef(false);
  const baseTextRef = useRef("");

  // Store callbacks in refs so event handlers always use the latest versions
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const getCurrentTextRef = useRef(getCurrentText);
  getCurrentTextRef.current = getCurrentText;

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onresult = null;
      try {
        recognitionRef.current.stop();
      } catch {
        // already stopped
      }
      recognitionRef.current = null;
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!isSupported) return;

    const w = getWindow();
    const Ctor = w?.SpeechRecognition ?? w?.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    baseTextRef.current = getCurrentTextRef.current();

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const alt = result?.[0];
        if (alt) {
          transcript += alt.transcript;
        }
      }
      const separator = baseTextRef.current ? " " : "";
      onTranscriptRef.current(baseTextRef.current + separator + transcript);
    };

    recognition.onend = () => {
      // Chrome stops after silence — auto-restart if still recording
      if (isRecordingRef.current) {
        baseTextRef.current = getCurrentTextRef.current();
        try {
          recognition.start();
        } catch {
          stopRecording();
        }
      }
    };

    recognition.onerror = (event) => {
      const errorMessages: Record<string, string> = {
        "not-allowed": "Microphone access denied. Please allow microphone permission.",
        "no-speech": "No speech detected. Please try again.",
        "audio-capture": "No microphone found. Please check your audio device.",
        network: "Network error. Speech recognition requires an internet connection.",
        aborted: "",
      };
      const message = errorMessages[event.error] ?? `Speech recognition error: ${event.error}`;
      if (message) {
        onErrorRef.current(message);
      }
      stopRecording();
    };

    recognitionRef.current = recognition;
    isRecordingRef.current = true;
    setIsRecording(true);

    try {
      recognition.start();
    } catch {
      stopRecording();
      onErrorRef.current("Failed to start speech recognition.");
    }
  }, [language, stopRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecordingRef.current) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [startRecording, stopRecording]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
      isRecordingRef.current = false;
    };
  }, []);

  return { isRecording, isSupported, toggleRecording, stopRecording };
}
