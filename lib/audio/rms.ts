export function calculateRms(samples: Uint8Array): number {
  if (samples.length === 0) {
    return 0;
  }

  let sumSquares = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const normalized = (samples[i] - 128) / 128;
    sumSquares += normalized * normalized;
  }

  return Math.sqrt(sumSquares / samples.length);
}
