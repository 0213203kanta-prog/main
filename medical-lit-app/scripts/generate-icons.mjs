// 外部ツールなしでPWA用アイコン(虫眼鏡マーク)のPNGを生成するスクリプト。
// 好きな画像に差し替えたい場合は public/icons/ 以下のPNGを直接置き換えればよい。
// 再生成したい場合: npm run gen:icons
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "icons");

const BG = [29, 78, 216, 255]; // #1d4ed8
const FG = [255, 255, 255, 255];

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function pixelAt(x, y, size) {
  const cx = size * 0.42;
  const cy = size * 0.42;
  const outerR = size * 0.22;
  const thickness = size * 0.07;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (Math.abs(dist - outerR) < thickness / 2) return FG; // 円(レンズ)

  // 持ち手(右下に伸びる斜め線)
  const angle = Math.PI / 4;
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const startX = cx + outerR * dirX;
  const startY = cy + outerR * dirY;
  const endX = cx + size * 0.42 * dirX;
  const endY = cy + size * 0.42 * dirY;

  const segX = endX - startX;
  const segY = endY - startY;
  const segLenSq = segX * segX + segY * segY;
  const t = Math.max(0, Math.min(1, ((x - startX) * segX + (y - startY) * segY) / segLenSq));
  const projX = startX + t * segX;
  const projY = startY + t * segY;
  const distToSeg = Math.sqrt((x - projX) ** 2 + (y - projY) ** 2);
  if (distToSeg < thickness / 2) return FG;

  return BG;
}

function generatePng(size) {
  const rowBytes = size * 4;
  const raw = Buffer.alloc((rowBytes + 1) * size);

  for (let y = 0; y < size; y++) {
    const rowStart = y * (rowBytes + 1);
    raw[rowStart] = 0; // フィルタなし
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelAt(x, y, size);
      const offset = rowStart + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = deflateSync(raw);

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [180, 192, 512]) {
  const png = generatePng(size);
  const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
  writeFileSync(join(OUT_DIR, name), png);
  console.log(`generated ${name}`);
}
