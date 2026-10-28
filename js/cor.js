// Cor do app escolhida no Menu: barra do navegador (meta theme-color) e cor principal do tema
// (--brand, --brand-ink, --brand-soft), no modo claro e no escuro. Fica só neste aparelho.
// Script comum no <head>, sem defer: aplica a cor antes de desenhar a página.
(function () {
  var KEY = 'cor-barra';
  var DEFAULT = '#4a8420';
  var WHITE = [255, 255, 255];
  var BLACK = [0, 0, 0];
  var DARK_SURFACE = [27, 31, 25]; // --surface do modo escuro

  var rgb = function (hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  var toHex = function (c) { return '#' + c.map(function (v) { return Math.round(v).toString(16).padStart(2, '0'); }).join(''); };
  var mix = function (a, b, t) { return a.map(function (v, i) { return v + (b[i] - v) * t; }); };
  var lum = function (c) {
    var l = c.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
  };
  var contrast = function (a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // Escurece (no claro) ou clareia (no escuro) até a cor ficar legível sobre o fundo: 4,5:1, como texto.
  var readable = function (c, bg, toward) {
    for (var t = 0; t < 1 && contrast(mix(c, toward, t), bg) < 4.5; t += 0.05);
    return mix(c, toward, Math.min(t, 1));
  };

  function vars(color) {
    var c = rgb(color);
    var light = readable(c, WHITE, BLACK);
    var dark = readable(c, DARK_SURFACE, WHITE);
    return {
      light: '--brand:' + toHex(light) + ';--brand-ink:#ffffff;--brand-soft:' + toHex(mix(light, WHITE, 0.88)) + ';',
      dark: '--brand:' + toHex(dark) + ';--brand-ink:#121511;--brand-soft:' + toHex(mix(dark, DARK_SURFACE, 0.82)) + ';',
    };
  }

  function apply(color) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = color;
    var style = document.getElementById('cor-do-app');
    if (color === DEFAULT) {
      // Verde padrão: valem as cores ajustadas à mão no css/style.css.
      if (style) style.remove();
      return;
    }
    if (!style) {
      style = document.createElement('style');
      style.id = 'cor-do-app';
      document.head.appendChild(style);
    }
    var v = vars(color);
    // Mesmos seletores do css/style.css; por vir depois, este bloco vence.
    style.textContent = ':root{' + v.light + '}' +
      '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){' + v.dark + '}}' +
      ':root[data-theme="dark"]{' + v.dark + '}';
  }

  function get() {
    try {
      var c = localStorage.getItem(KEY);
      return /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : DEFAULT;
    } catch (e) {
      return DEFAULT;
    }
  }

  function set(color) {
    apply(color);
    try {
      if (color === DEFAULT) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, color);
    } catch (e) {}
  }

  window.appColor = { DEFAULT: DEFAULT, get: get, set: set };
  apply(get());
})();
