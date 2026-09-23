import React, { useState } from 'react';
import { Key, ShieldCheck, ExternalLink, X, Check, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { getActiveGeminiApiKey, setClientGeminiApiKey } from '../utils/geminiVision';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved?: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onKeySaved }) => {
  const currentKey = getActiveGeminiApiKey();
  const [apiKeyInput, setApiKeyInput] = useState(currentKey);
  const [showKey, setShowKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setErrorMsg('Please enter your Gemini API key, or clear it if you wish to remove it.');
      return;
    }

    if (!trimmed.startsWith('AIza')) {
      // Gentle warning for standard Google AI keys
      console.warn('[ApiKeyModal] Key does not start with AIza, continuing anyway.');
    }

    setClientGeminiApiKey(trimmed);
    setSavedSuccess(true);
    setErrorMsg(null);

    if (onKeySaved) {
      onKeySaved(trimmed);
    }

    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleClearKey = () => {
    setClientGeminiApiKey('');
    setApiKeyInput('');
    setSavedSuccess(true);
    setErrorMsg(null);
    if (onKeySaved) {
      onKeySaved('');
    }
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base leading-tight">Gemini AI OCR Key</h3>
              <p className="text-xs text-slate-400">Direct client-side receipt intelligence</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          ParserPro runs as a <strong>100% standalone static app</strong> on GitHub Pages. To scan receipts and extract line items without proxy servers, enter your Google Gemini API key below.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Google AI Studio API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => {
                  setApiKeyInput(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="AIzaSy..."
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {savedSuccess && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2 font-bold animate-pulse">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>API Key saved to browser storage!</span>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong>Secure Client-Side Storage:</strong> Your key is stored exclusively in your device's browser <code className="bg-slate-200 px-1 py-0.5 rounded text-[10px]">localStorage</code> and never sent to any intermediary server.
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-xs transition-colors shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Save Key</span>
              </button>
            </div>

            {currentKey && (
              <button
                type="button"
                onClick={handleClearKey}
                className="w-full py-1.5 text-slate-400 hover:text-rose-600 text-xs font-semibold transition-colors cursor-pointer text-center"
              >
                Remove / Clear Stored Key
              </button>
            )}
          </div>
        </form>

        <div className="pt-2 border-t border-slate-100 text-center">
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-bold hover:underline"
          >
            <span>Get a free Gemini API key from Google AI Studio</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
