import { useEffect, useRef, useState } from 'react';
import { createDetector, isValidGtin } from '../../core/nutrition/barcode';

interface Props {
  onResult: (code: string) => void;
  onClose: () => void;
}

/**
 * Full-screen camera scanner. Grabs the centre band of each frame (where the
 * guide box is) ~4×/s and hands it to BarcodeDetector or zxing-wasm.
 * iOS needs playsInline + muted for the video to run inside a home-screen app.
 */
export default function BarcodeScanner({ onResult, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [engine, setEngine] = useState<string>('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer = 0;
    const canvas = document.createElement('canvas');

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) return;
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        const det = await createDetector();
        setEngine(det.engine);
        const tick = async () => {
          if (stopped) return;
          if (v.videoWidth > 0) {
            // centre band, 80 % wide × 40 % high
            const w = Math.round(v.videoWidth * 0.8);
            const h = Math.round(v.videoHeight * 0.4);
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d', { willReadFrequently: true })!.drawImage(v, (v.videoWidth - w) / 2, (v.videoHeight - h) / 2, w, h, 0, 0, w, h);
            try {
              const code = await det.detect(canvas);
              if (code && !stopped) {
                stopped = true;
                onResult(code);
                return;
              }
            } catch {
              /* a bad frame — keep going */
            }
          }
          timer = window.setTimeout(tick, 250);
        };
        tick();
      } catch (e) {
        const name = (e as Error).name;
        setError(name === 'NotAllowedError' ? 'Camera access was denied. Allow it in Settings → Safari → Camera, or type the barcode below.' : 'The camera could not be started. Type the barcode below instead.');
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  const manualOk = isValidGtin(manual.trim());

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black pb-safe pt-safe">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-semibold">Scan a barcode</span>
        <button onClick={onClose} className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold">
          Close
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-[30%] w-[80%] rounded-2xl border-2 border-ember-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
        {error && <p className="absolute inset-x-4 top-4 rounded-xl bg-hp-500/90 p-3 text-sm">{error}</p>}
        {engine && !error && <p className="absolute inset-x-0 bottom-3 text-center text-xs text-white/60">Hold the barcode inside the box</p>}
      </div>
      <form
        className="flex gap-2 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (manualOk) onResult(manual.trim());
        }}
      >
        <input inputMode="numeric" value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))} placeholder="…or type the numbers" className="min-w-0 flex-1 rounded-xl border border-night-600 bg-night-800 px-3 py-2.5" aria-label="Barcode number" />
        <button disabled={!manualOk} className="rounded-xl bg-ember-500 px-4 font-bold text-night-950 disabled:opacity-40">
          Go
        </button>
      </form>
    </div>
  );
}
