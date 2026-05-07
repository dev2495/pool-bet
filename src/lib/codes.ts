// Generate short, human-friendly login codes like "BR4-92K".
// Avoid easily-confused chars (0/O, 1/I/L, etc.).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function randomCode(parts: number[] = [3, 3]): string {
  const segs = parts.map((n) => {
    let out = "";
    for (let i = 0; i < n; i++) {
      out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    return out;
  });
  return segs.join("-");
}
