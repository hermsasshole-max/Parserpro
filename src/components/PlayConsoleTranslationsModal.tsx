import React, { useState } from 'react';
import { Check, Copy, Download, Globe, X } from 'lucide-react';
import {
  PLAY_CONSOLE_TRANSLATIONS,
  BULK_RELEASE_NOTES_ALL_17,
  BULK_RELEASE_NOTES_ZA_EN,
} from '../data/playConsoleTranslations';

interface PlayConsoleTranslationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalSection = 'downloads' | 'release-notes' | 'store-listing';
type ReleaseNotesPreset = 'za-en' | 'all-17' | 'en-us';

const DOWNLOAD_PACKAGES = [
  {
    id: 'app-strings',
    title: 'App UI Strings (.zip)',
    filename: 'play-console-app-strings.zip',
    href: './play-console-translations/play-console-app-strings.zip',
    targetPath: 'Grow · Translations · App strings · Upload translations',
    description:
      'Standard Android res/values-<locale>/strings.xml archive across 17 languages. Also compiled directly into your next .aab release.',
  },
  {
    id: 'csv',
    title: 'Store Listings Spreadsheet (.csv)',
    filename: 'play-console-store-listings.csv',
    href: './play-console-translations/play-console-store-listings.csv',
    targetPath: 'Google Sheets · Bulk Store Listing CSV Import',
    description:
      'UTF-8 CSV containing verified Title (≤30), Short Description (≤80), Full Description (≤4000), and Release Notes (≤500) for all 17 locales.',
  },
  {
    id: 'xliff',
    title: 'Store Listings & Strings XLIFF 1.2 (.zip)',
    filename: 'play-console-store-listings-xliff.zip',
    href: './play-console-translations/play-console-store-listings-xliff.zip',
    targetPath: 'XLIFF 1.2 (.xlf) Translation Services & CAT Tools',
    description:
      'Industry-standard XLIFF 1.2 files pairing en-US source units with translated target units for every Play Console locale.',
  },
  {
    id: 'fastlane',
    title: 'Fastlane & Play Publishing API Metadata (.zip)',
    filename: 'play-console-fastlane-metadata.zip',
    href: './play-console-translations/play-console-fastlane-metadata.zip',
    targetPath: 'metadata/android/<locale>/ · Fastlane supply · Gradle Play Publisher',
    description:
      'Ready-to-sync directory structure with title.txt, short_description.txt, full_description.txt, and changelogs/130.txt.',
  },
  {
    id: 'master-bundle',
    title: 'Complete Translations Master Bundle (.zip)',
    filename: 'play-console-translations-bundle.zip',
    href: './play-console-translations/play-console-translations-bundle.zip',
    targetPath: 'All Formats Combined · Includes Step-by-Step Guide',
    description:
      'Single download containing the Android strings ZIP, XLIFF ZIP, Fastlane ZIP, CSV spreadsheet, and multi-language release notes.',
  },
];

export const PlayConsoleTranslationsModal: React.FC<PlayConsoleTranslationsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeSection, setActiveSection] = useState<ModalSection>('downloads');
  const [selectedLocaleCode, setSelectedLocaleCode] = useState<string>('en-ZA');
  const [notesPreset, setNotesPreset] = useState<ReleaseNotesPreset>('za-en');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeLocale =
    PLAY_CONSOLE_TRANSLATIONS.find((item) => item.bcp47 === selectedLocaleCode) ||
    PLAY_CONSOLE_TRANSLATIONS[0];

  const enUsLocale = PLAY_CONSOLE_TRANSLATIONS[0];
  const singleEnUsReleaseNotes = `<en-US>\n${enUsLocale.releaseNotes}\n</en-US>`;

  const resolvedBulkReleaseNotes =
    notesPreset === 'all-17'
      ? BULK_RELEASE_NOTES_ALL_17
      : notesPreset === 'za-en'
      ? BULK_RELEASE_NOTES_ZA_EN
      : singleEnUsReleaseNotes;

  const handleCopyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2200);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2200);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full h-[90vh] sm:h-[86vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 truncate">
                Google Play Console Translations
              </h3>
              <p className="text-xs text-slate-500 truncate">
                17 verified BCP-47 locales · Strict character limits enforced · com.receiptscannerpro.app
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>

        {/* Segmented Control Bar */}
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-200/70 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveSection('downloads')}
              className={`min-h-[40px] px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap truncate ${
                activeSection === 'downloads'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Import Files (.zip / .csv)
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('release-notes')}
              className={`min-h-[40px] px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap truncate ${
                activeSection === 'release-notes'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Release Notes (&lt;lang&gt;)
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('store-listing')}
              className={`min-h-[40px] px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap truncate ${
                activeSection === 'store-listing'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Store Listing (17 Locales)
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-white">
          {activeSection === 'downloads' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-600 leading-relaxed">
                Download ready-to-import translation packages for Google Play Console. In addition to these files, all 17 localized <span className="font-mono text-slate-800">strings.xml</span> resources and <span className="font-mono text-slate-800">locales_config.xml</span> are embedded directly inside your Android App Bundle (<span className="font-mono text-slate-800">.aab</span>).
              </div>

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-2xl overflow-hidden">
                {DOWNLOAD_PACKAGES.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="text-sm font-bold text-slate-900">{pkg.title}</div>
                      <div className="text-xs text-emerald-700 font-medium">{pkg.targetPath}</div>
                      <p className="text-xs text-slate-500 leading-relaxed">{pkg.description}</p>
                    </div>

                    <a
                      href={pkg.href}
                      download={pkg.filename}
                      className="min-h-[44px] px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'release-notes' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-bold text-slate-900">
                  Single-Paste Multi-Language Release Notes
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Paste directly into <strong>Play Console → Testing / Production → Create release → Release notes</strong>. Google Play automatically imports each <span className="font-mono text-slate-800">&lt;language&gt;</span> block. Note: Play Console requires any language tags you paste here to be added under <em>Main store listing → Manage translations</em> first.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setNotesPreset('za-en')}
                    className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      notesPreset === 'za-en'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    SA &amp; English (5)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotesPreset('all-17')}
                    className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      notesPreset === 'all-17'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All 17 Locales
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotesPreset('en-us')}
                    className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      notesPreset === 'en-us'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    en-US Only
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyText('bulk-notes', resolvedBulkReleaseNotes)}
                    className="min-h-[44px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedKey === 'bulk-notes' ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Copied Release Notes</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy XML Block</span>
                      </>
                    )}
                  </button>

                  <a
                    href={
                      notesPreset === 'za-en'
                        ? './play-console-translations/play-console-release-notes-za-en.txt'
                        : './play-console-translations/play-console-release-notes.txt'
                    }
                    download={
                      notesPreset === 'za-en'
                        ? 'play-console-release-notes-za-en.txt'
                        : 'play-console-release-notes.txt'
                    }
                    className="min-h-[44px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download .txt</span>
                  </a>
                </div>
              </div>

              <pre className="p-4 rounded-2xl bg-slate-950 text-slate-100 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-[44vh]">
                {resolvedBulkReleaseNotes}
              </pre>
            </div>
          )}

          {activeSection === 'store-listing' && (
            <div className="space-y-5">
              {/* Language Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <label
                    htmlFor="play-locale-select"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Select Play Console Target Language
                  </label>
                  <p className="text-xs text-slate-500">
                    Code: <span className="font-mono text-slate-800">{activeLocale.bcp47}</span> · Android resource: <span className="font-mono text-slate-800">res/{activeLocale.androidDir}/strings.xml</span>
                  </p>
                </div>

                <select
                  id="play-locale-select"
                  value={selectedLocaleCode}
                  onChange={(e) => setSelectedLocaleCode(e.target.value)}
                  className="min-h-[44px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {PLAY_CONSOLE_TRANSLATIONS.map((item) => (
                    <option key={item.bcp47} value={item.bcp47}>
                      {item.name} ({item.bcp47}) — {item.nativeName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Field 1: App Title */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-slate-700">
                    App Title · <span className="font-mono tabular-nums text-slate-500">{activeLocale.title.length}/30 chars</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(`title-${activeLocale.bcp47}`, activeLocale.title)}
                    className="min-h-[40px] px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedKey === `title-${activeLocale.bcp47}` ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Title</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900">
                  {activeLocale.title}
                </div>
              </div>

              {/* Field 2: Short Description */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-slate-700">
                    Short Description · <span className="font-mono tabular-nums text-slate-500">{activeLocale.shortDescription.length}/80 chars</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(`short-${activeLocale.bcp47}`, activeLocale.shortDescription)
                    }
                    className="min-h-[40px] px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedKey === `short-${activeLocale.bcp47}` ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Short Description</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 leading-relaxed">
                  {activeLocale.shortDescription}
                </div>
              </div>

              {/* Field 3: Full Description */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-slate-700">
                    Full Description · <span className="font-mono tabular-nums text-slate-500">{activeLocale.fullDescription.length}/4000 chars</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(`full-${activeLocale.bcp47}`, activeLocale.fullDescription)
                    }
                    className="min-h-[40px] px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedKey === `full-${activeLocale.bcp47}` ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Full Description</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {activeLocale.fullDescription}
                </div>
              </div>

              {/* Field 4: Single-Language Release Notes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-slate-700">
                    Release Notes ({activeLocale.bcp47}) · <span className="font-mono tabular-nums text-slate-500">{activeLocale.releaseNotes.length}/500 chars</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(`notes-${activeLocale.bcp47}`, activeLocale.releaseNotes)
                    }
                    className="min-h-[40px] px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedKey === `notes-${activeLocale.bcp47}` ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Notes</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {activeLocale.releaseNotes}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
