import { MAX_FONT_BYTES } from './appearance';

const SIGNATURES: Record<string, readonly number[]> = {
  woff2: [0x77, 0x4f, 0x46, 0x32],
  ttf: [0, 1, 0, 0],
  otf: [0x4f, 0x54, 0x54, 0x4f],
};

export function localFamily(id: string): string {
  return `DashForgeLocal-${id}`;
}

export async function loadFace(id: string, blob: Blob): Promise<FontFace> {
  if (blob.size > MAX_FONT_BYTES) throw new Error('Font files must be 5 MiB or smaller.');
  return new FontFace(localFamily(id), await blob.arrayBuffer()).load();
}

export async function validateFont(id: string, file: File): Promise<void> {
  if (file.size > MAX_FONT_BYTES) throw new Error('Font files must be 5 MiB or smaller.');
  const extension = file.name.toLowerCase().split('.').at(-1) ?? '';
  if (!Object.hasOwn(SIGNATURES, extension)) throw new Error('Choose a WOFF2, TTF, or OTF file.');
  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const signature = SIGNATURES[extension];
  const legacyTrueType =
    extension === 'ttf' && [0x74, 0x72, 0x75, 0x65].every((byte, index) => header[index] === byte);
  if (!legacyTrueType && !signature.every((byte, index) => header[index] === byte)) {
    throw new Error('This font file is damaged or does not match its extension.');
  }
  try {
    await loadFace(id, file);
  } catch {
    throw new Error('This font file is damaged or cannot be opened in this browser.');
  }
}
