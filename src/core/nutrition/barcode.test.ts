/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { prepareZXingModule, readBarcodes, writeBarcode } from 'zxing-wasm/full';
import { isValidGtin } from './barcode';

// In Node the wasm comes from node_modules instead of the CDN.
const require = createRequire(import.meta.url);
prepareZXingModule({ overrides: { wasmBinary: readFileSync(require.resolve('zxing-wasm/full/zxing_full.wasm')).buffer as ArrayBuffer } });

describe('barcodes', () => {
  it('validates GTIN check digits', () => {
    expect(isValidGtin('4006381333931')).toBe(true); // EAN-13
    expect(isValidGtin('20692285')).toBe(true); // EAN-8
    expect(isValidGtin('4006381333932')).toBe(false);
    expect(isValidGtin('12345')).toBe(false);
  });

  it('reads an EAN-13 with the same options the scanner uses', async () => {
    const written = await writeBarcode('4006381333931', { format: 'EAN13', scale: 3 });
    expect(written.image).toBeTruthy();
    const res = await readBarcodes(written.image!, { formats: ['EANUPC'], tryHarder: true, maxNumberOfSymbols: 1 });
    expect(res[0]?.text).toBe('4006381333931');
    expect(res[0]?.isValid).toBe(true);
  });
});
