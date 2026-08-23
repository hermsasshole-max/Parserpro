import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Download, 
  X, 
  Copy, 
  Check, 
  Share2, 
  ExternalLink, 
  Sparkles,
  QrCode
} from 'lucide-react';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onInstallSuccess?: () => void;
}

export const InstallModal: React.FC<InstallModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onInstallSuccess,
}) => {
  const [copied, setCopied] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState<string | null>(null);

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      setIsAndroid(/android/i.test(ua));
      const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;
      setIsStandalone(standalone);
    }
  }, []);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ParserPro - Receipt & Expenditure Tracker',
          text: 'Scan household grocery receipts and track monthly expenditures with ParserPro.',
          url: currentUrl,
        });
      } catch (err) {
        console.log('Share canceled or failed:', err);
      }
    } else {
      handleCopyLink();
    }
  };

  const handleTriggerInstall = async () => {
    if (deferredPrompt) {
      setInstalling(true);
      try {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setInstallStatus('Installed successfully! You can now launch ParserPro from your Home Screen.');
          if (onInstallSuccess) onInstallSuccess();
        } else {
          setInstallStatus('Installation dismissed. You can install anytime from the Chrome menu.');
        }
      } catch (e) {
        console.error('Install prompt error:', e);
      } finally {
        setInstalling(false);
      }
    } else {
      // Guide the user to browser menu
      setInstallStatus('Tap the 3 dots (⋮) in Chrome menu and tap "Install app" or "Add to Home screen"');
    }
  };

  // QR Code URL using quickchart QR API for instant mobile scanning
  const qrCodeUrl = `https://quickchart.io/qr?text=${encodeURIComponent(currentUrl)}&size=200&margin=1&ecLevel=M`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in no-print overflow-y-auto">
      <div 
        id="install-android-modal" 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-6 animate-scale-up"
      >
        {/* Header with Emerald Brand Banner */}
        <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-white text-emerald-700 flex items-center justify-center shadow-md font-bold text-xl">
              <Smartphone className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-[11px] font-bold tracking-wide uppercase text-emerald-100">
                <Sparkles className="w-3 h-3" /> Android & Mobile PWA
              </div>
              <h2 className="text-xl font-black tracking-tight text-white">
                Install ParserPro to Android
              </h2>
            </div>
          </div>
          <p className="text-xs text-emerald-100 mt-1 max-w-md leading-relaxed">
            Install this app on your Android device to scan receipts on the go with full camera access, offline support, and standalone fullscreen performance.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Standalone state notification */}
          {isStandalone && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-medium">
              <Check className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>You are already running ParserPro in Standalone App Mode!</span>
            </div>
          )}

          {/* Instant 1-Click Install Button (When browser trigger is ready) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-left w-full sm:w-auto">
              <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-600" />
                1-Click Direct Install
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {deferredPrompt 
                  ? 'Ready to install on this device right now' 
                  : 'Triggers Android Chrome native install popup'}
              </p>
            </div>
            <button
              onClick={handleTriggerInstall}
              disabled={installing}
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{installing ? 'Prompting...' : 'Install on Android'}</span>
            </button>
          </div>

          {installStatus && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
              {installStatus}
            </div>
          )}

          {/* Quick QR Code for Scanning from PC / Preview */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              <QrCode className="w-4 h-4 text-emerald-600" />
              <span>Scan QR Code with Android Phone Camera</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl shrink-0 shadow-inner">
                <img
                  src={qrCodeUrl}
                  alt="Scan on Android Phone"
                  className="w-28 h-28 object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="space-y-2 text-xs text-slate-600">
                <p className="leading-relaxed">
                  Open your <strong>Android Camera</strong> or <strong>Google Lens</strong> and point it at this QR code to open the app on your phone.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors border border-slate-200"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Link Copied!' : 'Copy App Link'}</span>
                  </button>

                  <button
                    onClick={handleNativeShare}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-lg transition-colors border border-emerald-200"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share to Phone</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 3 Step Android Chrome Manual Instructions */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Manual 3-Step Guide (Chrome for Android)
            </div>

            <div className="grid grid-cols-1 gap-2.5 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  1
                </div>
                <div>
                  <div className="font-bold text-slate-800">Open in Chrome or Samsung Internet</div>
                  <div className="text-slate-500 mt-0.5">
                    Navigate to this app link on your Android browser.
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  2
                </div>
                <div>
                  <div className="font-bold text-slate-800">Tap Browser Menu (3 Dots ⋮)</div>
                  <div className="text-slate-500 mt-0.5">
                    Tap the three dots in the top right corner of Chrome and select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  3
                </div>
                <div>
                  <div className="font-bold text-slate-800">Tap Install to Confirm</div>
                  <div className="text-slate-500 mt-0.5">
                    ParserPro will be added directly to your Android Home Screen & App Drawer like a native app.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PWABuilder APK Generator Section */}
          <div className="border border-teal-200 bg-teal-50/60 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-teal-700" />
                <span>Package as .APK with PWABuilder</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                Manifest 100% Ready
              </span>
            </div>
            <p className="text-[11px] text-teal-800 leading-relaxed">
              The Web App Manifest (<code className="bg-white/80 px-1 py-0.5 rounded border border-teal-200 text-teal-900 font-mono">manifest.json</code>) has been generated with 192px/512px PNG icons, maskable icons, screenshots, and Service Worker caching for PWABuilder.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <a
                href={`https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(currentUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-lg transition-colors shadow-xs"
              >
                <span>Open in PWABuilder</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="/manifest.json"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs rounded-lg transition-colors border border-slate-300"
              >
                <span>View Manifest</span>
              </a>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium">
            {isAndroid ? '🤖 Android OS detected' : '📱 PWA Ready for Android & iOS'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
