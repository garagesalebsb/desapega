// Situação da venda no tempo ("acontecendo agora", "começa em 40 min"), distância e agenda.
// Sem dependência de tela: testado em tests/units.spec.mjs.

const at = (date, time) => {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
};
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hour = (t) => {
  const [h, m] = t.split(':');
  return `${Number(h)}h${m === '00' ? '' : m}`;
};

// key: 'agora' | 'hoje' | 'amanha' | 'breve' | 'encerrada'
export function saleStatus(s, now = new Date()) {
  if (now >= at(s.ends_on, s.end_time)) return { key: 'encerrada', label: 'Encerrada' };
  const first = s.starts_on > iso(now) ? s.starts_on : iso(now);
  for (let d = at(first, '00:00'); iso(d) <= s.ends_on; d.setDate(d.getDate() + 1)) {
    const open = at(iso(d), s.start_time);
    const close = at(iso(d), s.end_time);
    if (now >= close) continue; // já fechou hoje: vale o próximo dia
    if (now >= open) return { key: 'agora', label: `Acontecendo agora · até ${hour(s.end_time)}` };
    const minutes = Math.round((open - now) / 60000);
    if (iso(open) === iso(now)) {
      return { key: 'hoje', label: minutes < 60 ? `Começa em ${Math.max(minutes, 1)} min` : `Hoje às ${hour(s.start_time)}` };
    }
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    if (iso(open) === iso(tomorrow)) return { key: 'amanha', label: `Amanhã às ${hour(s.start_time)}` };
    const days = Math.round((at(iso(open), '00:00') - at(iso(now), '00:00')) / 864e5);
    return { key: 'breve', label: `Em ${days} dias` };
  }
  return { key: 'encerrada', label: 'Encerrada' };
}

export function distanceKm(a, b) {
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export const formatDistance = (km) =>
  km < 1 ? `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m` : `${km.toFixed(km < 10 ? 1 : 0).replace('.', ',')} km`;

// ---------------------------------------------------------------------
// Agenda. Brasília não tem horário de verão desde 2019: UTC-3 fixo.
// ---------------------------------------------------------------------
const utc = (date, time) => {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh + 3, mm));
};
const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const days = (s) => Math.round((at(s.ends_on, '00:00') - at(s.starts_on, '00:00')) / 864e5) + 1;
const place = (s) => [s.address, s.reference, s.region, 'Brasília - DF'].filter(Boolean).join(', ');

export function googleCalendarUrl(s, url) {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: s.title,
    dates: `${stamp(utc(s.starts_on, s.start_time))}/${stamp(utc(s.starts_on, s.end_time))}`,
    details: `${s.description ? `${s.description}\n\n` : ''}Itens e contato: ${url}`,
    location: place(s),
    ctz: 'America/Sao_Paulo',
  });
  if (days(s) > 1) q.set('recur', `RRULE:FREQ=DAILY;COUNT=${days(s)}`);
  return `https://calendar.google.com/calendar/render?${q}`;
}

const icsText = (t) => String(t ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
// Linhas do .ics têm no máximo 75 bytes; o resto continua na linha seguinte, começando com espaço.
function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let chunk = '';
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) {
      out.push(chunk);
      chunk = '';
      size = 0;
    }
    chunk += ch;
    size += n;
  }
  out.push(chunk);
  return out.join('\r\n ');
}

export function icsFor(s, url, now = new Date()) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Desapega//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${s.id}@desapego-brasilia`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(utc(s.starts_on, s.start_time))}`,
    `DTEND:${stamp(utc(s.starts_on, s.end_time))}`,
    ...(days(s) > 1 ? [`RRULE:FREQ=DAILY;COUNT=${days(s)}`] : []),
    `SUMMARY:${icsText(s.title)}`,
    `LOCATION:${icsText(place(s))}`,
    `GEO:${s.lat};${s.lng}`,
    `DESCRIPTION:${icsText(`${s.description ? `${s.description}\n\n` : ''}Itens e contato: ${url}`)}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-P1D',
    `DESCRIPTION:${icsText(`Amanhã: ${s.title}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
