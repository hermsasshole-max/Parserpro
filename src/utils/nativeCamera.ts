import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export const isNativeAndroidApp = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
};

export const isCapacitorPlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Captures receipt photo natively on Android using Capacitor Camera.
 * Returns null if dismissed, cancelled, or running on standard web browser.
 */
export async function captureReceiptWithNativeCamera(): Promise<{ file: File; dataUrl: string } | null> {
  try {
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      saveToGallery: false,
      promptLabelHeader: 'Scan Receipt',
      promptLabelPhoto: 'Choose from Gallery',
      promptLabelPicture: 'Take Receipt Photo'
    });

    if (!photo.dataUrl) return null;

    const res = await fetch(photo.dataUrl);
    const blob = await res.blob();
    const fileName = `receipt_${Date.now()}.${photo.format || 'jpeg'}`;
    const file = new File([blob], fileName, {
      type: `image/${photo.format || 'jpeg'}`,
      lastModified: Date.now()
    });

    return { file, dataUrl: photo.dataUrl };
  } catch (err: any) {
    if (err?.message?.includes('User cancelled') || err?.message?.includes('cancelled')) {
      return null;
    }
    console.warn('[NativeCamera] Capacitor camera error or fallback needed:', err);
    return null;
  }
}

/**
 * Picks receipt image from device gallery natively using Capacitor Camera.
 */
export async function pickReceiptFromGallery(): Promise<{ file: File; dataUrl: string } | null> {
  try {
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos,
    });

    if (!photo.dataUrl) return null;

    const res = await fetch(photo.dataUrl);
    const blob = await res.blob();
    const fileName = `receipt_gallery_${Date.now()}.${photo.format || 'jpeg'}`;
    const file = new File([blob], fileName, {
      type: `image/${photo.format || 'jpeg'}`,
      lastModified: Date.now()
    });

    return { file, dataUrl: photo.dataUrl };
  } catch (err: any) {
    if (err?.message?.includes('User cancelled') || err?.message?.includes('cancelled')) {
      return null;
    }
    console.warn('[NativeCamera] Capacitor gallery picker error:', err);
    return null;
  }
}
