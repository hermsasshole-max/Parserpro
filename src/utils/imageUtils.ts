/**
 * Utility to optimize, resize, and convert receipt images before sending to OCR.
 * Compresses oversized camera images (which can be 10MB-25MB) down to <800KB
 * with high resolution (max 1600px) for crisp OCR and instant network transport.
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
  maxDimension = 1600,
  quality = 0.85
): Promise<ProcessedImageResult> {
  const originalSizeKb = Math.round(inputFile.size / 1024);

  // If it's a PDF, we don't resize via canvas - read raw buffer
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

      // Calculate scaled dimensions while preserving aspect ratio
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
        // Fallback to original file if canvas context is unavailable
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

      // Fill white background (useful for transparent PNGs)
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
          console.log(
            `[Image Optimizer] Resized ${inputFile.name}: ${originalSizeKb} KB -> ${processedSizeKb} KB (${width}x${height})`
          );

          const compressedFile = new File([blob], inputFile.name.replace(/\.[^/.]+$/, '.jpg'), {
            type: targetMime,
            lastModified: Date.now(),
          });

          // Convert blob to base64
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
