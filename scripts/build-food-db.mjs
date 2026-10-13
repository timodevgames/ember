#!/usr/bin/env node
/**
 * Builds public/data/foods-bls.json from the BLS 4.0 Excel file.
 *
 *   node scripts/build-food-db.mjs scripts/data/bls/extracted/BLS_4_0_2025_DE/BLS_4_0_Daten_2025_DE.xlsx
 *
 * Source: Bundeslebensmittelschlüssel (BLS) 4.0, Max Rubner-Institut, CC BY 4.0
 * (https://www.blsdb.de/download). Download the zip into scripts/data/bls/ (gitignored).
 *
 * Output: { source, license, fields, foods: [[code, nameDe, nameEn, kcal, protein, carbs, fat, fiber, sugar, salt], …] }
 * — values per 100 g, rounded to 0.1. Compact arrays keep the file small enough to precache.
 */
import ExcelJS from 'exceljs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const input = process.argv[2];
if (!input) {
  console.error('usage: node scripts/build-food-db.mjs <BLS_4_0_Daten_2025_DE.xlsx>');
  process.exit(1);
}
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'foods-bls.json');

const FIELDS = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'salt'];
const CODES = { kcal: 'ENERCC', protein: 'PROT625', carbs: 'CHO', fat: 'FAT', fiber: 'FIBT', sugar: 'SUGAR', salt: 'NACL' };

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(input);
const ws = wb.worksheets[0];
const header = ws.getRow(1).values; // 1-based
const col = (prefix) => {
  const i = header.findIndex((h) => typeof h === 'string' && h.startsWith(prefix));
  if (i < 0) throw new Error(`column "${prefix}" not found`);
  return i;
};
const cCode = col('BLS Code');
const cDe = col('Lebensmittelbezeichnung');
const cEn = col('Food name');
const cNut = Object.fromEntries(FIELDS.map((f) => [f, col(`${CODES[f]} `)]));

const num = (v) => {
  if (v && typeof v === 'object' && 'result' in v) v = v.result; // formula cells
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
};
const text = (v) => (v && typeof v === 'object' && 'richText' in v ? v.richText.map((t) => t.text).join('') : String(v ?? '')).trim();

const foods = [];
ws.eachRow((row, i) => {
  if (i === 1) return;
  const v = row.values;
  const code = text(v[cCode]);
  const de = text(v[cDe]);
  if (!code || !de) return;
  foods.push([code, de, text(v[cEn]), ...FIELDS.map((f) => num(v[cNut[f]]))]);
});

await mkdir(dirname(out), { recursive: true });
await writeFile(
  out,
  JSON.stringify({
    source: 'Bundeslebensmittelschlüssel (BLS) 4.0, Max Rubner-Institut',
    license: 'CC BY 4.0',
    fields: ['code', 'de', 'en', ...FIELDS],
    foods,
  }),
);
console.log(`wrote ${foods.length} foods → ${out}`);
