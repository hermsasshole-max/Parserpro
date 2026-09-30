import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import type { jsPDF } from 'jspdf';

/**
 * Returns true if running natively inside Android APK (Capacitor WebView)
 */
export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/**
 * Returns true if running inside any Capacitor native container
 */
export function isNativeContainer(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Actively requests Android storage & media permissions if not already granted.
 */
export async function requestNativeStoragePermissions(): Promise<boolean> {
  if (!isNativeContainer()) return true;

  try {
    const status = await Filesystem.checkPermissions();
    if (status.publicStorage === 'granted') {
      return true;
    }
    const req = await Filesystem.requestPermissions();
    return req.publicStorage === 'granted';
  } catch (err) {
    console.warn('[NativeStorage] Permission check/request error:', err);
    return false;
  }
}

/**
 * Converts a jsPDF document into a clean base64 string
 */
function docToBase64(doc: jsPDF): string {
  const dataUri = doc.output('datauristring');
  const commaIdx = dataUri.indexOf(',');
  return commaIdx !== -1 ? dataUri.substring(commaIdx + 1) : dataUri;
}

/**
 * Writes a PDF directly to the Android device's native filesystem.
 * Tries Directory.Documents first, and falls back to Directory.Cache if needed.
 */
export async function savePDFToNativeDevice(
  doc: jsPDF,
  filename: string
): Promise<{ success: boolean; uri?: string; filename: string; error?: string }> {
  try {
    await requestNativeStoragePermissions();

    const base64Data = docToBase64(doc);

    // Try saving to Documents directory first (accessible by user file managers)
    try {
      const res = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });

      return {
        success: true,
        uri: res.uri,
        filename,
      };
    } catch (docErr) {
      console.warn('[NativeStorage] Could not write to Documents, falling back to Cache:', docErr);
      // Fallback to Cache directory (guaranteed writable without strict folder permissions)
      const cacheRes = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });

      return {
        success: true,
        uri: cacheRes.uri,
        filename,
      };
    }
  } catch (err: any) {
    console.error('[NativeStorage] Failed to write PDF natively:', err);
    return {
      success: false,
      filename,
      error: err?.message || 'Failed to save to Android storage',
    };
  }
}

/**
 * Opens the native Android Print / Share dialogue.
 * Writes the PDF into native device storage and shares the file URI to Android's system share sheet,
 * which provides direct "Print" (Android Print Spooler), "Save to Drive", and "Save to device".
 */
export async function shareOrPrintPDFNative(
  doc: jsPDF,
  filename: string,
  title: string = 'Invoice / Statement'
): Promise<{ success: boolean; message: string; uri?: string }> {
  try {
    // Save to native storage first
    const saveRes = await savePDFToNativeDevice(doc, filename);
    if (!saveRes.success || !saveRes.uri) {
      return { success: false, message: 'Could not write document to Android device storage.' };
    }

    // Launch native Android Share & Print sheet
    await Share.share({
      title,
      text: `${title} (${filename})`,
      url: saveRes.uri,
      dialogTitle: 'Print, Save or Share Document',
    });

    return {
      success: true,
      message: `Document saved to device (${filename}) and share/print sheet opened!`,
      uri: saveRes.uri,
    };
  } catch (err: any) {
    if (err?.message?.includes('User cancelled') || err?.message?.includes('cancelled')) {
      return { success: true, message: 'Print/Share dialog closed.' };
    }
    console.error('[NativeShare] Share error:', err);
    return {
      success: false,
      message: err?.message || 'Failed to open Android print/share sheet.',
    };
  }
}
