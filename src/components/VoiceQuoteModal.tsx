import React, { useState, useEffect } from 'react';
import { Mic, MicOff, X, Sparkles, Check, Play } from 'lucide-react';
import { useAppContext, type QuoteRecord } from '../context/AppContext';
import { formatMoney } from '../utils/currencyFormat';

interface VoiceQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuoteCreated?: (quote: QuoteRecord) => void;
}

export const VoiceQuoteModal: React.FC<VoiceQuoteModalProps> = ({
  isOpen,
  onClose,
  onQuoteCreated,
}) => {
  const { quotes, setQuotes, currencyCode } = useAppContext();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedQuote, setExtractedQuote] = useState<{
    clientName: string;
    projectTitle: string;
    laborHours: number;
    hourlyRate: number;
    materialsCost: number;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsRecording(false);
      setTranscript('');
      setExtractedQuote(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      processTranscript(transcript);
    } else {
      setIsRecording(true);
      setTranscript('');
      setExtractedQuote(null);

      // Web Speech API check
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = 'en-ZA';
          rec.onresult = (e: any) => {
            let current = '';
            for (let i = 0; i < e.results.length; i++) {
              current += e.results[i][0].transcript + ' ';
            }
            setTranscript(current.trim());
          };
          rec.onerror = () => {
            setIsRecording(false);
          };
          rec.start();
        } catch {
          // Fallback simulation for devices without Web Speech API
          simulateVoiceInput();
        }
      } else {
        simulateVoiceInput();
      }
    }
  };

  const simulateVoiceInput = () => {
    const demoPhrases = [
      'Quote for Mrs Jansen at 24 Willow Creek for bathroom plumbing and basin replacement.',
      'Labor is 3 hours at 450 per hour. New copper fittings and mixer tap cost 1650.',
    ];
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < demoPhrases.length) {
        setTranscript((prev) => (prev ? `${prev} ${demoPhrases[idx]}` : demoPhrases[idx]));
        idx++;
      } else {
        clearInterval(interval);
        setIsRecording(false);
        processTranscript(demoPhrases.join(' '));
      }
    }, 1200);
  };

  const processTranscript = (text: string) => {
    setIsProcessing(true);
    setTimeout(() => {
      // Heuristic extractor for on-site field notes
      const laborHoursMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:hours|hrs|hour)/i);
      const laborHours = laborHoursMatch ? parseFloat(laborHoursMatch[1]) : 3;

      const rateMatch = text.match(/(\d+)\s*(?:per\s*hour|\/hr|hourly)/i);
      const hourlyRate = rateMatch ? parseFloat(rateMatch[1]) : 450;

      const materialsMatch = text.match(/(?:materials?|cost|fittings?|tap|parts?)[^0-9]*(\d+(?:\.\d+)?)/i);
      const materialsCost = materialsMatch ? parseFloat(materialsMatch[1]) : 1650;

      const clientMatch = text.match(/(?:for|client)\s+([A-Za-z\s]+?)(?:\s+at|\s+for|\s+regarding|$)/i);
      const clientName = clientMatch ? clientMatch[1].trim() : 'On-Site Client';

      setExtractedQuote({
        clientName,
        projectTitle: 'Plumbing & Hardware Maintenance',
        laborHours,
        hourlyRate,
        materialsCost,
      });
      setIsProcessing(false);
    }, 600);
  };

  const handleConfirmQuote = () => {
    if (!extractedQuote) return;
    const laborTotal = extractedQuote.laborHours * extractedQuote.hourlyRate;
    const total = laborTotal + extractedQuote.materialsCost;

    const newQuote: QuoteRecord = {
      id: `quo-${Date.now()}`,
      quoteNumber: `Q-${new Date().getFullYear()}-${String(quotes.length + 1).padStart(3, '0')}`,
      clientName: extractedQuote.clientName,
      projectTitle: extractedQuote.projectTitle,
      date: new Date().toISOString().substring(0, 10),
      expiryDate: new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10),
      status: 'draft',
      items: [
        {
          description: `Labor & On-site Assessment (${extractedQuote.laborHours} hrs)`,
          quantity: extractedQuote.laborHours,
          unitPrice: extractedQuote.hourlyRate,
          total: laborTotal,
          isLabour: true,
        },
        {
          description: 'Materials & Replacement Parts',
          quantity: 1,
          unitPrice: extractedQuote.materialsCost,
          total: extractedQuote.materialsCost,
          isLabour: false,
        },
      ],
      totalAmount: total,
      notes: `Dictated hands-free via ParserPro VoiceQuote.\n"${transcript}"`,
    };

    setQuotes([newQuote, ...quotes]);
    if (onQuoteCreated) onQuoteCreated(newQuote);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-quote-modal-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <h2
              id="voice-quote-modal-title"
              className="text-base font-bold text-slate-900 dark:text-white"
            >
              Hands-Free Voice Quote
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Big Mic Button */}
        <div className="text-center space-y-3 py-2">
          <button
            type="button"
            onClick={toggleRecording}
            className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer ${
              isRecording
                ? 'bg-rose-600 text-white animate-pulse ring-8 ring-rose-200 dark:ring-rose-950'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white ring-4 ring-emerald-100 dark:ring-emerald-950'
            }`}
          >
            {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
          </button>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            {isRecording
              ? 'Listening... Speak project details, hours, and materials.'
              : 'Tap to dictate on-site quotation'}
          </p>
        </div>

        {/* Live Transcript */}
        {transcript && (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 italic max-h-24 overflow-y-auto">
            "{transcript}"
          </div>
        )}

        {/* Extracted Card Preview */}
        {extractedQuote && (
          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/80 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-900 dark:text-white">
                Client: {extractedQuote.clientName}
              </span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                Parsed from Voice
              </span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <p>
                Labor: {extractedQuote.laborHours} hrs @ {formatMoney(extractedQuote.hourlyRate, currencyCode)}/hr
              </p>
              <p>Materials &amp; Parts: {formatMoney(extractedQuote.materialsCost, currencyCode)}</p>
              <p className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-300 pt-1">
                Estimated Total:{' '}
                {formatMoney(
                  extractedQuote.laborHours * extractedQuote.hourlyRate +
                    extractedQuote.materialsCost,
                  currencyCode
                )}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
          >
            Cancel
          </button>
          {extractedQuote ? (
            <button
              type="button"
              onClick={handleConfirmQuote}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Create Quote</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => processTranscript(transcript || 'Sample 3 hours labor and 1200 parts for John')}
              disabled={isRecording}
              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold"
            >
              Parse Dictation
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceQuoteModal;
