import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const iconSvg = fs.readFileSync(path.join(publicDir, 'icon.svg'));

const maskableSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#059669" />
  <g transform="translate(64, 64) scale(0.75)">
    <path d="M128 96 C128 84 138 74 150 74 L362 74 C374 74 384 84 384 96 L384 416 L352 396 L320 416 L288 396 L256 416 L224 396 L192 416 L160 396 L128 416 Z" fill="#FFFFFF" />
    <rect x="108" y="210" width="296" height="8" rx="4" fill="#10B981" />
    <circle cx="108" cy="214" r="7" fill="#34D399" />
    <circle cx="404" cy="214" r="7" fill="#34D399" />
    <rect x="164" y="130" width="100" height="14" rx="7" fill="#0F172A" />
    <rect x="164" y="160" width="184" height="8" rx="4" fill="#94A3B8" />
    <rect x="164" y="180" width="140" height="8" rx="4" fill="#CBD5E1" />
    <rect x="164" y="250" width="120" height="10" rx="5" fill="#334155" />
    <rect x="314" y="250" width="34" height="10" rx="5" fill="#059669" />
    <rect x="164" y="276" width="100" height="10" rx="5" fill="#334155" />
    <rect x="314" y="276" width="34" height="10" rx="5" fill="#059669" />
    <line x1="164" y1="334" x2="348" y2="334" stroke="#E2E8F0" stroke-width="3" stroke-dasharray="6 4" />
    <rect x="164" y="352" width="60" height="12" rx="6" fill="#0F172A" />
    <rect x="284" y="348" width="64" height="18" rx="6" fill="#059669" />
  </g>
</svg>`;

const desktopScreenshotSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 800" width="1280" height="800">
  <rect width="1280" height="800" fill="#F8FAFC" />
  <rect width="1280" height="64" fill="#FFFFFF" />
  <line x1="0" y1="64" x2="1280" y2="64" stroke="#E2E8F0" stroke-width="1" />
  <rect x="32" y="16" width="32" height="32" rx="8" fill="#059669" />
  <text x="76" y="38" font-family="sans-serif" font-size="20" font-weight="900" fill="#0F172A">ParserPro</text>
  
  <g transform="translate(64, 96)">
    <rect x="0" y="0" width="550" height="640" rx="16" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1" />
    <text x="32" y="48" font-family="sans-serif" font-size="18" font-weight="700" fill="#0F172A">Receipt Scanner and AI OCR</text>
    <rect x="32" y="80" width="486" height="320" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="6 6" />
    <text x="275" y="240" font-family="sans-serif" font-size="16" font-weight="600" fill="#64748B" text-anchor="middle">Drag and Drop or Upload Receipt</text>
    
    <rect x="580" y="0" width="570" height="640" rx="16" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1" />
    <text x="612" y="48" font-family="sans-serif" font-size="18" font-weight="700" fill="#0F172A">Monthly Categorized Filing</text>
    <rect x="612" y="80" width="506" height="60" rx="8" fill="#ECFDF5" />
    <text x="632" y="116" font-family="sans-serif" font-size="14" font-weight="700" fill="#065F46">Woolworths Supermarket - R 1,248.50</text>
    <rect x="612" y="152" width="506" height="60" rx="8" fill="#F8FAFC" stroke="#E2E8F0" />
    <text x="632" y="188" font-family="sans-serif" font-size="14" font-weight="600" fill="#334155">City Power Prepaid - R 850.00</text>
  </g>
</svg>`;

const mobileScreenshotSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 1334" width="750" height="1334">
  <rect width="750" height="1334" fill="#F8FAFC" />
  <rect width="750" height="100" fill="#FFFFFF" />
  <rect x="32" y="24" width="52" height="52" rx="12" fill="#059669" />
  <text x="100" y="58" font-family="sans-serif" font-size="28" font-weight="900" fill="#0F172A">ParserPro</text>
  
  <g transform="translate(32, 130)">
    <rect x="0" y="0" width="686" height="500" rx="20" fill="#FFFFFF" stroke="#E2E8F0" />
    <text x="32" y="54" font-family="sans-serif" font-size="24" font-weight="800" fill="#0F172A">AI Receipt Scanner</text>
    <rect x="32" y="90" width="622" height="340" rx="16" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="8 8" />
    <text x="343" y="270" font-family="sans-serif" font-size="22" font-weight="600" fill="#64748B" text-anchor="middle">Tap to Snap Photo with Camera</text>
    
    <rect x="0" y="540" width="686" height="600" rx="20" fill="#FFFFFF" stroke="#E2E8F0" />
    <text x="32" y="594" font-family="sans-serif" font-size="24" font-weight="800" fill="#0F172A">August 2026 Summary</text>
    <rect x="32" y="630" width="622" height="100" rx="14" fill="#ECFDF5" />
    <text x="56" y="690" font-family="sans-serif" font-size="26" font-weight="900" fill="#059669">Total: R 7,854.20</text>
  </g>
</svg>`;

async function generate() {
  console.log('Generating PNG icons and screenshots for PWA Builder...');
  
  await sharp(iconSvg)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log('Generated icon-192.png');

  await sharp(iconSvg)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('Generated icon-512.png');

  await sharp(Buffer.from(maskableSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-maskable-512.png'));
  console.log('Generated icon-maskable-512.png');

  await sharp(Buffer.from(desktopScreenshotSvg))
    .resize(1280, 800)
    .png()
    .toFile(path.join(publicDir, 'screenshot-desktop.png'));
  console.log('Generated screenshot-desktop.png');

  await sharp(Buffer.from(mobileScreenshotSvg))
    .resize(750, 1334)
    .png()
    .toFile(path.join(publicDir, 'screenshot-mobile.png'));
  console.log('Generated screenshot-mobile.png');

  console.log('All PWA assets successfully created!');
}

generate().catch(console.error);
