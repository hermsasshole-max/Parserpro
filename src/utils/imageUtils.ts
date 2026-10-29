/**
 * Utility to optimize, resize, and pre-process receipt images before OCR.
 * Includes an O(W*H) Integral-Image Illumination Flattener that removes dark
 * fold creases, uneven lighting, and cylindrical "rolling" shadows on thermal paper.
 */

export interface ProcessedImageResult {
  file: File;
  base64Data: string; // Stripped of data URI prefix
  mimeType: string;
  originalSizeKb: number;
  processedSizeKb: number;
}

export async function compressAndPrepareImage(
  inputFile: File,
  maxDimension = 2200,
  quality = 0.86
): Promise<ProcessedImageResult> {
  const originalSizeKb = Math.round(inputFile.size / 1024);

  if (inputFile.type === 'application/pdf') {
    const base64 = await fileToBase64(inputFile);
    const cleanBase64 = cleanBase64String(base64);
    return {
      file: inputFile,
      base64Data: cleanBase64,
      mimeType: 'application/pdf',
      originalSizeKb,
      processedSizeKb: originalSizeKb,
    };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(inputFile);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        fileToBase64(inputFile)
          .then((b64) => {
            resolve({
              file: inputFile,
              base64Data: cleanBase64String(b64),
              mimeType: inputFile.type || 'image/jpeg',
              originalSizeKb,
              processedSizeKb: originalSizeKb,
            });
          })
          .catch(reject);
        return;
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const targetMime = 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            fileToBase64(inputFile)
              .then((b64) => {
                resolve({
                  file: inputFile,
                  base64Data: cleanBase64String(b64),
                  mimeType: inputFile.type || targetMime,
                  originalSizeKb,
                  processedSizeKb: originalSizeKb,
                });
              })
              .catch(reject);
            return;
          }

          const processedSizeKb = Math.round(blob.size / 1024);
          const compressedFile = new File([blob], inputFile.name.replace(/\.[^/.]+$/, '.jpg'), {
            type: targetMime,
            lastModified: Date.now(),
          });

          const reader = new FileReader();
          reader.onloadend = () => {
            const rawBase64 = (reader.result as string) || '';
            const cleanBase64 = cleanBase64String(rawBase64);
            resolve({
              file: compressedFile,
              base64Data: cleanBase64,
              mimeType: targetMime,
              originalSizeKb,
              processedSizeKb,
            });
          };
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(blob);
        },
        targetMime,
        quality
      );
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      console.warn('[Image Optimizer] Failed to load image for canvas resizing, falling back to raw file', err);
      fileToBase64(inputFile)
        .then((b64) => {
          resolve({
            file: inputFile,
            base64Data: cleanBase64String(b64),
            mimeType: inputFile.type || 'image/jpeg',
            originalSizeKb,
            processedSizeKb: originalSizeKb,
          });
        })
        .catch(reject);
    };

    img.src = objectUrl;
  });
}

/**
 * Generates an illumination-normalized ("fold-shadow & roll-shading flattened") version
 * of a receipt image using an O(W*H) summed-area integral table + mild unsharp text boost.
 * Turns dark crease troughs and curved edges into crisp dark thermal ink on uniform white paper.
 */
export async function createFoldFlattenedOcrImage(
  base64Data: string,
  mimeType = 'image/jpeg',
  maxDim = 2000
): Promise<string> {
  if (typeof document === 'undefined' || !base64Data) {
    return cleanBase64String(base64Data);
  }

  const cleanB64 = cleanBase64String(base64Data);
  const srcUrl = `data:${mimeType || 'image/jpeg'};base64,${cleanB64}`;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.width;
        let h = img.height;
        if (w <= 0 || h <= 0) {
          resolve(cleanB64);
          return;
        }
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(cleanB64);
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const totalPx = w * h;
        const lum = new Uint8Array(totalPx);

        for (let i = 0, p = 0; i < totalPx; i++, p += 4) {
          lum[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
        }

        // Build (w + 1) x (h + 1) summed-area table (Float64 avoids 32-bit overflow above 16MP)
        const stride = w + 1;
        const integral = new Float64Array((w + 1) * (h + 1));
        for (let y = 1; y <= h; y++) {
          let rowSum = 0;
          const srcOffset = (y - 1) * w;
          const curRow = y * stride;
          const prevRow = (y - 1) * stride;
          for (let x = 1; x <= w; x++) {
            rowSum += lum[srcOffset + x - 1];
            integral[curRow + x] = integral[prevRow + x] + rowSum;
          }
        }

        const radius = Math.max(18, Math.round(Math.min(w, h) / 26));
        const flattened = new Uint8Array(totalPx);

        for (let y = 0; y < h; y++) {
          const y0 = Math.max(0, y - radius);
          const y1 = Math.min(h, y + radius + 1);
          const r0 = y0 * stride;
          const r1 = y1 * stride;
          const rowOff = y * w;

          for (let x = 0; x < w; x++) {
            const x0 = Math.max(0, x - radius);
            const x1 = Math.min(w, x + radius + 1);
            const area = (x1 - x0) * (y1 - y0);
            const sum =
              integral[r1 + x1] - integral[r0 + x1] - integral[r1 + x0] + integral[r0 + x0];
            const localBg = Math.max(38, sum / area);
            const pxVal = lum[rowOff + x];

            // Divide out fold shadow / roll shading and stretch thermal ink contrast
            const norm = (pxVal / localBg) * 248;
            let enhanced: number;
            if (norm < 206) {
              enhanced = 206 - (206 - norm) * 1.65;
            } else {
              enhanced = 255 - (255 - norm) * 0.25;
            }
            flattened[rowOff + x] = enhanced <= 0 ? 0 : enhanced >= 255 ? 255 : enhanced | 0;
          }
        }

        // Gentle 3x3 unsharp boost on interior pixels to crisp faded crease characters
        for (let y = 0; y < h; y++) {
          const rowOff = y * w;
          for (let x = 0; x < w; x++) {
            let outVal = flattened[rowOff + x];
            if (y > 0 && y < h - 1 && x > 0 && x < w - 1) {
              const neighbors =
                flattened[rowOff - w + x] +
                flattened[rowOff + w + x] +
                flattened[rowOff + x - 1] +
                flattened[rowOff + x + 1];
              const sharp = outVal + ((outVal * 4 - neighbors) >> 2);
              outVal = sharp <= 0 ? 0 : sharp >= 255 ? 255 : sharp;
            }
            const p = (rowOff + x) * 4;
            data[p] = outVal;
            data[p + 1] = outVal;
            data[p + 2] = outVal;
            data[p + 3] = 255;
          }
        }

        ctx.putImageData(imgData, 0, 0);
        const outUrl = canvas.toDataURL('image/jpeg', 0.9);
        resolve(cleanBase64String(outUrl));
      } catch (e) {
        console.warn('[Image Optimizer] Fold flattening fallback to original image:', e);
        resolve(cleanB64);
      }
    };
    img.onerror = () => resolve(cleanB64);
    img.src = srcUrl;
  });
}

/**
 * Strips data URI prefix (e.g. data:image/jpeg;base64,) from base64 string
 */
export function cleanBase64String(base64WithPossiblePrefix: string): string {
  const commaIndex = base64WithPossiblePrefix.indexOf(',');
  if (commaIndex !== -1 && base64WithPossiblePrefix.startsWith('data:')) {
    return base64WithPossiblePrefix.substring(commaIndex + 1);
  }
  return base64WithPossiblePrefix;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string) || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
