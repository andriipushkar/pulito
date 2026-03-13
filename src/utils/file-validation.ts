const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
};

export async function validateFileType(
  file: File | Buffer,
  allowedTypes: string[]
): Promise<{ valid: boolean; detectedType: string | null }> {
  let header: Uint8Array;

  if (Buffer.isBuffer(file)) {
    header = file.subarray(0, 12);
  } else {
    const slice = file.slice(0, 12);
    header = new Uint8Array(await slice.arrayBuffer());
  }

  for (const type of allowedTypes) {
    const signatures = MAGIC_BYTES[type];
    if (!signatures) continue;

    for (const signature of signatures) {
      if (signature.every((byte, i) => header[i] === byte)) {
        return { valid: true, detectedType: type };
      }
    }
  }

  return { valid: false, detectedType: null };
}
