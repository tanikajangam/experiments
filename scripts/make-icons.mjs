// Draws the app icons as PNGs with no dependencies: a full-bleed green square
// (#2F7A4B) with a cream ring (#F3F0E9). The ring sits inside the maskable
// safe zone, so the same image works as a maskable icon.
// Run: npm run icons
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const GREEN = [0x2f, 0x7a, 0x4b]
const CREAM = [0xf3, 0xf0, 0xe9]

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function icon(size) {
  const ss = 4 // supersampling for smooth edges
  const c = size / 2
  const rOuter = size * 0.3
  const rInner = size * 0.21
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3) // filter byte 0 + RGB
    for (let x = 0; x < size; x++) {
      let hits = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const d = Math.hypot(x + (sx + 0.5) / ss - c, y + (sy + 0.5) / ss - c)
          if (d <= rOuter && d >= rInner) hits++
        }
      }
      const t = hits / (ss * ss)
      for (let i = 0; i < 3; i++) row[1 + x * 3 + i] = Math.round(GREEN[i] * (1 - t) + CREAM[i] * t)
    }
    rows.push(row)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const out = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180, 'favicon.png': 64 }
for (const [name, size] of Object.entries(out)) {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), icon(size))
  console.log(`public/${name} ${size}x${size}`)
}
