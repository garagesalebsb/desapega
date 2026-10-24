// Testes das partes do app que não dependem de tela: Pix e limpeza de metadados das fotos.
import { test, expect } from '@playwright/test';
import { pixPayload, normalizePixKey, guessPixType, crc16 } from '../js/pix.js';
import { stripMetadata } from '../js/metadata.js';
import { saleStatus, distanceKm, formatDistance, googleCalendarUrl, icsFor } from '../js/when.js';

test.describe('Situação da venda no tempo', () => {
  // Sábado 24/10/2026, das 8h às 14h
  const sale = { id: 'x', title: 'Bazar', starts_on: '2026-10-24', ends_on: '2026-10-24', start_time: '08:00:00', end_time: '14:00:00' };
  const at = (d, h, m = 0) => new Date(2026, 9, d, h, m);

  test('acontecendo agora, até o horário de fechar', () => {
    expect(saleStatus(sale, at(24, 10))).toEqual({ key: 'agora', label: 'Acontecendo agora · até 14h' });
  });
  test('começa em minutos, hoje mais tarde, amanhã e em alguns dias', () => {
    expect(saleStatus(sale, at(24, 7, 20)).label).toBe('Começa em 40 min');
    expect(saleStatus(sale, at(24, 5)).label).toBe('Hoje às 8h');
    expect(saleStatus(sale, at(23, 18)).label).toBe('Amanhã às 8h');
    expect(saleStatus(sale, at(21, 9)).label).toBe('Em 3 dias');
  });
  test('encerrada depois do horário do último dia', () => {
    expect(saleStatus(sale, at(24, 14, 1)).key).toBe('encerrada');
  });
  test('venda de vários dias: fechou hoje, abre amanhã', () => {
    const multi = { ...sale, ends_on: '2026-10-25' };
    expect(saleStatus(multi, at(24, 15)).label).toBe('Amanhã às 8h');
    expect(saleStatus(multi, at(25, 9)).key).toBe('agora');
  });
});

test.describe('Distância e agenda', () => {
  const sale = {
    id: 'abc', title: 'Bazar, do bloco C; tudo sai', description: 'Móveis\ne roupas', region: 'Plano Piloto', address: 'SQS 308 Bloco C',
    lat: -15.81, lng: -47.9, starts_on: '2026-10-24', ends_on: '2026-10-25', start_time: '08:00:00', end_time: '14:30:00',
  };

  test('distância em metros e quilômetros', () => {
    const km = distanceKm({ lat: -15.7939, lng: -47.8828 }, { lat: -15.8396, lng: -48.0262 }); // Plano Piloto → Águas Claras
    expect(km).toBeGreaterThan(15);
    expect(km).toBeLessThan(17);
    expect(formatDistance(0.43)).toBe('450 m');
    expect(formatDistance(2.345)).toBe('2,3 km');
    expect(formatDistance(16.2)).toBe('16 km');
  });

  test('Google Agenda no horário de Brasília (UTC-3), repetindo nos dias da venda', () => {
    const u = new URL(googleCalendarUrl(sale, 'https://exemplo/v/abc/'));
    expect(u.searchParams.get('dates')).toBe('20261024T110000Z/20261024T173000Z');
    expect(u.searchParams.get('recur')).toBe('RRULE:FREQ=DAILY;COUNT=2');
    expect(u.searchParams.get('location')).toContain('SQS 308 Bloco C');
  });

  test('arquivo .ics válido, com lembrete na véspera e texto escapado', () => {
    const ics = icsFor(sale, 'https://exemplo/v/abc/', new Date(Date.UTC(2026, 9, 1)));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261024T110000Z');
    expect(ics).toContain('RRULE:FREQ=DAILY;COUNT=2');
    expect(ics).toContain('SUMMARY:Bazar\\, do bloco C\\; tudo sai');
    expect(ics).toContain('TRIGGER:-P1D');
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});

test.describe('Pix (BR Code)', () => {
  test('gera exatamente o exemplo do manual do Banco Central', () => {
    expect(pixPayload({ key: '123e4567-e12b-12d1-a456-426655440000', name: 'Fulano de Tal', city: 'BRASILIA' })).toBe(
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
    );
  });

  test('inclui o valor e remove acentos do nome', () => {
    const p = pixPayload({ key: '+5561999998888', name: 'João Brasília', amount: 150.5 });
    expect(p).toContain('5406150.50');
    expect(p).toContain('5913Joao Brasilia');
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });

  test('sem valor, o comprador digita no banco', () => {
    expect(pixPayload({ key: 'a@b.com', name: 'X', amount: 0 })).not.toContain('5406');
  });

  test('normaliza e valida chaves', () => {
    expect(normalizePixKey('celular', '(61) 99999-8888')).toBe('+5561999998888');
    expect(normalizePixKey('celular', '+55 61 99999-8888')).toBe('+5561999998888');
    expect(normalizePixKey('cpf', '123.456.789-09')).toBe('12345678909');
    expect(normalizePixKey('cpf', '12.345.678/0001-90')).toBe('12345678000190');
    expect(normalizePixKey('email', ' Fulano@Mail.com ')).toBe('fulano@mail.com');
    expect(normalizePixKey('aleatoria', '123E4567-E12B-12D1-A456-426655440000')).toBe('123e4567-e12b-12d1-a456-426655440000');
    expect(normalizePixKey('cpf', '123')).toBeNull();
    expect(normalizePixKey('email', 'sem-arroba')).toBeNull();
  });

  test('reconhece o tipo da chave salva', () => {
    expect(guessPixType('+5561999998888')).toBe('celular');
    expect(guessPixType('a@b.com')).toBe('email');
    expect(guessPixType('12345678909')).toBe('cpf');
    expect(guessPixType('123e4567-e12b-12d1-a456-426655440000')).toBe('aleatoria');
  });
});

test.describe('Fotos: remoção de metadados', () => {
  const enc = (s) => new TextEncoder().encode(s);
  const cat = (...parts) => Uint8Array.from(parts.flatMap((p) => [...p]));
  const text = async (blob) => Buffer.from(await blob.arrayBuffer()).toString('latin1');
  const SEGREDO = 'GPSLatitude -15.79 SEGREDO';

  test('JPEG: tira EXIF e comentário, mantém a imagem', async () => {
    const seg = (marker, data) => cat([0xff, marker, (data.length + 2) >> 8, (data.length + 2) & 255], data);
    const jpeg = cat([0xff, 0xd8], seg(0xe0, enc('JFIF\0')), seg(0xe1, enc(`Exif\0\0${SEGREDO}`)), seg(0xfe, enc(SEGREDO)), seg(0xdb, new Uint8Array(65)), [0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9]);
    const clean = await text(await stripMetadata(new Blob([jpeg], { type: 'image/jpeg' })));
    expect(clean).not.toContain('SEGREDO');
    expect(clean).toContain('JFIF');
    expect(clean.endsWith('\xff\xd9')).toBe(true);
  });

  test('PNG: tira eXIf e textos', async () => {
    const chunk = (type, data) => cat([0, 0, data.length >> 8, data.length & 255], enc(type), data, [0, 0, 0, 0]);
    const png = cat([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], chunk('IHDR', new Uint8Array(13)), chunk('eXIf', enc(SEGREDO)), chunk('tEXt', enc(`GPS\0${SEGREDO}`)), chunk('IDAT', new Uint8Array(5)), chunk('IEND', new Uint8Array()));
    const clean = await text(await stripMetadata(new Blob([png], { type: 'image/png' })));
    expect(clean).not.toContain('SEGREDO');
    expect(clean).toContain('IHDR');
    expect(clean).toContain('IDAT');
    expect(clean).toContain('IEND');
  });

  test('WebP: tira EXIF, limpa o indicador e corrige o tamanho', async () => {
    const le = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255];
    const chunk = (type, data) => cat(enc(type), le(data.length), data, data.length % 2 ? [0] : []);
    const body = cat(enc('WEBP'), chunk('VP8X', Uint8Array.from([0x08, 0, 0, 0, 63, 0, 0, 47, 0, 0])), chunk('VP8 ', new Uint8Array(10)), chunk('EXIF', enc(SEGREDO + 'x')));
    const webp = cat(enc('RIFF'), le(body.length), body);
    const out = new Uint8Array(await (await stripMetadata(new Blob([webp], { type: 'image/webp' }))).arrayBuffer());
    expect(Buffer.from(out).toString('latin1')).not.toContain('SEGREDO');
    expect(out[20] & 0x08).toBe(0);
    expect(new DataView(out.buffer).getUint32(4, true)).toBe(out.length - 8);
  });

  test('recusa arquivo que não é imagem', async () => {
    await expect(stripMetadata(new Blob([enc('isto não é imagem')]))).rejects.toThrow();
  });
});
