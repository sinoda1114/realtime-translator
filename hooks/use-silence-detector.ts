"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateRms } from "@/lib/audio/rms";
import { SilenceDetector } from "@/lib/audio/silence-detector";
import {
  calibrateThresholds,
  CALIBRATION_DURATION_MS,
  DEFAULT_START_THRESHOLD,
  DEFAULT_STOP_THRESHOLD,
} from "@/lib/audio/threshold-calibration";
import { logger } from "@/lib/logger";

const POLL_INTERVAL_MS = 50;
const RMS_DISPLAY_UPDATE_EVERY_N_TICKS = 4;
const CALIBRATION_TICKS = Math.ceil(CALIBRATION_DURATION_MS / POLL_INTERVAL_MS);

export interface UseSilenceDetectorOptions {
  silenceDurationMs: number;
  onSpeechStart?: () => void;
  onFinalize: () => void;
  onError?: (message: string) => void;
}

export interface UseSilenceDetectorResult {
  isSpeaking: boolean;
  currentRms: number | null;
  start: (stream: MediaStream) => void;
  stop: () => void;
  flush: () => void;
}

export function useSilenceDetector(options: UseSilenceDetectorOptions): UseSilenceDetectorResult {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentRms, setCurrentRms] = useState<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const detectorRef = useRef<SilenceDetector | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const tickCountRef = useRef(0);
  const calibrationSamplesRef = useRef<number[]>([]);
  const isCalibratingRef = useRef(false);
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
    tickCountRef.current = 0;
    calibrationSamplesRef.current = [];
    isCalibratingRef.current = false;
    setIsSpeaking(false);
    setCurrentRms(null);
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

      // Starts on the fixed defaults; the calibration window below replaces
      // them once it has heard enough of the room.
      detectorRef.current = new SilenceDetector({
        startThreshold: DEFAULT_START_THRESHOLD,
        stopThreshold: DEFAULT_STOP_THRESHOLD,
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
      calibrationSamplesRef.current = [];
      isCalibratingRef.current = true;

      intervalRef.current = setInterval(() => {
        const analyser = analyserRef.current;
        const detector = detectorRef.current;
        const dataArray = dataArrayRef.current;
        if (!analyser || !detector || !dataArray) {
          return;
        }
        analyser.getByteTimeDomainData(dataArray);
        const rms = calculateRms(dataArray);

        if (isCalibratingRef.current) {
          calibrationSamplesRef.current.push(rms);
          if (calibrationSamplesRef.current.length >= CALIBRATION_TICKS) {
            const { startThreshold, stopThreshold } = calibrateThresholds(
              calibrationSamplesRef.current,
            );
            detector.setThresholds(startThreshold, stopThreshold);
            isCalibratingRef.current = false;
            calibrationSamplesRef.current = [];
            logger.info("silence_detector.calibrated", {
              startThreshold: startThreshold.toFixed(5),
              stopThreshold: stopThreshold.toFixed(5),
            });
          }
        }

        // Runs during calibration too, on the fixed defaults. Skipping it for
        // the calibration window would drop any utterance that both starts
        // and ends within the first ~1.5s — it would never be finalized on
        // its own, only swept up into whatever is spoken next. Detection is
        // simply less sensitive until the thresholds settle, which is no
        // worse than the pre-calibration behaviour.
        detector.update(rms, performance.now());

        tickCountRef.current += 1;
        if (tickCountRef.current % RMS_DISPLAY_UPDATE_EVERY_N_TICKS === 0) {
          setCurrentRms(rms);
        }
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
    () => ({ isSpeaking, currentRms, start, stop, flush }),
    [isSpeaking, currentRms, start, stop, flush],
  );
}
