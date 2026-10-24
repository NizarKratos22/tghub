/**
 * Product shots for development listings, drawn as SVG and rasterised by the
 * seed through the real upload pipeline. No stock photos, nothing licensed.
 */
export type ArtKind =
  | 'gpu'
  | 'cpu'
  | 'ram'
  | 'tower'
  | 'laptop'
  | 'controller'
  | 'handheld'
  | 'keyboard'
  | 'mouse'
  | 'headset'
  | 'monitor'
  | 'chair'
  | 'code'
  | 'building'
  | 'car'
  | 'shirt'
  | 'hud'
  | 'server'
  | 'cube'
  | 'disc'
  | 'person'
  | 'wrench';

const W = 1200;
const H = 900;
const BODY = '#17191c';
const PANEL = '#262a2f';
const EDGE = '#3a4047';
const METAL = '#b9c0c8';

function fan(cx: number, cy: number, r: number, accent: string): string {
  const blades = Array.from({ length: 7 }, (_, i) => `<path d="M0 ${-r * 0.22} Q ${r * 0.42} ${-r * 0.55} 0 ${-r * 0.9}" stroke="${EDGE}" stroke-width="${r * 0.13}" fill="none" stroke-linecap="round" transform="rotate(${i * 51.4})"/>`).join('');
  return `<g transform="translate(${cx} ${cy})"><circle r="${r}" fill="#0e1012" stroke="${accent}" stroke-opacity="0.85" stroke-width="${r * 0.07}"/>${blades}<circle r="${r * 0.26}" fill="${PANEL}"/></g>`;
}

function grid(cols: number, rows: number, x: number, y: number, w: number, h: number, gap: number, fill: (c: number, r: number) => string): string {
  const cw = (w - gap * (cols - 1)) / cols;
  const rh = (h - gap * (rows - 1)) / rows;
  let out = '';
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      out += `<rect x="${x + c * (cw + gap)}" y="${y + r * (rh + gap)}" width="${cw}" height="${rh}" rx="${Math.min(cw, rh) * 0.18}" fill="${fill(c, r)}"/>`;
    }
  }
  return out;
}

const OBJECTS: Record<ArtKind, (accent: string) => string> = {
  gpu: (a) => `<g transform="rotate(-6 600 450)">
    <rect x="200" y="440" width="300" height="34" fill="#c9a227"/>
    <rect x="210" y="300" width="780" height="270" rx="30" fill="${BODY}"/>
    <rect x="210" y="300" width="780" height="46" rx="23" fill="${PANEL}"/>
    ${fan(420, 450, 108, a)}${fan(780, 450, 108, a)}
    <rect x="210" y="556" width="780" height="14" fill="${a}"/>
    <rect x="990" y="280" width="30" height="310" rx="5" fill="${METAL}"/></g>`,
  cpu: (a) => `<rect x="360" y="210" width="480" height="480" rx="22" fill="#1d5a36"/>
    ${grid(14, 14, 380, 230, 440, 440, 12, (c, r) => (c > 0 && c < 13 && r > 0 && r < 13 ? 'none' : '#d4af37'))}
    <rect x="430" y="280" width="340" height="340" rx="26" fill="${METAL}"/>
    <rect x="430" y="280" width="340" height="340" rx="26" fill="url(#shine)"/>
    <path d="M450 600 l40 0 l-40 -40z" fill="${a}"/>`,
  ram: (a) => [0, 1].map((i) => `<g transform="translate(0 ${i * 170 - 60}) rotate(-8 600 450)">
    <rect x="190" y="400" width="820" height="150" rx="10" fill="#1a6b3c"/>
    <rect x="200" y="350" width="800" height="150" rx="12" fill="${BODY}"/>
    <rect x="200" y="350" width="800" height="26" rx="10" fill="${a}"/>
    ${grid(30, 1, 210, 548, 780, 18, 8, () => '#d4af37')}</g>`).join(''),
  tower: (a) => `<rect x="400" y="150" width="400" height="640" rx="24" fill="${BODY}"/>
    <rect x="430" y="185" width="290" height="570" rx="14" fill="#0b0c0e" stroke="${EDGE}" stroke-width="4"/>
    ${fan(575, 300, 78, a)}${fan(575, 470, 78, a)}${fan(575, 640, 78, a)}
    <rect x="735" y="190" width="40" height="8" rx="4" fill="${a}"/>
    <rect x="420" y="790" width="70" height="18" rx="6" fill="${PANEL}"/><rect x="710" y="790" width="70" height="18" rx="6" fill="${PANEL}"/>`,
  laptop: (a) => `<path d="M320 230 h560 a20 20 0 0 1 20 20 v360 h-600 v-360 a20 20 0 0 1 20 -20z" fill="${BODY}"/>
    <rect x="330" y="250" width="540" height="345" rx="6" fill="url(#screen)"/>
    <path d="M220 610 h760 l-40 70 h-680z" fill="${PANEL}"/>
    <rect x="520" y="618" width="160" height="14" rx="7" fill="${EDGE}"/>
    <rect x="260" y="672" width="680" height="8" rx="4" fill="${a}"/>`,
  controller: (a) => `<path d="M380 330 h440 c90 0 150 80 170 200 c20 120 -20 190 -90 190 c-60 0 -90 -70 -130 -110 h-300 c-40 40 -70 110 -130 110 c-70 0 -110 -70 -90 -190 c20 -120 80 -200 170 -200z" fill="${BODY}"/>
    <circle cx="470" cy="470" r="52" fill="${PANEL}"/><circle cx="470" cy="470" r="30" fill="#0e1012"/>
    <circle cx="690" cy="560" r="52" fill="${PANEL}"/><circle cx="690" cy="560" r="30" fill="#0e1012"/>
    <rect x="330" y="420" width="30" height="96" rx="6" fill="${EDGE}" transform="translate(-10 0)"/><rect x="297" y="453" width="96" height="30" rx="6" fill="${EDGE}" transform="translate(-10 0)"/>
    <circle cx="860" cy="420" r="22" fill="${a}"/><circle cx="905" cy="465" r="22" fill="${a}" opacity="0.8"/><circle cx="815" cy="465" r="22" fill="${a}" opacity="0.8"/><circle cx="860" cy="510" r="22" fill="${a}" opacity="0.6"/>
    <rect x="540" y="380" width="120" height="16" rx="8" fill="${a}"/>`,
  handheld: (a) => `<rect x="170" y="300" width="860" height="330" rx="120" fill="${BODY}"/>
    <rect x="390" y="340" width="420" height="250" rx="14" fill="url(#screen)"/>
    <circle cx="280" cy="400" r="48" fill="${PANEL}"/><circle cx="920" cy="400" r="48" fill="${PANEL}"/>
    <rect x="255" y="500" width="22" height="70" rx="5" fill="${EDGE}"/><rect x="231" y="524" width="70" height="22" rx="5" fill="${EDGE}"/>
    <circle cx="900" cy="510" r="16" fill="${a}"/><circle cx="940" cy="545" r="16" fill="${a}"/><circle cx="860" cy="545" r="16" fill="${a}"/><circle cx="900" cy="580" r="16" fill="${a}"/>`,
  keyboard: (a) => `<g transform="rotate(-4 600 450)"><rect x="160" y="290" width="880" height="330" rx="26" fill="${BODY}"/>
    ${grid(15, 5, 190, 320, 820, 270, 10, (c, r) => (r === 0 && c === 0 ? a : (c + r * 3) % 11 === 0 ? a : PANEL))}
    <rect x="160" y="600" width="880" height="14" rx="7" fill="${a}" opacity="0.7"/></g>`,
  mouse: (a) => `<path d="M600 190 c130 0 190 110 190 260 c0 170 -70 280 -190 280 c-120 0 -190 -110 -190 -280 c0 -150 60 -260 190 -260z" fill="${BODY}"/>
    <path d="M600 190 v200" stroke="${EDGE}" stroke-width="6"/><rect x="585" y="250" width="30" height="80" rx="15" fill="${a}"/>
    <path d="M440 560 q160 70 320 0" stroke="${a}" stroke-width="10" fill="none" opacity="0.8"/>`,
  headset: (a) => `<path d="M360 560 v-120 a240 240 0 0 1 480 0 v120" stroke="${BODY}" stroke-width="56" fill="none" stroke-linecap="round"/>
    <rect x="300" y="470" width="150" height="230" rx="60" fill="${BODY}"/><rect x="750" y="470" width="150" height="230" rx="60" fill="${BODY}"/>
    <rect x="322" y="500" width="22" height="170" rx="11" fill="${a}"/><rect x="856" y="500" width="22" height="170" rx="11" fill="${a}"/>
    <path d="M330 640 q-40 90 60 120" stroke="${PANEL}" stroke-width="16" fill="none" stroke-linecap="round"/>`,
  monitor: () => `<rect x="190" y="170" width="820" height="480" rx="18" fill="${BODY}"/>
    <rect x="212" y="192" width="776" height="420" rx="6" fill="url(#screen)"/>
    <path d="M560 650 h80 l20 110 h-120z" fill="${PANEL}"/><rect x="420" y="755" width="360" height="26" rx="13" fill="${BODY}"/>`,
  chair: (a) => `<rect x="440" y="140" width="320" height="420" rx="90" fill="${BODY}"/>
    <rect x="490" y="200" width="220" height="300" rx="60" fill="${a}" opacity="0.9"/>
    <rect x="400" y="540" width="400" height="90" rx="40" fill="${BODY}"/>
    <rect x="585" y="630" width="30" height="110" fill="${PANEL}"/>
    <path d="M600 740 l-200 60 M600 740 l200 60 M600 740 l-120 90 M600 740 l120 90" stroke="${PANEL}" stroke-width="20" stroke-linecap="round"/>`,
  code: (a) => {
    const colours = [a, '#f0c674', '#81a2be', '#b5bd68', '#cc6666', '#c5c8c6'];
    const lines = Array.from({ length: 11 }, (_, i) => {
      const indent = [0, 1, 2, 2, 3, 2, 1, 1, 2, 1, 0][i]! * 40;
      const width = [300, 420, 260, 380, 220, 340, 180, 460, 300, 240, 120][i]!;
      return `<rect x="${280 + indent}" y="${300 + i * 40}" width="${width}" height="16" rx="8" fill="${colours[i % colours.length]}" opacity="0.9"/>`;
    }).join('');
    return `<rect x="200" y="190" width="800" height="560" rx="22" fill="${BODY}"/><rect x="200" y="190" width="800" height="64" rx="22" fill="${PANEL}"/>
      <rect x="200" y="230" width="800" height="24" fill="${PANEL}"/>
      <circle cx="245" cy="222" r="11" fill="#ff5f57"/><circle cx="282" cy="222" r="11" fill="#febc2e"/><circle cx="319" cy="222" r="11" fill="#28c840"/>
      ${grid(1, 11, 236, 300, 24, 416, 24, () => EDGE)}${lines}`;
  },
  building: (a) => `<path d="M260 700 v-330 l180 -90 l180 90 v330z" fill="${BODY}"/><path d="M620 700 v-420 l170 -80 l170 80 v420z" fill="${PANEL}"/>
    ${grid(3, 5, 300, 400, 280, 260, 22, (c, r) => ((c + r) % 3 === 0 ? a : '#0d0f11'))}
    ${grid(3, 7, 660, 310, 260, 360, 18, (c, r) => ((c * 2 + r) % 4 === 0 ? a : '#14171a'))}
    <rect x="200" y="700" width="800" height="22" rx="11" fill="${BODY}"/>`,
  car: (a) => `<path d="M170 560 c0 -40 30 -70 80 -80 l150 -30 c60 -70 130 -110 230 -110 h120 c90 0 150 50 210 110 l80 20 c40 10 60 40 60 80 v40 h-930z" fill="${BODY}"/>
    <path d="M430 450 c50 -50 100 -80 180 -80 h60 v80z" fill="url(#screen)"/><path d="M700 370 h50 c60 0 100 30 140 80 h-190z" fill="url(#screen)"/>
    <circle cx="350" cy="610" r="78" fill="#0d0f11"/><circle cx="350" cy="610" r="40" fill="${METAL}"/>
    <circle cx="860" cy="610" r="78" fill="#0d0f11"/><circle cx="860" cy="610" r="40" fill="${METAL}"/>
    <rect x="180" y="540" width="920" height="10" fill="${a}"/>`,
  shirt: (a) => `<path d="M470 190 c40 50 220 50 260 0 l200 90 l-60 160 l-80 -40 v400 h-380 v-400 l-80 40 l-60 -160z" fill="${BODY}"/>
    <path d="M470 190 c40 50 220 50 260 0" stroke="${a}" stroke-width="16" fill="none"/>
    <rect x="510" y="420" width="180" height="120" rx="14" fill="${a}" opacity="0.85"/>`,
  hud: (a) => `<circle cx="760" cy="480" r="220" fill="${BODY}" opacity="0.92"/>
    <path d="M590 600 a200 200 0 1 1 340 0" stroke="${EDGE}" stroke-width="26" fill="none" stroke-linecap="round"/>
    <path d="M590 600 a200 200 0 0 1 250 -300" stroke="${a}" stroke-width="26" fill="none" stroke-linecap="round"/>
    <rect x="700" y="460" width="120" height="60" rx="10" fill="${PANEL}"/>
    <rect x="180" y="560" width="300" height="26" rx="13" fill="${BODY}"/><rect x="180" y="560" width="230" height="26" rx="13" fill="#e5372c"/>
    <rect x="180" y="610" width="300" height="26" rx="13" fill="${BODY}"/><rect x="180" y="610" width="170" height="26" rx="13" fill="${a}"/>
    <rect x="180" y="660" width="300" height="26" rx="13" fill="${BODY}"/><rect x="180" y="660" width="260" height="26" rx="13" fill="#ffb400"/>`,
  server: (a) => `<rect x="380" y="150" width="440" height="620" rx="20" fill="${BODY}"/>
    ${Array.from({ length: 6 }, (_, i) => `<rect x="410" y="${180 + i * 95}" width="380" height="76" rx="10" fill="${PANEL}"/><circle cx="450" cy="${218 + i * 95}" r="10" fill="${i % 2 ? a : '#01d387'}"/><rect x="480" y="${210 + i * 95}" width="180" height="14" rx="7" fill="${EDGE}"/>`).join('')}`,
  cube: () => `<path d="M600 200 l300 160 l-300 160 l-300 -160z" fill="#5bb846"/><path d="M300 360 l300 160 v330 l-300 -160z" fill="#8a5a33"/>
    <path d="M900 360 l-300 160 v330 l300 -160z" fill="#6e4526"/><path d="M300 360 l300 160 v60 l-300 -160z" fill="#4c9a3a"/><path d="M900 360 l-300 160 v60 l300 -160z" fill="#3f8231"/>`,
  disc: (a) => `<circle cx="760" cy="450" r="230" fill="#d7dce2"/><circle cx="760" cy="450" r="230" fill="url(#shine)"/><circle cx="760" cy="450" r="50" fill="#9aa1a9"/><circle cx="760" cy="450" r="20" fill="#5c636b"/>
    <rect x="270" y="160" width="400" height="580" rx="18" fill="${BODY}"/><rect x="270" y="160" width="400" height="90" rx="18" fill="${a}"/><rect x="270" y="220" width="400" height="30" fill="${a}"/>
    <rect x="310" y="300" width="320" height="380" rx="10" fill="url(#screen)"/>`,
  person: (a) => `<circle cx="600" cy="280" r="100" fill="${BODY}"/><path d="M380 800 c0 -200 90 -330 220 -330 s220 130 220 330z" fill="${BODY}"/>
    <path d="M520 520 l80 90 l80 -90" stroke="${a}" stroke-width="24" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  wrench: (a) => `<path d="M700 220 a150 150 0 0 0 -170 200 l-260 260 a50 50 0 0 0 70 70 l260 -260 a150 150 0 0 0 200 -170 l-90 90 l-80 -20 l-20 -80z" fill="${BODY}"/>
    <path d="M820 560 l-70 70 l70 70 M940 560 l70 70 l-70 70" stroke="${a}" stroke-width="30" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
};

/** `variant` nudges the backdrop so a listing's photos aren't identical. */
export function listingArt(kind: ArtKind, palette: readonly [string, string, string], variant = 0): string {
  const [from, to, accent] = palette;
  const angle = [135, 160, 110][variant % 3] ?? 135;
  const zoom = [1, 0.86, 1.08][variant % 3] ?? 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" gradientTransform="rotate(${angle - 90} 0.5 0.5)"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>
    <linearGradient id="screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="#101216"/></linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.5"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.2"/></linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    <pattern id="dots" width="36" height="36" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="2" fill="#ffffff" fill-opacity="0.08"/></pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <ellipse cx="600" cy="790" rx="420" ry="44" fill="#000000" fill-opacity="0.28"/>
  <g transform="translate(600 450) scale(${zoom}) translate(-600 -450)">${OBJECTS[kind](accent)}</g>
</svg>`;
}
