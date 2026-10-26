import React, { useState } from 'react';
import { LandingPageData } from '../types/landingPage';
import { generateStandaloneHtml } from '../utils/htmlExporter';
import {
  Download,
  Copy,
  Check,
  Code2,
  ExternalLink,
  X,
  FileCode,
  Layers,
  Sparkles,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  pageData: LandingPageData;
  onImportJson?: (data: LandingPageData) => void;
}

export const ExportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  pageData,
  onImportJson,
}) => {
  const [activeTab, setActiveTab] = useState<'html' | 'json'>('html');
  const [copied, setCopied] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  if (!isOpen) return null;

  const htmlCode = generateStandaloneHtml(pageData);
  const jsonCode = JSON.stringify(pageData, null, 2);

  const handleCopy = () => {
    const textToCopy = activeTab === 'html' ? htmlCode : jsonCode;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename = activeTab === 'html' ? 'index.html' : 'landing-page-funnel.json';
    const content = activeTab === 'html' ? htmlCode : jsonCode;
    const mimeType = activeTab === 'html' ? 'text/html' : 'application/json';

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePreviewNewTab = () => {
    const blob = new Blob([htmlCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleApplyImport = () => {
    try {
      const parsed = JSON.parse(importJsonText);
      if (!parsed.blocks || !Array.isArray(parsed.blocks)) {
        throw new Error('Invalid landing page JSON structure.');
      }
      if (onImportJson) {
        onImportJson(parsed);
      }
      onClose();
    } catch (err: any) {
      setImportError(err.message || 'Invalid JSON format.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-3xl w-full flex flex-col max-h-[90vh] shadow-2xl border border-gray-100 overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <span>Export & Publish Engine</span>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase">
                  Production Ready
                </span>
              </h3>
              <p className="text-xs text-gray-500">
                Generate clean, ultra-fast single-file HTML or portable JSON state.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-gray-200 px-5 pt-3 gap-2 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('html')}
            className={`py-2 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'html'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Standalone HTML (Single File)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`py-2 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'json'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>JSON State & Import</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {activeTab === 'html' ? (
            <>
              {/* Feature Highlights Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                  <span className="font-black block mb-0.5">🚀 0 Dependencies</span>
                  <span className="text-[11px] text-emerald-700">Pure HTML + Tailwind CDN + Vanilla JS.</span>
                </div>
                <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900">
                  <span className="font-black block mb-0.5">💵 Built-in COD Engine</span>
                  <span className="text-[11px] text-indigo-700">Live bundle logic & order confirmation.</span>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
                  <span className="font-black block mb-0.5">🌐 Host Anywhere</span>
                  <span className="text-[11px] text-amber-700">Cloudflare Pages, Vercel, Netlify, or cPanel.</span>
                </div>
              </div>

              {/* Code Snippet Box */}
              <div className="relative rounded-2xl bg-gray-950 text-gray-200 p-4 font-mono text-xs overflow-x-auto max-h-72 border border-gray-800">
                <pre>{htmlCode}</pre>
              </div>
            </>
          ) : (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Exported JSON Funnel State
                </label>
                <div className="relative rounded-2xl bg-gray-950 text-gray-200 p-4 font-mono text-xs overflow-x-auto max-h-48 border border-gray-800">
                  <pre>{jsonCode}</pre>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200">
                <label className="block font-bold text-gray-700 mb-1">
                  Import Funnel JSON:
                </label>
                <textarea
                  rows={4}
                  value={importJsonText}
                  onChange={(e) => {
                    setImportJsonText(e.target.value);
                    setImportError(null);
                  }}
                  placeholder="Paste previously exported Landing Page JSON here..."
                  className="w-full p-3 rounded-xl border border-gray-300 font-mono text-xs focus:ring-2 focus:ring-emerald-500"
                />
                {importError && (
                  <p className="text-red-500 text-[11px] font-bold mt-1">{importError}</p>
                )}
                <button
                  type="button"
                  onClick={handleApplyImport}
                  disabled={!importJsonText.trim()}
                  className="mt-2 py-2 px-4 bg-gray-900 hover:bg-black text-white font-bold rounded-xl disabled:opacity-30 transition"
                >
                  Import & Apply to Canvas
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {activeTab === 'html' && (
              <button
                type="button"
                onClick={handlePreviewNewTab}
                className="py-2.5 px-4 bg-white border border-gray-300 hover:bg-gray-100 rounded-xl font-bold text-xs text-gray-700 flex items-center gap-1.5 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Preview Standalone</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopy}
              className="py-2.5 px-4 bg-white border border-gray-300 hover:bg-gray-100 rounded-xl font-bold text-xs text-gray-700 flex items-center gap-1.5 transition"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-black">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy to Clipboard</span>
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownload}
            className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-lg transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Download {activeTab === 'html' ? 'index.html' : 'funnel.json'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
