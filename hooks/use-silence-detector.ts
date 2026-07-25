"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateRms } from "@/lib/audio/rms";
import { SilenceDetector } from "@/lib/audio/silence-detector";

const START_THRESHOLD = 0.02;
const STOP_THRESHOLD = 0.012;
const POLL_INTERVAL_MS = 50;

export interface UseSilenceDetectorOptions {
  silenceDurationMs: number;
  onSpeechStart?: () => void;
  onFinalize: () => void;
  onError?: (message: string) => void;
}

export interface UseSilenceDetectorResult {
  isSpeaking: boolean;
  start: (stream: MediaStream) => void;
  stop: () => void;
  flush: () => void;
}

export function useSilenceDetector(options: UseSilenceDetectorOptions): UseSilenceDetectorResult {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const detectorRef = useRef<SilenceDetector | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    detectorRef.current = null;
    dataArrayRef.current = null;
    setIsSpeaking(false);
  }, []);

  const start = useCallback(
    (stream: MediaStream) => {
      stop();

      let audioContext: AudioContext;
      try {
        audioContext = new AudioContext();
        void audioContext.resume();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      } catch {
        optionsRef.current.onError?.("マイクを利用できません");
        return;
      }

      detectorRef.current = new SilenceDetector({
        startThreshold: START_THRESHOLD,
        stopThreshold: STOP_THRESHOLD,
        silenceDurationMs: optionsRef.current.silenceDurationMs,
        onSpeechStart: () => {
          setIsSpeaking(true);
          optionsRef.current.onSpeechStart?.();
        },
        onFinalize: () => {
          setIsSpeaking(false);
          optionsRef.current.onFinalize();
        },
      });

      intervalRef.current = setInterval(() => {
        const analyser = analyserRef.current;
        const detector = detectorRef.current;
        const dataArray = dataArrayRef.current;
        if (!analyser || !detector || !dataArray) {
          return;
        }
        analyser.getByteTimeDomainData(dataArray);
        const rms = calculateRms(dataArray);
        detector.update(rms, performance.now());
      }, POLL_INTERVAL_MS);
    },
    [stop],
  );

  const flush = useCallback(() => {
    detectorRef.current?.flush();
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return useMemo(
    () => ({ isSpeaking, start, stop, flush }),
    [isSpeaking, start, stop, flush],
  );
}
