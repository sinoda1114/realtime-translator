"use client";

import { useCallback, useRef } from "react";
import { MIC_CONSTRAINTS } from "@/lib/audio/audio-constraints";

export interface UseMicrophoneResult {
  requestMicrophone: () => Promise<MediaStream>;
  releaseMicrophone: () => void;
}

export function useMicrophone(): UseMicrophoneResult {
  const streamRef = useRef<MediaStream | null>(null);

  const requestMicrophone = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
    streamRef.current = stream;
    return stream;
  }, []);

  const releaseMicrophone = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  return { requestMicrophone, releaseMicrophone };
}
