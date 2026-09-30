import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Filesystem } from '@capacitor/filesystem';

export interface AndroidStartupPermissionsResult {
  isAndroid: boolean;
  cameraStatus: string;
  storageStatus: string;
  cameraGranted: boolean;
  storageGranted: boolean;
  prompted: boolean;
}

/**
 * Checks and explicitly requests Camera and Filesystem permissions on app startup
 * if running natively on an Android device via Capacitor.
 * Triggers native Android OS permission dialogues upfront before receipt scanning.
 */
export async function checkAndRequestStartupPermissions(): Promise<AndroidStartupPermissionsResult> {
  const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  
  if (!isAndroid) {
    return {
      isAndroid: false,
      cameraStatus: 'granted',
      storageStatus: 'granted',
      cameraGranted: true,
      storageGranted: true,
      prompted: false,
    };
  }

  console.log('[NativePermissions] Initializing Capacitor Permissions on Android app startup...');

  let cameraStatus = 'prompt';
  let cameraGranted = false;
  let storageStatus = 'prompt';
  let storageGranted = false;
  let prompted = false;

  // 1. Camera & Photos permission
  try {
    const currentCam = await Camera.checkPermissions();
    cameraStatus = currentCam.camera;
    console.log('[NativePermissions] Current Android camera status:', currentCam);
    
    if (currentCam.camera !== 'granted' || currentCam.photos !== 'granted') {
      prompted = true;
      console.log('[NativePermissions] Prompting Android OS for Camera & Gallery permissions...');
      const requestedCam = await Camera.requestPermissions();
      cameraStatus = requestedCam.camera;
      cameraGranted = requestedCam.camera === 'granted';
    } else {
      cameraGranted = true;
    }
  } catch (camErr) {
    console.warn('[NativePermissions] Camera.checkPermissions notice, attempting direct requestPermissions():', camErr);
    try {
      prompted = true;
      const requestedCam = await Camera.requestPermissions();
      cameraStatus = requestedCam.camera;
      cameraGranted = requestedCam.camera === 'granted';
    } catch (directCamErr) {
      console.error('[NativePermissions] Camera.requestPermissions error:', directCamErr);
    }
  }

  // 2. Storage & Filesystem permission
  try {
    const currentFs = await Filesystem.checkPermissions();
    storageStatus = currentFs.publicStorage;
    console.log('[NativePermissions] Current Android storage status:', currentFs);

    if (currentFs.publicStorage !== 'granted') {
      prompted = true;
      console.log('[NativePermissions] Prompting Android OS for Filesystem/Storage permissions...');
      const requestedFs = await Filesystem.requestPermissions();
      storageStatus = requestedFs.publicStorage;
      storageGranted = requestedFs.publicStorage === 'granted';
    } else {
      storageGranted = true;
    }
  } catch (fsErr) {
    console.warn('[NativePermissions] Filesystem.checkPermissions notice, attempting direct requestPermissions():', fsErr);
    try {
      prompted = true;
      const requestedFs = await Filesystem.requestPermissions();
      storageStatus = requestedFs.publicStorage;
      storageGranted = requestedFs.publicStorage === 'granted';
    } catch (directFsErr) {
      console.error('[NativePermissions] Filesystem.requestPermissions error:', directFsErr);
    }
  }

  console.log('[NativePermissions] Startup Android permissions resolved:', {
    cameraStatus,
    cameraGranted,
    storageStatus,
    storageGranted,
    prompted,
  });

  return {
    isAndroid: true,
    cameraStatus,
    storageStatus,
    cameraGranted,
    storageGranted,
    prompted,
  };
}
