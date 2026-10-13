import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

/**
 * Barcode decoding for food packages (EAN-13/8, UPC-A/E).
 * Safari ships `BarcodeDetector` switched off, so iPhone uses zxing-wasm. The
 * .wasm is bundled with the app (precached by the service worker) instead of
 * the library's default jsDelivr URL, so scanning also works offline.
 */

type Detect = (source: HTMLCanvasElement) => Promise<string | null>;

interface NativeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: {
      new (opts: { formats: string[] }): NativeDetector;
      getSupportedFormats(): Promise<string[]>;
    };
  }
}

let zxingReady: Promise<typeof import('zxing-wasm/reader')> | null = null;

function zxing() {
  if (!zxingReady) {
    zxingReady = import('zxing-wasm/reader').then((m) => {
      m.prepareZXingModule({
        overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
      });
      return m;
    });
  }
  return zxingReady;
}

export async function createDetector(): Promise<{ detect: Detect; engine: 'native' | 'zxing' }> {
  const BD = typeof window !== 'undefined' ? window.BarcodeDetector : undefined;
  if (BD) {
    try {
      const formats = await BD.getSupportedFormats();
      if (formats.includes('ean_13')) {
        const det = new BD({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'].filter((f) => formats.includes(f)) });
        return {
          engine: 'native',
          detect: async (c) => {
            const r = await det.detect(c);
            return r.find((x) => isValidGtin(x.rawValue))?.rawValue ?? null;
          },
        };
      }
    } catch {
      /* fall through to zxing */
    }
  }
  const m = await zxing();
  return {
    engine: 'zxing',
    detect: async (c) => {
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const res = await m.readBarcodes(img, { formats: ['EANUPC'], tryHarder: true, maxNumberOfSymbols: 1 });
      const hit = res.find((r) => r.isValid && isValidGtin(r.text));
      return hit?.text ?? null;
    },
  };
}

/** GTIN check digit (EAN-8, UPC-A, EAN-13, GTIN-14). Filters out misreads. */
export function isValidGtin(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((a, d, i) => a + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
