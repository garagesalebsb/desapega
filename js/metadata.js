// Remove metadados (EXIF com GPS, XMP, IPTC, textos) de fotos enviadas sem redução.
// A imagem em si não é alterada: só os blocos de informação extra são descartados.

export async function stripMetadata(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let out = null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8) out = stripJpeg(bytes);
  else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) out = stripPng(bytes);
  else if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') out = stripWebp(bytes);
  if (!out) throw new Error('Não foi possível limpar os dados da foto.');
  return new Blob([out], { type: blob.type });
}

const ascii = (b, at, n) => String.fromCharCode(...b.subarray(at, at + n));

// JPEG: mantém APP0 (JFIF), APP2 (perfil de cor) e APP14 (Adobe); descarta os demais APPn e comentários.
function stripJpeg(b) {
  const keep = [b.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) { i++; continue; } // preenchimento
    if (marker === 0xda) { keep.push(b.subarray(i)); return concat(keep); } // início dos dados da imagem
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2 || i + 2 + len > b.length) return null;
    const isApp = marker >= 0xe0 && marker <= 0xef;
    const drop = (isApp && ![0xe0, 0xe2, 0xee].includes(marker)) || marker === 0xfe;
    if (!drop) keep.push(b.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return null;
}

// PNG: descarta os blocos eXIf, tEXt, zTXt, iTXt e tIME.
function stripPng(b) {
  const drop = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);
  const keep = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + len;
    if (end > b.length) return null;
    if (!drop.has(type)) keep.push(b.subarray(i, end));
    i = end;
    if (type === 'IEND') return concat(keep);
  }
  return null;
}

// WebP: descarta os blocos EXIF e XMP, ajusta os indicadores do VP8X e o tamanho do arquivo.
function stripWebp(b) {
  const keep = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const type = ascii(b, i, 4);
    const len = (b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24)) >>> 0;
    const end = i + 8 + len + (len & 1);
    if (i + 8 + len > b.length) return null;
    if (type !== 'EXIF' && type !== 'XMP ') {
      const chunk = b.slice(i, Math.min(end, b.length));
      if (type === 'VP8X') chunk[8] &= ~(0x08 | 0x04); // sem EXIF, sem XMP
      keep.push(chunk);
    }
    i = end;
  }
  const body = concat(keep);
  const out = new Uint8Array(12 + body.length);
  out.set(b.subarray(0, 12));
  new DataView(out.buffer).setUint32(4, 4 + body.length, true);
  out.set(body, 12);
  return out;
}

function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
