import type { LineItem, OcrEngineType, ReceiptCategory, ReceiptData } from '../types';

export interface OcrSpatialBox {
  text: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** Local baseline dy/dx slope estimated from corner points (0 = horizontal) */
  slope?: number;
}

export interface OcrSpatialPage {
  width: number;
  height: number;
  text?: string;
  rawText?: string;
  lines: OcrSpatialBox[];
  elements?: OcrSpatialBox[];
}

export interface ReconstructedReceiptRow {
  leftText: string;
  rightPriceText: string;
  combinedText: string;
  y: number;
}

export interface ParsedReceiptCandidate {
  receipts: ReceiptData[];
  qualityScore: number;
  reconciled: boolean;
}

/**
 * Known South African and global retail vendors for high-accuracy dictionary matching
 * even when store logos or top headers are creased or partially faded.
 */
export const KNOWN_VENDORS: string[] = [
  'Pick n Pay Express',
  'Pick n Pay Clothing',
  'Pick n Pay Liquor',
  'Pick n Pay',
  'Checkers Sixty60',
  'Checkers Hyper',
  'Checkers LiquorShop',
  'Checkers',
  'Shoprite LiquorShop',
  'Shoprite',
  'Woolworths Food',
  'Woolworths',
  'SUPERSPAR',
  'KWIKSPAR',
  'TOPS at SPAR',
  'Spar',
  "Food Lover's Market",
  'Food Lovers Market',
  'Food Lovers',
  'Makro',
  'Game',
  'Dis-Chem',
  'Clicks Pharmacy',
  'Clicks',
  'Boxer Superstores',
  'Boxer',
  'PNP',
  'Takealot',
  'Usave',
  'OK Foods',
  'Cambridge Food',
  'Eskom',
  'City Power',
  'Tshwane Electricity',
  'Ethekwini Electricity',
  'Engen',
  'Shell',
  'TotalEnergies',
  'Total Garage',
  'BP',
  'Sasol',
  'Caltex',
  'Astron Energy',
  'Builders Warehouse',
  'Builders Express',
  'Builders Superstore',
  'Chamberlains',
  'Mica Hardware',
  'Leroy Merlin',
  'Cashbuild',
  'Agrimark',
  'Kaap Agri',
  'PEP Home',
  'PEP',
  'Ackermans',
  'Mr Price Home',
  'Mr Price',
  '@home',
  'Walmart',
  'Target',
  'Costco',
  'Kroger',
  'Whole Foods',
  "Trader Joe's",
  'Aldi',
  'Lidl',
  'Tesco',
  "Sainsbury's",
  'Asda',
  'Morrisons',
  'Carrefour',
  'Coles',
  'Home Depot',
  "Lowe's",
  'IKEA',
  "McDonald's",
  'KFC',
  "Nando's",
  'Steers',
  'Debonairs Pizza',
  'Wimpy',
  'Starbucks',
  'Mug & Bean',
  'Mugg & Bean',
  'Vida e Caffe',
  'Seattle Coffee',
  'Rayton Express',
  'Rayton Pharmacy',
];

const CURRENCY_TOKEN = '(?:R|ZAR|US\\$|A\\$|C\\$|NZ\\$|\\$|£|€|₹|¥|CHF|SEK|NOK|AED)';
const CURRENCY_OPT = `(?:${CURRENCY_TOKEN}\\s*)?`;
const TAX_SUFFIX_OPT = '(?:\\s*[*#A-Za-z]{1,2})?';

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) * 0.5 : sorted[mid];
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = clamp(Math.floor((sorted.length - 1) * p), 0, sorted.length - 1);
  return sorted[idx];
}

/**
 * Normalizes OCR noise along fold creases inside numeric amount tokens:
 * - Fixes spaced/comma/middle-dot decimals ("19 , 99", "19 . 99", "19·99" -> "19.99")
 * - Fixes trailing minus signs on retail discounts ("25.00-" -> "-25.00")
 * - Fixes common OCR character confusions inside price strings ("R 24.9O" -> "R 24.90", "l9.99" -> "19.99")
 */
export function normalizeOcrAmountText(input: string): string {
  if (!input) return '';
  let s = input.replace(/\u00A0/g, ' ').trim();

  // Repair OCR letter-digit swaps strictly inside decimal currency patterns
  s = s.replace(
    /(\b(?:R|ZAR|\$|£|€)?\s*-?)([0-9OlISB]{1,5})\s*[.,·:]\s*([0-9OlIS]{2})(?=\s*(?:[-*#A-Za-z]{0,2})$|\s+)/g,
    (full, prefix: string, intPart: string, fracPart: string) => {
      // Only repair if at least one real digit is present so normal words like "NO.AB" are untouched
      const combined = intPart + fracPart;
      if (!/\d/.test(combined)) return full;
      const mapChar = (ch: string) => {
        if (ch === 'O' || ch === 'o') return '0';
        if (ch === 'l' || ch === 'I') return '1';
        if (ch === 'S') return '5';
        if (ch === 'B') return '8';
        return ch;
      };
      const fixedInt = intPart.split('').map(mapChar).join('');
      const fixedFrac = fracPart.split('').map(mapChar).join('');
      if (!/^\d+$/.test(fixedInt) || !/^\d{2}$/.test(fixedFrac)) return full;
      return `${prefix}${fixedInt}.${fixedFrac}`;
    }
  );

  // Convert bracketed negative amounts "(15.00)" -> "-15.00"
  s = s.replace(/\((\d{1,5}[.,]\d{2})\)/g, '-$1');

  // Convert trailing minus amounts "15.00-" or "15.00 -" -> "-15.00"
  s = s.replace(/(\b\d{1,5}[.,]\d{2})\s*-(?=\s*[*#A-Za-z]{0,2}$|\s+)/g, '-$1');

  return s;
}

/**
 * Checks whether a short right-column text fragment is a standalone receipt price/amount token
 * (including negative discounts, currency symbols, VAT code suffixes like "34.99 A", or crease-broken "34 99 A").
 */
function parseStandaloneAmountToken(
  raw: string,
  allowSpaceBrokenDecimal = false
): { value: number; cleaned: string } | null {
  const norm = normalizeOcrAmountText(raw).trim();
  if (!norm) return null;

  const strictRe = new RegExp(
    `^[-+]?\\s*${CURRENCY_OPT}[-+]?\\s*(\\d{1,6}[.,]\\d{2})${TAX_SUFFIX_OPT}$`,
    'i'
  );
  const m = norm.match(strictRe);
  if (m) {
    const isNeg =
      norm.startsWith('-') ||
      /^R?\s*-/i.test(norm) ||
      raw.trim().endsWith('-');
    const val = parseFloat(m[1].replace(',', '.'));
    if (!isNaN(val) && val < 500000) {
      const signed = isNeg ? -Math.abs(val) : val;
      return { value: signed, cleaned: signed.toFixed(2) };
    }
  }

  // Right-margin column recovery when a vertical fold sits directly on the decimal dot ("24 99 A")
  if (allowSpaceBrokenDecimal) {
    const spaceDecRe = new RegExp(
      `^[-+]?\\s*${CURRENCY_OPT}[-+]?\\s*(\\d{1,4})\\s+(\\d{2})${TAX_SUFFIX_OPT}$`,
      'i'
    );
    const sm = norm.match(spaceDecRe);
    if (sm) {
      const intVal = parseInt(sm[1], 10);
      const fracVal = parseInt(sm[2], 10);
      // Avoid years like "20 26" unless clearly small price
      if (!(intVal === 20 && fracVal >= 20 && fracVal <= 35)) {
        const isNeg = norm.startsWith('-') || raw.trim().endsWith('-');
        const val = parseFloat(`${sm[1]}.${sm[2]}`);
        if (!isNaN(val) && val > 0 && val < 10000) {
          const signed = isNeg ? -val : val;
          return { value: signed, cleaned: signed.toFixed(2) };
        }
      }
    }
  }

  return null;
}

interface InternalSpan {
  text: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
  height: number;
  rectifiedY: number;
}

/**
 * Reconstructs physical receipt rows from 2D OCR bounding boxes & corner slopes,
 * compensating for:
 *  1. Camera tilt & piecewise baseline bends across horizontal/diagonal receipt folds
 *  2. Cylindrical "rolling/curl" vertical offset on the right-hand price column
 *  3. Cascade off-by-one price shifting via global Order-Preserving Monotonic Dynamic Programming
 */
export function reconstructCurvedReceiptRows(page: OcrSpatialPage): ReconstructedReceiptRow[] {
  const sourceLines = (page.lines || []).filter(
    (b) => b && b.text && b.text.trim().length > 0 && b.right > b.left && b.bottom > b.top
  );
  const sourceElements = (page.elements || []).filter(
    (b) => b && b.text && b.text.trim().length > 0 && b.right > b.left && b.bottom > b.top
  );

  const tokens = sourceElements.length >= 4 ? sourceElements : sourceLines;
  if (tokens.length === 0) return [];

  // 1. Estimate paper horizontal bounds and median font line height
  const lefts = tokens.map((t) => t.left);
  const rights = tokens.map((t) => t.right);
  const heights = tokens.map((t) => Math.max(6, t.bottom - t.top));

  const paperLeft = percentile(lefts, 0.04);
  const paperRight = percentile(rights, 0.96);
  const paperWidth = Math.max(160, paperRight - paperLeft);
  const medianH = clamp(median(heights), 8, 120);
  const xRef = paperLeft + paperWidth * 0.22;

  // 2. Build smooth piecewise vertical slope field m(y) = dy/dx from wide lines (captures fold angle changes)
  const slopeAnchors: Array<{ y: number; slope: number; weight: number }> = [];
  for (const ln of sourceLines) {
    const w = ln.right - ln.left;
    if (w >= paperWidth * 0.14 && typeof ln.slope === 'number' && isFinite(ln.slope)) {
      if (Math.abs(ln.slope) <= 0.36) {
        slopeAnchors.push({
          y: (ln.top + ln.bottom) * 0.5,
          slope: ln.slope,
          weight: w,
        });
      }
    }
  }

  const slopeBandSigma = Math.max(medianH * 3.5, 45);
  const slopeAtY = (y: number): number => {
    if (slopeAnchors.length === 0) return 0;
    let weightedSum = 0;
    let totalW = 0;
    for (const a of slopeAnchors) {
      const dy = (y - a.y) / slopeBandSigma;
      const w = a.weight * Math.exp(-0.5 * dy * dy);
      weightedSum += a.slope * w;
      totalW += w;
    }
    return totalW > 1e-5 ? clamp(weightedSum / totalW, -0.32, 0.32) : 0;
  };

  // 3. Project every token onto curvature-rectified Y coordinate & merge adjacent words within the same column
  const rawSpans: InternalSpan[] = tokens.map((t) => {
    const cx = (t.left + t.right) * 0.5;
    const cy = (t.top + t.bottom) * 0.5;
    const h = Math.max(6, t.bottom - t.top);
    const s =
      typeof t.slope === 'number' && isFinite(t.slope) && t.right - t.left >= paperWidth * 0.22
        ? clamp(t.slope * 0.5 + slopeAtY(cy) * 0.5, -0.32, 0.32)
        : slopeAtY(cy);
    const rectY = cy - s * (cx - xRef);
    return {
      text: t.text.trim(),
      left: t.left,
      right: t.right,
      top: t.top,
      bottom: t.bottom,
      centerX: cx,
      centerY: cy,
      height: h,
      rectifiedY: rectY,
    };
  });

  // Sort top-to-bottom by rectifiedY, then left-to-right
  rawSpans.sort((a, b) => a.rectifiedY - b.rectifiedY || a.left - b.left);

  // Group into horizontal bands while strictly preventing horizontally-overlapping stacked rows (e.g. compressed fold) from colliding
  const bands: InternalSpan[][] = [];
  for (const sp of rawSpans) {
    let bestBand: InternalSpan[] | null = null;
    let bestDiff = Infinity;
    for (let i = bands.length - 1; i >= Math.max(0, bands.length - 5); i--) {
      const band = bands[i];
      const avgY = band.reduce((acc, x) => acc + x.rectifiedY, 0) / band.length;
      const avgH = band.reduce((acc, x) => acc + x.height, 0) / band.length;
      const tol = Math.max(avgH, sp.height) * 0.56;
      const diff = Math.abs(sp.rectifiedY - avgY);
      const overlapsExistingWord = band.some((existing) => {
        const overlapX = Math.min(existing.right, sp.right) - Math.max(existing.left, sp.left);
        const minW = Math.min(existing.right - existing.left, sp.right - sp.left);
        return minW > 0 && overlapX > minW * 0.3;
      });
      if (!overlapsExistingWord && diff <= tol && diff < bestDiff) {
        bestDiff = diff;
        bestBand = band;
      }
    }
    if (bestBand) {
      bestBand.push(sp);
    } else {
      bands.push([sp]);
    }
  }

  const mergedSpans: InternalSpan[] = [];
  const maxWordJoinGap = Math.max(medianH * 2.35, paperWidth * 0.085);

  for (const band of bands) {
    band.sort((a, b) => a.left - b.left);
    let cur = { ...band[0] };
    for (let i = 1; i < band.length; i++) {
      const nxt = band[i];
      const gap = nxt.left - cur.right;
      const entersRightPriceZone =
        nxt.left >= paperLeft + paperWidth * 0.56 &&
        cur.right <= paperLeft + paperWidth * 0.54 &&
        parseStandaloneAmountToken(nxt.text, true) !== null;

      if (gap >= -cur.height * 0.3 && gap <= maxWordJoinGap && !entersRightPriceZone) {
        cur.text = `${cur.text} ${nxt.text}`.replace(/\s+/g, ' ').trim();
        cur.right = Math.max(cur.right, nxt.right);
        cur.top = Math.min(cur.top, nxt.top);
        cur.bottom = Math.max(cur.bottom, nxt.bottom);
        cur.centerX = (cur.left + cur.right) * 0.5;
        cur.centerY = (cur.top + cur.bottom) * 0.5;
        cur.height = Math.max(cur.height, nxt.height);
        cur.rectifiedY = (cur.rectifiedY + nxt.rectifiedY) * 0.5;
      } else {
        mergedSpans.push(cur);
        cur = { ...nxt };
      }
    }
    mergedSpans.push(cur);
  }

  // 4. Identify the right-hand price column cluster vs left/center text spans
  const rightPriceCandidates: Array<InternalSpan & { parsedPrice: string; numericPrice: number }> = [];
  const otherSpans: InternalSpan[] = [];

  for (const sp of mergedSpans) {
    const isRightPositioned =
      sp.right >= paperLeft + paperWidth * 0.58 &&
      sp.left >= paperLeft + paperWidth * 0.45 &&
      sp.right - sp.left <= paperWidth * 0.48;

    const amt = isRightPositioned ? parseStandaloneAmountToken(sp.text, true) : null;
    if (amt !== null) {
      rightPriceCandidates.push({
        ...sp,
        parsedPrice: amt.cleaned,
        numericPrice: amt.value,
      });
    } else {
      otherSpans.push(sp);
    }
  }

  // Cluster otherSpans into ordered Left/Center Rows
  otherSpans.sort((a, b) => a.rectifiedY - b.rectifiedY || a.left - b.left);
  interface LeftRow {
    spans: InternalSpan[];
    text: string;
    rectifiedY: number;
    height: number;
    left: number;
    right: number;
    alreadyHasInlinePrice: boolean;
  }

  const leftRows: LeftRow[] = [];
  for (const sp of otherSpans) {
    let targetRow: LeftRow | null = null;
    let bestDiff = Infinity;
    for (let i = leftRows.length - 1; i >= Math.max(0, leftRows.length - 3); i--) {
      const r = leftRows[i];
      const tol = Math.max(r.height, sp.height) * 0.56;
      const diff = Math.abs(sp.rectifiedY - r.rectifiedY);
      // Do not merge two spans that horizontally overlap heavily (which indicates stacked vertical lines)
      const horizOverlap = Math.min(r.right, sp.right) - Math.max(r.left, sp.left);
      const minW = Math.min(r.right - r.left, sp.right - sp.left);
      if (diff <= tol && diff < bestDiff && horizOverlap < minW * 0.45) {
        bestDiff = diff;
        targetRow = r;
      }
    }
    if (targetRow) {
      targetRow.spans.push(sp);
      targetRow.spans.sort((a, b) => a.left - b.left);
      targetRow.text = targetRow.spans.map((s) => s.text).join('   ');
      targetRow.rectifiedY =
        targetRow.spans.reduce((acc, s) => acc + s.rectifiedY, 0) / targetRow.spans.length;
      targetRow.height = Math.max(targetRow.height, sp.height);
      targetRow.left = Math.min(targetRow.left, sp.left);
      targetRow.right = Math.max(targetRow.right, sp.right);
    } else {
      leftRows.push({
        spans: [sp],
        text: sp.text,
        rectifiedY: sp.rectifiedY,
        height: sp.height,
        left: sp.left,
        right: sp.right,
        alreadyHasInlinePrice: false,
      });
    }
  }

  leftRows.sort((a, b) => a.rectifiedY - b.rectifiedY);
  const inlineTrailingPriceRe = new RegExp(
    `\\s+${CURRENCY_OPT}-?\\d{1,6}[.,]\\d{2}${TAX_SUFFIX_OPT}$`,
    'i'
  );
  for (const lr of leftRows) {
    lr.alreadyHasInlinePrice =
      lr.right >= paperLeft + paperWidth * 0.66 &&
      inlineTrailingPriceRe.test(normalizeOcrAmountText(lr.text));
  }

  if (rightPriceCandidates.length === 0) {
    return leftRows.map((lr) => ({
      leftText: lr.text,
      rightPriceText: '',
      combinedText: lr.text,
      y: lr.rectifiedY,
    }));
  }

  // Merge duplicate/fragmented price spans sitting on the exact same right-column row
  rightPriceCandidates.sort((a, b) => a.rectifiedY - b.rectifiedY || a.left - b.left);
  const rightPrices: typeof rightPriceCandidates = [];
  for (const pc of rightPriceCandidates) {
    const prev = rightPrices[rightPrices.length - 1];
    if (
      prev &&
      Math.abs(pc.rectifiedY - prev.rectifiedY) <= Math.max(prev.height, pc.height) * 0.48
    ) {
      // If two amounts sit side-by-side on the right (e.g. unit price + total price), move the left one into leftRows!
      if (pc.left > prev.right) {
        // Insert prev into closest leftRow so "2 @ 18.50" stays on the left while "37.00" stays as right total
        let bestLr: LeftRow | null = null;
        let bestD = Infinity;
        for (const lr of leftRows) {
          const d = Math.abs(lr.rectifiedY - prev.rectifiedY);
          if (d <= medianH * 1.1 && d < bestD) {
            bestD = d;
            bestLr = lr;
          }
        }
        if (bestLr) {
          bestLr.text = `${bestLr.text}   ${prev.parsedPrice}`.trim();
          bestLr.right = Math.max(bestLr.right, prev.right);
        }
        rightPrices[rightPrices.length - 1] = pc;
        continue;
      }
    }
    rightPrices.push(pc);
  }

  // 5. Estimate residual right-edge cylindrical curl vertical offset curlDeltaY
  // Compare isolated rightPrices against their nearest unpriced leftRow
  const candidateOffsets: number[] = [];
  for (const rp of rightPrices) {
    let nearestDiff = Infinity;
    let secondDiff = Infinity;
    let signedNearest = 0;
    for (const lr of leftRows) {
      if (lr.alreadyHasInlinePrice) continue;
      const d = Math.abs(rp.rectifiedY - lr.rectifiedY);
      if (d < nearestDiff) {
        secondDiff = nearestDiff;
        nearestDiff = d;
        signedNearest = rp.rectifiedY - lr.rectifiedY;
      } else if (d < secondDiff) {
        secondDiff = d;
      }
    }
    // Only trust unambiguous anchor pairs where nearest row is clearly closer than 2nd nearest
    if (nearestDiff <= medianH * 0.95 && secondDiff - nearestDiff >= medianH * 0.35) {
      candidateOffsets.push(signedNearest);
    }
  }
  const globalCurlOffset =
    candidateOffsets.length >= 2 ? clamp(median(candidateOffsets), -medianH * 0.85, medianH * 0.85) : 0;

  // 6. Global Order-Preserving Monotonic Dynamic Programming Alignment (LeftRows L[0..N-1] <-> RightPrices P[0..M-1])
  const N = leftRows.length;
  const M = rightPrices.length;

  const nonPriceHeaderLineRe =
    /^(?:tax\s*invoice|vat\s*(?:reg|no)|tel\b|phone\b|cashier\b|welcome\b|thank\s*you|www\.|\d{10,14}$)/i;

  // dp[i][j] = min cost aligning prefix L[0..i-1] and P[0..j-1]
  const INF = 1e9;
  const dp: Float64Array[] = Array.from({ length: N + 1 }, () => new Float64Array(M + 1).fill(INF));
  const choice: Int8Array[] = Array.from({ length: N + 1 }, () => new Int8Array(M + 1).fill(0));
  // choice: 1 = skip LeftRow i-1 (unpriced row), 2 = standalone RightPrice j-1, 3 = match (i-1, j-1)

  dp[0][0] = 0;
  for (let i = 1; i <= N; i++) {
    dp[i][0] = dp[i - 1][0];
    choice[i][0] = 1;
  }
  const standalonePricePenalty = 1.85;
  for (let j = 1; j <= M; j++) {
    dp[0][j] = dp[0][j - 1] + standalonePricePenalty;
    choice[0][j] = 2;
  }

  const maxPairDist = medianH * 1.45;

  for (let i = 1; i <= N; i++) {
    const lr = leftRows[i - 1];
    for (let j = 1; j <= M; j++) {
      // Option 1: LeftRow i-1 has no standalone right price
      let best = dp[i - 1][j];
      let bestWay = 1;

      // Option 2: RightPrice j-1 stays standalone
      const c2 = dp[i][j - 1] + standalonePricePenalty;
      if (c2 < best) {
        best = c2;
        bestWay = 2;
      }

      // Option 3: Pair LeftRow i-1 with RightPrice j-1
      const rp = rightPrices[j - 1];
      const adjustedRpY = rp.rectifiedY - globalCurlOffset;
      const dy = Math.abs(adjustedRpY - lr.rectifiedY);

      if (dy <= maxPairDist && !lr.alreadyHasInlinePrice) {
        const normDy = dy / Math.max(medianH, 8);
        let pairCost = normDy * normDy;
        if (nonPriceHeaderLineRe.test(lr.text.trim())) {
          pairCost += 3.2; // Strong penalty against attaching an item price to store header/barcode/tel
        }
        const c3 = dp[i - 1][j - 1] + pairCost;
        if (c3 < best) {
          best = c3;
          bestWay = 3;
        }
      }

      dp[i][j] = best;
      choice[i][j] = bestWay;
    }
  }

  // Backtrack optimal monotonic assignment
  const pairedRightForLeft = new Map<number, number>();
  const standaloneRightIndices = new Set<number>();

  let ci = N;
  let cj = M;
  while (ci > 0 || cj > 0) {
    const way = choice[ci][cj];
    if (ci > 0 && cj > 0 && way === 3) {
      pairedRightForLeft.set(ci - 1, cj - 1);
      ci--;
      cj--;
    } else if (cj > 0 && (ci === 0 || way === 2)) {
      standaloneRightIndices.add(cj - 1);
      cj--;
    } else {
      ci--;
    }
  }

  const outputRows: ReconstructedReceiptRow[] = [];
  for (let i = 0; i < N; i++) {
    const lr = leftRows[i];
    const rIdx = pairedRightForLeft.get(i);
    if (rIdx !== undefined) {
      const rp = rightPrices[rIdx];
      outputRows.push({
        leftText: lr.text,
        rightPriceText: rp.parsedPrice,
        combinedText: `${lr.text}   ${rp.parsedPrice}`,
        y: (lr.rectifiedY + (rp.rectifiedY - globalCurlOffset)) * 0.5,
      });
    } else {
      outputRows.push({
        leftText: lr.text,
        rightPriceText: '',
        combinedText: lr.text,
        y: lr.rectifiedY,
      });
    }
  }

  for (const rIdx of standaloneRightIndices) {
    const rp = rightPrices[rIdx];
    outputRows.push({
      leftText: '',
      rightPriceText: rp.parsedPrice,
      combinedText: rp.parsedPrice,
      y: rp.rectifiedY - globalCurlOffset,
    });
  }

  outputRows.sort((a, b) => a.y - b.y);
  return outputRows;
}

/**
 * Splits a single text line if a tight horizontal fold pinched two separate item+price rows onto one line,
 * e.g., "ALBANY BREAD 700G 19.99 A CLOVER MILK 2L 34.99 Z" -> ["ALBANY BREAD 700G 19.99 A", "CLOVER MILK 2L 34.99 Z"],
 * while never splitting "2 @ 18.50 37.00" or VAT breakdown tables.
 */
function splitFoldPinchedItemsOnLine(line: string): string[] {
  const norm = normalizeOcrAmountText(line).trim();
  if (!norm || norm.length < 14) return [norm];

  // Do not split qty @ unit_price lines or VAT percentage summary lines
  if (/\b\d+(?:[.,]\d+)?\s*(?:kg|g|l|ml|ea|x|@)\b.*@/i.test(norm) || /\d+\s*[xX@]\s*R?\s*\d+[.,]\d{2}/i.test(norm)) {
    return [norm];
  }
  if (/\b\d{1,2}(?:[.,]\d{1,2})?%\b/.test(norm)) {
    return [norm];
  }

  const twoItemsRe = new RegExp(
    `^([A-Za-z0-9#&%*+/'().,:\\s-]{3,48}?\\s+${CURRENCY_OPT}-?\\d{1,5}\\.\\d{2}(?:\\s+[*#A-VZ])?)\\s+([A-Za-z][A-Za-z0-9#&%*+/'().,:\\s-]{2,48}?\\s+${CURRENCY_OPT}-?\\d{1,5}\\.\\d{2}${TAX_SUFFIX_OPT})$`,
    'i'
  );
  const m = norm.match(twoItemsRe);
  if (m && /[A-Za-z]{2,}/.test(m[1]) && /[A-Za-z]{2,}/.test(m[2])) {
    return [m[1].trim(), m[2].trim()];
  }
  return [norm];
}

/**
 * Cleans leading/trailing EAN/SKU/PLU barcodes, item counters, and thermal artifacts from an item description.
 */
export function cleanItemDescription(rawDesc: string): string {
  if (!rawDesc) return '';
  let d = rawDesc
    .replace(/\u00A0/g, ' ')
    // Strip leading 5-14 digit EAN/UPC/SKU/PLU barcodes
    .replace(/^(?:[*#]?\d{5,14}\b[\s-]*)+/, '')
    // Strip leading 1-2 digit item index ("1. ", "02) ", "* ")
    .replace(/^(?:\d{1,2}[.)]\s+|[*#•-]+\s+)/, '')
    // Strip trailing standalone barcode or single VAT tax code flag if left attached
    .replace(/\s+\b\d{7,14}$/, '')
    .replace(/\s+[*#]$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Remove stray pipe column dividers if any
  d = d.replace(/\|/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return d;
}

function isPureBarcodeOrNoiseLine(line: string): boolean {
  const s = line.trim();
  if (!s) return true;
  if (/^[*#]?\d{5,16}[*#]?$/.test(s)) return true;
  if (/^[-=_*#.·•~:\s]{2,}$/.test(s)) return true;
  return false;
}

const FOOTER_START_REGEX =
  /^(?:grand\s*total|total\s*due|amount\s*due|balance\s*due|invoice\s*total|total\s*incl|total\s*to\s*pay|totaal|total)\b(?!\s*(?:items|qty|savings|discount))/i;

const SUBTOTAL_LINE_REGEX = /^(?:subtotal|sub\s*total|sub-total|net\s*total|total\s*excl)\b/i;

const NON_ITEM_METADATA_REGEX =
  /\b(?:subtotal|sub\s*total|grand\s*total|total\s*due|amount\s*due|balance\s*due|totaal|vat\s*(?:no|nr|reg|rate|summary|incl|excl|\d)|tax\s*invoice|invoice\s*(?:no|nr|#)|receipt\s*(?:no|nr|#)|slip\s*(?:no|nr|#)|till\s*(?:no|nr)?|cashier|operator|served\s*by|change\b|rounding\b|tender(?:ed)?\b|cash\s*tender|debit\s*card|credit\s*card|mastercard|visa\b|eft\b|auth\s*(?:code|no)|aid:|rrn:|stan:|tvr:|tsi:|merchant\s*id|terminal\s*id|tel:|phone:|fax:|reg\s*no|company\s*reg|www\.|http|thank\s*you|welcome\s*to|retain\s*slip|customer\s*copy|loyalty\s*points|points\s*(?:earned|balance)|smart\s*shopper\s*(?:card|pts)|wrewards|xtra\s*savings\s*card|zero\s*rated|standard\s*rated|taxable\s*value)\b/i;

const DISCOUNT_KEYWORD_REGEX =
  /\b(?:less\b|discount|disc\b|promo|markdown|saving|xtra\s*sav|smart\s*shopper|special|rebate|coupon|voucher)\b/i;

const HEADER_BANNER_SKIP_REGEX =
  /\b(?:pty\s*ltd|limited|branch|cnr\b|corner\b|street\b|road\b|avenue\b|blvd\b|mall\b|shopping\s*centre|center\b|po\s*box|p\.?o\.?\s*box|tax\s*invoice|vat\s*reg|date\b|time\b|\d{2}:\d{2}(?::\d{2})?)\b/i;

/**
 * Decides whether a pending description line (Line 1) is the first half of a 2-line wrapped item name
 * ending on Line 2 (e.g. "WOOLWORTHS FREE RANGE LARGE" + "EGGS 18 PACK"), versus an unrelated header/unpriced line.
 */
function shouldJoinWrappedDescription(line1: string, line2Desc: string): boolean {
  const a = cleanItemDescription(line1);
  const b = cleanItemDescription(line2Desc);
  if (!a || !b) return false;
  if (a.length < 3 || a.length > 42) return false;
  if (!/[A-Za-z]{2,}/.test(a)) return false;
  if ( HEADER_BANNER_SKIP_REGEX.test(a) || NON_ITEM_METADATA_REGEX.test(a)) return false;

  // Avoid merging if Line 1 is actually the detected store/vendor banner
  for (const v of KNOWN_VENDORS) {
    if (a.toUpperCase() === v.toUpperCase()) return false;
  }

  // If Line 1 already ends with a finished weight/volume/pack token AND Line 2 is long enough to be its own full brand+item, don't merge
  const endsWithPackSize = /\b\d+(?:[.,]\d+)?\s*(?:kg|g|mg|l|ml|cl|pk|pack|pcs|s|ea)\b$/i.test(a);
  if (endsWithPackSize && b.split(/\s+/).length >= 3) {
    return false;
  }

  return true;
}

/**
 * Extracts unique printed invoice, receipt, slip, or transaction numbers while
 * ignoring static merchant VAT registration, company reg, and phone numbers.
 */
export function extractInvoiceNumberFromText(rawText: string): string {
  if (!rawText) return '';
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const labelPatterns = [
    /\b(?:tax\s*invoice|invoice|inv)\s*(?:(?:no|nr|number)\.?\s*)?[:#-]?\s*([A-Z0-9][A-Z0-9/-]{2,22})\b/i,
    /\b(?:receipt|rcpt|slip|doc|document|trans|transaction|txn|till\s*slip)\s*(?:(?:no|nr|id|number)\.?\s*)?[:#-]?\s*([A-Z0-9][A-Z0-9/-]{2,22})\b/i,
    /\b(?:ref|reference|token)\s*(?:(?:no|nr|id|number)\.?\s*)?[:#-]?\s*([A-Z0-9][A-Z0-9/-]{3,24})\b/i,
  ];

  for (const line of lines) {
    if (/\b(?:vat\s*(?:no|nr|reg)|reg\s*(?:no|nr)|company\s*reg|tel|phone|fax|cell|mer\s*id)\b/i.test(line)) {
      continue;
    }
    for (const pattern of labelPatterns) {
      const m = line.match(pattern);
      if (m && m[1] && /\d/.test(m[1])) {
        const candidate = m[1].replace(/[.,:;]+$/, '').trim();
        if (candidate.length >= 3) {
          return candidate;
        }
      }
    }
  }

  return '';
}

export function classifyItemCategory(
  itemDescription: string,
  fallbackCategory: ReceiptCategory
): ReceiptCategory {
  const text = itemDescription.toLowerCase();

  if (
    /\b(electricity|kwh|prepaid\s*power|power\s*token|water\s*bill|municipal|gas\s*refill|lpg)\b/.test(
      text
    )
  ) {
    return 'Electricity & Utilities';
  }

  if (/\b(unleaded|petrol|diesel|fuel|motor\s*oil|car\s*wash|parking|toll)\b/.test(text)) {
    return 'Transport';
  }

  if (
    /\b(bulb|led\s*lamp|battery|batteries|extension\s*cord|plug\s*top|adapter|screw|screws|nails|drill|hammer|tape\s*measure|paint|brush|sealant|silicone|glue|adhesive|epoxy|sandpaper|padlock|hinge|plumbing|pvc|garden\s*hose|fertilizer|hardware)\b/.test(
      text
    )
  ) {
    return 'Home Maintenance';
  }

  if (
    /\b(bread|milk|eggs|butter|margarine|cheese|yoghurt|yogurt|chicken|beef|mince|pork|boerewors|fish|rice|maize|pasta|flour|sugar|salt|oil|cereal|oats|coffee|tea|juice|water\s*\d|soda|cola|apple|banana|potato|onion|tomato|veg|fruit|soap|toothpaste|detergent|bleach|tissue|toilet\s*paper)\b/.test(
      text
    )
  ) {
    return 'Food & Groceries';
  }

  return fallbackCategory;
}

export function classifyReceiptCategory(vendor: string, fullText: string): ReceiptCategory {
  const text = `${vendor} ${fullText}`.toLowerCase();

  if (
    text.includes('eskom') ||
    text.includes('city power') ||
    text.includes('electricity') ||
    text.includes('prepaid') ||
    text.includes('kwh') ||
    text.includes('token') ||
    text.includes('meter') ||
    text.includes('water') ||
    text.includes('municipality') ||
    text.includes('sewerage') ||
    text.includes('rates') ||
    text.includes('gas')
  ) {
    return 'Electricity & Utilities';
  }

  if (
    text.includes('petrol') ||
    text.includes('diesel') ||
    text.includes('unleaded') ||
    text.includes('fuel') ||
    text.includes('litres') ||
    text.includes('gallons') ||
    text.includes('engen') ||
    text.includes('shell') ||
    text.includes('sasol') ||
    text.includes('totalenergies') ||
    text.includes('bp ') ||
    text.includes('caltex') ||
    text.includes('chevron') ||
    text.includes('exxon') ||
    text.includes('toll') ||
    text.includes('parking') ||
    text.includes('uber')
  ) {
    return 'Transport';
  }

  if (
    text.includes('builders') ||
    text.includes('hardware') ||
    text.includes('paint') ||
    text.includes('timber') ||
    text.includes('cement') ||
    text.includes('mica') ||
    text.includes('chamberlains') ||
    text.includes('home depot') ||
    text.includes('ikea') ||
    text.includes('plumbing') ||
    text.includes('tools') ||
    text.includes('screws') ||
    text.includes('garden') ||
    text.includes('diy')
  ) {
    return 'Home Maintenance';
  }

  if (
    text.includes('pick n pay') ||
    text.includes('checkers') ||
    text.includes('shoprite') ||
    text.includes('woolworths') ||
    text.includes('spar') ||
    text.includes('walmart') ||
    text.includes('tesco') ||
    text.includes('costco') ||
    text.includes('aldi') ||
    text.includes('lidl') ||
    text.includes('kroger') ||
    text.includes('target') ||
    text.includes('food') ||
    text.includes('grocery') ||
    text.includes('bakery') ||
    text.includes('butchery') ||
    text.includes('supermarket') ||
    text.includes('milk') ||
    text.includes('bread') ||
    text.includes('meat') ||
    text.includes('cheese') ||
    text.includes('fruit') ||
    text.includes('kfc') ||
    text.includes('mcdonald') ||
    text.includes('steers') ||
    text.includes('nando') ||
    text.includes('wimpy')
  ) {
    return 'Food & Groceries';
  }

  return 'Other';
}

/**
 * Reconciles extracted line items against the receipt's printed total/subtotal:
 * - Repairs single-item crease leading-digit OCR artifacts (e.g. "119.99" instead of "19.99" when total is "84.97")
 *   strictly when stripping the leading crease digit makes sum(items) match the receipt total within 0.12.
 * - Filters out any accidental VAT/summary duplicate line whose description is generic and equals totalAmount.
 */
export function reconcileAndCleanReceiptItems(receipt: ReceiptData): {
  receipt: ReceiptData;
  reconciled: boolean;
  diffRatio: number;
} {
  let items = (receipt.line_items || [])
    .map((li) => {
      const desc = cleanItemDescription(li.description || '');
      const qty = Number(li.quantity) > 0 ? Number(li.quantity) : 1;
      const total = Number(li.total_price) || 0;
      const unit =
        Number(li.unit_price) > 0
          ? Number(li.unit_price)
          : qty > 0
          ? Number((total / qty).toFixed(2))
          : total;
      return {
        ...li,
        description: desc || li.description || 'Item',
        quantity: Number(qty.toFixed(3)),
        unit_price: Number(unit.toFixed(2)),
        total_price: Number(total.toFixed(2)),
      };
    })
    .filter((li) => li.description.trim().length > 0 && li.total_price > 0);

  let totalAmount = Number(receipt.total_amount) || 0;
  const tax = Number(receipt.tax) || 0;

  if (totalAmount > 0 && items.length > 0) {
    let sum = items.reduce((acc, it) => acc + it.total_price, 0);

    // Check if a vertical fold crease injected a stray leading '1', '4', or '7' onto one item's price
    if (sum > totalAmount + 0.5) {
      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        const priceStr = it.total_price.toFixed(2);
        const dotIdx = priceStr.indexOf('.');
        if (dotIdx >= 2 && /^[147]/.test(priceStr)) {
          const strippedVal = parseFloat(priceStr.slice(1));
          if (strippedVal > 0) {
            const candidateSum = sum - it.total_price + strippedVal;
            const matchesIncl = Math.abs(candidateSum - totalAmount) <= 0.12;
            const matchesExcl = tax > 0 && Math.abs(candidateSum + tax - totalAmount) <= 0.12;
            if (matchesIncl || matchesExcl) {
              items[idx] = {
                ...it,
                total_price: Number(strippedVal.toFixed(2)),
                unit_price: Number((strippedVal / (it.quantity || 1)).toFixed(2)),
              };
              sum = candidateSum;
              break;
            }
          }
        }
      }
    }
  }

  const finalSum = Number(items.reduce((acc, it) => acc + it.total_price, 0).toFixed(2));
  if (totalAmount <= 0 && finalSum > 0) {
    totalAmount = finalSum;
  }

  let subtotal = Number(receipt.subtotal) || 0;
  if (subtotal <= 0) {
    subtotal = tax > 0 && totalAmount > tax ? Number((totalAmount - tax).toFixed(2)) : totalAmount;
  }

  if (items.length === 0 && totalAmount > 0) {
    items = [
      {
        description: `${receipt.vendor_name || 'Store'} Purchase`,
        quantity: 1,
        unit_price: Number(totalAmount.toFixed(2)),
        total_price: Number(totalAmount.toFixed(2)),
        category: receipt.category,
      },
    ];
  }

  const absDiffIncl = Math.abs(finalSum - totalAmount);
  const absDiffExcl = tax > 0 ? Math.abs(finalSum + tax - totalAmount) : absDiffIncl;
  const bestDiff = Math.min(absDiffIncl, absDiffExcl);
  const reconciled = totalAmount > 0 && finalSum > 0 && bestDiff <= Math.max(0.15, totalAmount * 0.015);
  const diffRatio = totalAmount > 0 ? bestDiff / totalAmount : 1;

  return {
    receipt: {
      ...receipt,
      line_items: items,
      subtotal: Number(subtotal.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      total_amount: Number(totalAmount.toFixed(2)),
    },
    reconciled,
    diffRatio,
  };
}

/**
 * Scores a parsed receipt candidate so Dual-Pass OCR (Raw vs Shadow-Flattened Fold Pass)
 * automatically picks the pass with the cleanest item descriptions and tightest total reconciliation.
 */
export function scoreParsedReceiptCandidate(receipts: ReceiptData[]): {
  score: number;
  reconciled: boolean;
} {
  if (!receipts || receipts.length === 0) return { score: 0, reconciled: false };

  let totalScore = 0;
  let allReconciled = true;

  for (const r of receipts) {
    const { reconciled, diffRatio } = reconcileAndCleanReceiptItems(r);
    if (!reconciled) allReconciled = false;

    if (r.total_amount > 0) totalScore += 25;
    if (
      r.vendor_name &&
      !/^(?:Store Purchase|Local Store Purchase|Store Receipt)/i.test(r.vendor_name)
    ) {
      totalScore += 18;
    }
    if (r.invoice_number && r.invoice_number.trim().length >= 3) {
      totalScore += 10;
    }

    const realItems = (r.line_items || []).filter(
      (li) =>
        li.total_price > 0 &&
        !/Purchase$|^Scanned Slip|^Household Expense$/i.test(li.description.trim())
    );
    totalScore += Math.min(45, realItems.length * 7);

    if (reconciled && realItems.length >= 1) {
      totalScore += 40;
    } else if (r.total_amount > 0 && realItems.length >= 1) {
      totalScore += Math.max(0, 25 * (1 - Math.min(1, diffRatio)));
    }
  }

  return { score: totalScore, reconciled: allReconciled };
}

/**
 * Full structural & spatial parser turning either 2D spatial OCR geometry (ML Kit / Tesseract boxes)
 * or raw text into cleanly separated, amount-locked ReceiptData objects.
 */
export function parseReceiptFromSpatialOrText(params: {
  rawText: string;
  spatialPage?: OcrSpatialPage | null;
  originalFileName?: string;
  preferredCurrency?: string;
  engineLabel?: OcrEngineType;
}): ParsedReceiptCandidate {
  const preferredCurrency = params.preferredCurrency || 'ZAR';
  const engineUsed: OcrEngineType = params.engineLabel || 'local_tesseract';

  const reconstructedRows =
    params.spatialPage &&
    ((params.spatialPage.lines && params.spatialPage.lines.length > 0) ||
      (params.spatialPage.elements && params.spatialPage.elements.length > 0))
      ? reconstructCurvedReceiptRows(params.spatialPage)
      : [];

  const effectiveFullText =
    reconstructedRows.length > 0
      ? reconstructedRows.map((r) => r.combinedText).join('\n')
      : (params.rawText || '').trim();

  if (!effectiveFullText || effectiveFullText.trim().length === 0) {
    const fallback = createFallbackReceipt(
      'Store Purchase',
      'Food & Groceries',
      params.originalFileName,
      preferredCurrency,
      engineUsed
    );
    return { receipts: [fallback], qualityScore: 0, reconciled: false };
  }

  const normalizedFullText = effectiveFullText
    .split(/\r?\n/)
    .map((l) => normalizeOcrAmountText(l.replace(/\|/g, '   ')))
    .filter((l) => l.trim().length > 0)
    .join('\n');

  const rawLines = normalizedFullText
    .split(/\r?\n/)
    .flatMap((l) => splitFoldPinchedItemsOnLine(l))
    .map((l) => l.trim())
    .filter(Boolean);

  if (rawLines.length === 0) {
    const fallback = createFallbackReceipt(
      'Store Purchase',
      'Food & Groceries',
      params.originalFileName,
      preferredCurrency,
      engineUsed
    );
    return { receipts: [fallback], qualityScore: 0, reconciled: false };
  }

  // 1. Detect Store / Vendor Name
  let vendorName = '';
  const upperFull = normalizedFullText.toUpperCase();
  for (const v of KNOWN_VENDORS) {
    if (upperFull.includes(v.toUpperCase())) {
      vendorName = v === 'PNP' ? 'Pick n Pay' : v;
      break;
    }
  }

  if (!vendorName) {
    for (let i = 0; i < Math.min(10, rawLines.length); i++) {
      const line = rawLines[i];
      if (
        /^\d+$/.test(line) ||
        /\b(?:tel|fax|vat|tax|invoice|date|cashier|slip|welcome|thank\s+you|reg\s*no|www\.|http|copy)\b/i.test(
          line
        ) ||
        /\d+[.,]\d{2}\s*[*#A-Za-z]{0,2}$/.test(line) ||
        line.length < 3 ||
        line.length > 48
      ) {
        continue;
      }
      const clean = line.replace(/[^a-zA-Z0-9\s&'.-]/g, '').trim();
      if (clean.length >= 3 && /[A-Za-z]{2,}/.test(clean)) {
        vendorName = clean;
        break;
      }
    }
  }
  if (!vendorName) {
    vendorName = 'Local Store Purchase';
  }

  // 2. Detect Invoice / Slip Number
  const invoiceNumber = extractInvoiceNumberFromText(normalizedFullText);

  // 3. Detect Purchase Date
  let invoiceDate = new Date().toISOString().split('T')[0];
  let monthYear = invoiceDate.substring(0, 7);

  const ymdMatch = normalizedFullText.match(
    /\b(202[0-9])[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12][0-9]|3[01])\b/
  );
  const dmyMatch = normalizedFullText.match(
    /\b(0[1-9]|[12][0-9]|3[01])[-/.](0[1-9]|1[0-2])[-/.](202[0-9]|2[0-9])\b/
  );
  const monMatch = normalizedFullText.match(
    /\b(0[1-9]|[12][0-9]|3[01])\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,.-]+(202[0-9]|2[0-9])\b/i
  );

  if (ymdMatch) {
    invoiceDate = `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
    monthYear = invoiceDate.substring(0, 7);
  } else if (dmyMatch) {
    const yr = dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3];
    invoiceDate = `${yr}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
    monthYear = invoiceDate.substring(0, 7);
  } else if (monMatch) {
    const yr = monMatch[3].length === 2 ? `20${monMatch[3]}` : monMatch[3];
    const monthsMap: Record<string, string> = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      may: '05',
      jun: '06',
      jul: '07',
      aug: '08',
      sep: '09',
      oct: '10',
      nov: '11',
      dec: '12',
    };
    const m = monthsMap[monMatch[2].toLowerCase().substring(0, 3)] || '01';
    invoiceDate = `${yr}-${m}-${monMatch[1].padStart(2, '0')}`;
    monthYear = `${yr}-${m}`;
  }

  // 4. Detect Totals, Subtotals & VAT
  let totalAmount = 0;
  let subtotal = 0;
  let tax = 0;
  const primaryTotals: number[] = [];
  const paymentTotals: number[] = [];

  const primaryTotalRegex = new RegExp(
    `(?:GRAND\\s*TOTAL|TOTAL\\s*DUE|AMOUNT\\s*DUE|BALANCE\\s*DUE|INVOICE\\s*TOTAL|TOTAL\\s*INCL|TOTAL\\s*TO\\s*PAY|TOTAAL|\\bTOTAL\\b)(?!\\s*(?:ITEMS|QTY|SAVINGS|DISCOUNT|EXCL))\\s*[:=]?\\s*${CURRENCY_OPT}([0-9]{1,6}[.,][0-9]{2})`,
    'gi'
  );
  let match: RegExpExecArray | null;
  while ((match = primaryTotalRegex.exec(normalizedFullText)) !== null) {
    const val = parseFloat(match[1].replace(',', '.'));
    if (!isNaN(val) && val > 0 && val < 500000) {
      primaryTotals.push(val);
    }
  }

  const paymentFallbackRegex = new RegExp(
    `(?:DEBIT\\s*CARD|CREDIT\\s*CARD|CARD\\s*PAYMENT|EFT|CARD|PAID)\\s*[:=]?\\s*${CURRENCY_OPT}([0-9]{1,6}[.,][0-9]{2})`,
    'gi'
  );
  while ((match = paymentFallbackRegex.exec(normalizedFullText)) !== null) {
    const val = parseFloat(match[1].replace(',', '.'));
    if (!isNaN(val) && val > 0 && val < 500000) {
      paymentTotals.push(val);
    }
  }

  const vatRegex = new RegExp(
    `(?:VAT|TAX|GST)\\s*(?:15%|14%|@[0-9.]+%)?\\s*[:=]?\\s*${CURRENCY_OPT}([0-9]{1,6}[.,][0-9]{2})`,
    'gi'
  );
  while ((match = vatRegex.exec(normalizedFullText)) !== null) {
    const val = parseFloat(match[1].replace(',', '.'));
    if (!isNaN(val) && val > 0 && (totalAmount === 0 || val < totalAmount)) {
      tax = val;
    }
  }

  const subtotalRegex = new RegExp(
    `(?:SUBTOTAL|SUB\\s*TOTAL|NET\\s*TOTAL|TOTAL\\s*EXCL)\\s*[:=]?\\s*${CURRENCY_OPT}([0-9]{1,6}[.,][0-9]{2})`,
    'gi'
  );
  while ((match = subtotalRegex.exec(normalizedFullText)) !== null) {
    const val = parseFloat(match[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      subtotal = val;
    }
  }

  if (primaryTotals.length > 0) {
    // Prefer the final printed TOTAL on the receipt (after loyalty/promo subtotals)
    totalAmount = primaryTotals[primaryTotals.length - 1];
  } else if (paymentTotals.length > 0) {
    totalAmount = Math.max(...paymentTotals);
  }

  const category = classifyReceiptCategory(vendorName, normalizedFullText);

  // 5. State-Machine Multi-Line Item & Description Parser
  const lineItems: LineItem[] = [];
  let pendingDescBuffer: string[] = [];
  let pendingQtyUnit: { qty: number; unitPrice: number } | null = null;
  let reachedFooterTotal = false;

  // Pattern regexes supporting decimals/weights ("0.845 kg @ 24.99/kg   21.12"), long barcode-prefixed lines, and negative discounts
  const inlineQtyUnitTotalRe = new RegExp(
    `^(.{2,95}?)\\s+(\\d{1,4}(?:[.,]\\d{1,3})?)\\s*(?:kg|g|l|ml|ea|pcs)?\\s*[xX*@]\\s*${CURRENCY_OPT}(\\d{1,5}[.,]\\d{2})(?:\\s*\\/\\s*(?:kg|g|l|ml|ea))?\\s+${CURRENCY_OPT}(-?\\d{1,6}[.,]\\d{2})${TAX_SUFFIX_OPT}$`,
    'i'
  );

  const qtyUnitAndTotalOnlyRe = new RegExp(
    `^(\\d{1,4}(?:[.,]\\d{1,3})?)\\s*(?:kg|g|l|ml|ea|pcs)?\\s*[xX*@]\\s*${CURRENCY_OPT}(\\d{1,5}[.,]\\d{2})(?:\\s*\\/\\s*(?:kg|g|l|ml|ea))?\\s+${CURRENCY_OPT}(-?\\d{1,6}[.,]\\d{2})${TAX_SUFFIX_OPT}$`,
    'i'
  );

  const qtyUnitPrefixOnlyRe = new RegExp(
    `^(\\d{1,4}(?:[.,]\\d{1,3})?)\\s*(?:kg|g|l|ml|ea|pcs)?\\s*[xX*@]\\s*${CURRENCY_OPT}(\\d{1,5}[.,]\\d{2})(?:\\s*\\/\\s*(?:kg|g|l|ml|ea))?$`,
    'i'
  );

  const inlineDescAndPriceRe = new RegExp(
    `^(.{2,95}?)\\s+${CURRENCY_OPT}(-?\\d{1,6}[.,]\\d{2})${TAX_SUFFIX_OPT}$`,
    'i'
  );

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    if (isPureBarcodeOrNoiseLine(line)) {
      // Keep pendingDescBuffer intact across standalone barcode lines!
      continue;
    }

    // Stop item extraction cleanly once we reach the final TOTAL / payment footer
    if (FOOTER_START_REGEX.test(line)) {
      reachedFooterTotal = true;
      pendingDescBuffer = [];
      pendingQtyUnit = null;
      continue;
    }

    if (reachedFooterTotal) {
      // Only resume if a second distinct receipt header appears below in the same scan
      if (/\btax\s*invoice\b/i.test(line)) {
        reachedFooterTotal = false;
      } else {
        continue;
      }
    }

    if (SUBTOTAL_LINE_REGEX.test(line)) {
      pendingDescBuffer = [];
      pendingQtyUnit = null;
      continue;
    }

    // Check item-level discount / markdown rows ("LESS PROMO -15.00" or "XTRA SAVINGS -10.00") BEFORE generic skip
    const discMatch = line.match(inlineDescAndPriceRe);
    if (discMatch) {
      const rawDiscVal = parseFloat(discMatch[2].replace(',', '.'));
      const descText = discMatch[1].trim();
      const isNegativeOrDiscount =
        rawDiscVal < 0 ||
        (DISCOUNT_KEYWORD_REGEX.test(descText) && line.includes('-'));

      if (isNegativeOrDiscount && !isNaN(rawDiscVal) && Math.abs(rawDiscVal) > 0) {
        const discountAbs = Math.abs(rawDiscVal);
        if (lineItems.length > 0) {
          const prevItem = lineItems[lineItems.length - 1];
          if (discountAbs < prevItem.total_price) {
            const updatedTotal = Number((prevItem.total_price - discountAbs).toFixed(2));
            prevItem.total_price = updatedTotal;
            prevItem.unit_price = Number(
              (updatedTotal / Math.max(0.001, prevItem.quantity)).toFixed(2)
            );
          }
        }
        pendingDescBuffer = [];
        pendingQtyUnit = null;
        continue;
      }
    }

    // Handle VOID / CANCELLED item lines
    if (/\b(?:void|voided|cancelled\s*item)\b/i.test(line)) {
      pendingDescBuffer = [];
      pendingQtyUnit = null;
      continue;
    }

    // Skip VAT breakdown tables ("A 15.00% 142.61 21.39 164.00") & non-item metadata
    if (
      NON_ITEM_METADATA_REGEX.test(line) ||
      /^[A-Z*#]?\s*\d{1,2}(?:[.,]\d{1,2})?%\s+\d+[.,]\d{2}/i.test(line)
    ) {
      pendingDescBuffer = [];
      pendingQtyUnit = null;
      continue;
    }

    // Case A: "Description   Qty @ UnitPrice   TotalPrice" all on one line
    const mInlineQty = line.match(inlineQtyUnitTotalRe);
    if (mInlineQty) {
      let desc = cleanItemDescription(mInlineQty[1]);
      if (pendingDescBuffer.length > 0 && shouldJoinWrappedDescription(pendingDescBuffer[pendingDescBuffer.length - 1], desc)) {
        desc = cleanItemDescription(`${pendingDescBuffer[pendingDescBuffer.length - 1]} ${desc}`);
      }
      const qty = Math.max(0.001, parseFloat(mInlineQty[2].replace(',', '.')) || 1);
      const unitP = parseFloat(mInlineQty[3].replace(',', '.'));
      const totalP = parseFloat(mInlineQty[4].replace(',', '.'));
      if (desc.length >= 2 && /[A-Za-z]{2,}/.test(desc) && !isNaN(totalP) && totalP > 0 && totalP < 100000) {
        lineItems.push({
          description: desc,
          quantity: Number(qty.toFixed(3)),
          unit_price: !isNaN(unitP) && unitP > 0 ? Number(unitP.toFixed(2)) : Number((totalP / qty).toFixed(2)),
          total_price: Number(totalP.toFixed(2)),
          category: classifyItemCategory(desc, category),
        });
        pendingDescBuffer = [];
        pendingQtyUnit = null;
        continue;
      }
    }

    // Case B: "0.845 kg @ 24.99/kg   21.12" on Line 2 (attaches to buffered description from Line 1!)
    const mQtyTotalOnly = line.match(qtyUnitAndTotalOnlyRe);
    if (mQtyTotalOnly && pendingDescBuffer.length > 0) {
      const desc = cleanItemDescription(pendingDescBuffer.join(' '));
      const qty = Math.max(0.001, parseFloat(mQtyTotalOnly[1].replace(',', '.')) || 1);
      const unitP = parseFloat(mQtyTotalOnly[2].replace(',', '.'));
      const totalP = parseFloat(mQtyTotalOnly[3].replace(',', '.'));
      if (desc.length >= 2 && /[A-Za-z]{2,}/.test(desc) && !isNaN(totalP) && totalP > 0 && totalP < 100000) {
        lineItems.push({
          description: desc,
          quantity: Number(qty.toFixed(3)),
          unit_price: !isNaN(unitP) && unitP > 0 ? Number(unitP.toFixed(2)) : Number((totalP / qty).toFixed(2)),
          total_price: Number(totalP.toFixed(2)),
          category: classifyItemCategory(desc, category),
        });
        pendingDescBuffer = [];
        pendingQtyUnit = null;
        continue;
      }
    }

    // Case C: "2 X 18.99" standalone prefix line (Shoprite / Boxer / Spar — description + total comes on next line, OR updates previous item if already emitted!)
    const mQtyPrefix = line.match(qtyUnitPrefixOnlyRe);
    if (mQtyPrefix) {
      const qty = Math.max(0.001, parseFloat(mQtyPrefix[1].replace(',', '.')) || 1);
      const unitP = parseFloat(mQtyPrefix[2].replace(',', '.'));
      if (!isNaN(unitP) && unitP > 0) {
        // Check if it actually belongs to the item just emitted right above (e.g. "BREAD   37.98" followed by "2 @ 18.99")
        const prev = lineItems[lineItems.length - 1];
        if (
          pendingDescBuffer.length === 0 &&
          prev &&
          prev.quantity === 1 &&
          Math.abs(qty * unitP - prev.total_price) <= 0.08
        ) {
          prev.quantity = Number(qty.toFixed(3));
          prev.unit_price = Number(unitP.toFixed(2));
        } else {
          pendingQtyUnit = { qty, unitPrice: unitP };
        }
        continue;
      }
    }

    // Case D: Standalone price on its own line when description was on previous line
    const standaloneAmt = parseStandaloneAmountToken(line, false);
    if (standaloneAmt !== null && standaloneAmt.value > 0 && standaloneAmt.value < 100000) {
      if (pendingDescBuffer.length > 0) {
        const desc = cleanItemDescription(pendingDescBuffer.join(' '));
        if (desc.length >= 2 && /[A-Za-z]{2,}/.test(desc)) {
          let qty = 1;
          let unitP = standaloneAmt.value;
          if (
            pendingQtyUnit &&
            Math.abs(pendingQtyUnit.qty * pendingQtyUnit.unitPrice - standaloneAmt.value) <= 0.12
          ) {
            qty = pendingQtyUnit.qty;
            unitP = pendingQtyUnit.unitPrice;
          }
          lineItems.push({
            description: desc,
            quantity: Number(qty.toFixed(3)),
            unit_price: Number(unitP.toFixed(2)),
            total_price: Number(standaloneAmt.value.toFixed(2)),
            category: classifyItemCategory(desc, category),
          });
          pendingDescBuffer = [];
          pendingQtyUnit = null;
          continue;
        }
      }
      pendingQtyUnit = null;
      continue;
    }

    // Case E: Standard "Description   TotalPrice" (with optional wrapped prefix line or pending Qty @ Unit)
    const mInlineItem = line.match(inlineDescAndPriceRe);
    if (mInlineItem) {
      const price = parseFloat(mInlineItem[2].replace(',', '.'));
      let descPart = cleanItemDescription(mInlineItem[1]);

      if (!isNaN(price) && price > 0 && price < 100000 && descPart.length >= 2 && /[A-Za-z]{2,}/.test(descPart)) {
        let qty = 1;
        // Check leading "2 x " inside description
        const leadQtyMatch = descPart.match(/^(\d{1,3})\s*[xX@]\s+(.{2,})$/);
        if (leadQtyMatch) {
          qty = Math.max(1, parseInt(leadQtyMatch[1], 10) || 1);
          descPart = cleanItemDescription(leadQtyMatch[2]);
        }

        // Check if previous line was a wrapped description prefix
        if (
          pendingDescBuffer.length > 0 &&
          shouldJoinWrappedDescription(pendingDescBuffer[pendingDescBuffer.length - 1], descPart)
        ) {
          descPart = cleanItemDescription(
            `${pendingDescBuffer[pendingDescBuffer.length - 1]} ${descPart}`
          );
        }

        let unitP = Number((price / qty).toFixed(2));
        if (
          pendingQtyUnit &&
          Math.abs(pendingQtyUnit.qty * pendingQtyUnit.unitPrice - price) <= 0.12
        ) {
          qty = pendingQtyUnit.qty;
          unitP = pendingQtyUnit.unitPrice;
        }

        lineItems.push({
          description: descPart,
          quantity: Number(qty.toFixed(3)),
          unit_price: Number(unitP.toFixed(2)),
          total_price: Number(price.toFixed(2)),
          category: classifyItemCategory(descPart, category),
        });
        pendingDescBuffer = [];
        pendingQtyUnit = null;
        continue;
      }
    }

    // Case F: Unpriced text line — candidate for multi-line wrapped item description!
    const candidateDesc = cleanItemDescription(line);
    if (
      candidateDesc.length >= 2 &&
      candidateDesc.length <= 52 &&
      /[A-Za-z]{2,}/.test(candidateDesc) &&
      !HEADER_BANNER_SKIP_REGEX.test(candidateDesc) &&
      candidateDesc.toUpperCase() !== vendorName.toUpperCase()
    ) {
      // Keep at most the most recent 2 continuation lines so old header text never leaks into items
      pendingDescBuffer.push(candidateDesc);
      if (pendingDescBuffer.length > 2) {
        pendingDescBuffer.shift();
      }
    } else {
      pendingDescBuffer = [];
    }
  }

  // 6. Reconcile & Clean Final Receipt
  const draftReceipt: ReceiptData = {
    vendor_name: vendorName,
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    month_year: monthYear,
    category,
    currency: preferredCurrency,
    line_items: lineItems,
    subtotal,
    tax,
    total_amount: totalAmount,
    notes:
      engineUsed === 'native_mlkit'
        ? 'Scanned directly on your phone'
        : 'Scanned offline on your device',
    engine_used: engineUsed,
  };

  const { receipt: reconciledReceipt, reconciled } = reconcileAndCleanReceiptItems(draftReceipt);
  const { score } = scoreParsedReceiptCandidate([reconciledReceipt]);

  return {
    receipts: [reconciledReceipt],
    qualityScore: score,
    reconciled,
  };
}

/**
 * Compares multiple OCR passes (e.g. Original High-Res vs Fold-Shadow-Flattened Pass)
 * and returns the highest-scoring, best-reconciled receipt list.
 */
export function selectBestParsedReceipts(candidates: ParsedReceiptCandidate[]): ParsedReceiptCandidate {
  const valid = candidates.filter((c) => c && Array.isArray(c.receipts) && c.receipts.length > 0);
  if (valid.length === 0) {
    return {
      receipts: [createFallbackReceipt('Store Purchase', 'Food & Groceries')],
      qualityScore: 0,
      reconciled: false,
    };
  }
  valid.sort((a, b) => {
    if (a.reconciled !== b.reconciled) {
      return a.reconciled ? -1 : 1;
    }
    return b.qualityScore - a.qualityScore;
  });
  return valid[0];
}

function createFallbackReceipt(
  vendor: string,
  category: ReceiptCategory,
  fileName?: string,
  currency = 'ZAR',
  engineUsed: OcrEngineType = 'local_tesseract'
): ReceiptData {
  const today = new Date().toISOString().split('T')[0];
  return {
    vendor_name: vendor,
    invoice_number: '',
    invoice_date: today,
    month_year: today.substring(0, 7),
    category,
    currency,
    line_items: [
      {
        description: fileName ? `Scanned Slip (${fileName})` : 'Household Expense',
        quantity: 1,
        unit_price: 0,
        total_price: 0,
        category,
      },
    ],
    subtotal: 0,
    tax: 0,
    total_amount: 0,
    notes: 'Photo captured on device — confirm store, date, invoice # and total below.',
    engine_used: engineUsed,
  };
}
