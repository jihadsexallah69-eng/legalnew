import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Download, Copy, FileText, Check } from 'lucide-react';
import { Button, Input } from '../ui/Generic';
import { cn } from '../../lib/cn';
import { useAppStore } from '../../lib/store';

// Since we don't have HeadlessUI installed, we'll build a custom simple modal
interface ExportMemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportMemoModal: React.FC<ExportMemoModalProps> = ({ isOpen, onClose }) => {
  const { state } = useAppStore();
  const [template, setTemplate] = useState('refusal');
  const [sections, setSections] = useState({
    facts: true,
    issues: true,
    law: true,
    analysis: true,
    risks: false
  });
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentChat = state.chats.find(c => c.id === state.currentChatId);
  
  // Generate mock content
  const generatedContent = `MEMORANDUM
TO: Client File
FROM: RCIC
DATE: ${new Date().toLocaleDateString()}
RE: ${template === 'refusal' ? 'Refusal Rebuttal' : 'Application Assessment'}

${sections.facts ? 'FACTS\n[Summary of client facts based on chat...]\n\n' : ''}
${sections.issues ? 'ISSUES\nThe primary issue is the reasonableness of the officer\'s decision regarding...\n\n' : ''}
${sections.law ? 'LAW & JURISPRUDENCE\n' + state.activeCitations.map(c => `- ${c.caseName}, ${c.citation}`).join('\n') + '\n\n' : ''}
${sections.analysis ? 'ANALYSIS\n[Detailed analysis applying law to facts...]\n\n' : ''}
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b px-6 py-4 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="bg-blue-100 p-2 rounded-lg"><FileText className="h-5 w-5 text-blue-600" /></div>
            <h2 className="text-lg font-bold text-slate-800">Export Memo</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Settings Sidebar */}
          <div className="w-1/3 border-r bg-slate-50 p-6 space-y-6 overflow-y-auto">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Template</label>
              <div className="space-y-2">
                {['refusal', 'jr-assess', 'client-sum'].map(id => (
                  <button
                    key={id}
                    onClick={() => setTemplate(id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm transition-colors border",
                      template === id ? "bg-blue-50 border-blue-200 text-blue-700 font-medium" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {id === 'refusal' && 'Refusal Rebuttal'}
                    {id === 'jr-assess' && 'JR Assessment'}
                    {id === 'client-sum' && 'Client Summary'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Sections</label>
              <div className="space-y-2">
                {Object.keys(sections).map(key => (
                  <label key={key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={(sections as any)[key]} 
                      onChange={() => setSections(prev => ({ ...prev, [key]: !(prev as any)[key] }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="capitalize">{key}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 p-6 bg-white overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase">Preview</span>
            </div>
            <div className="flex-1 rounded-md border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-800 whitespace-pre-wrap overflow-y-auto shadow-inner">
              {generatedContent}
            </div>
          </div>
        </div>

        <div className="border-t p-4 bg-white flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" onClick={handleCopy} className="gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy Text'}
          </Button>
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Download className="h-4 w-4" /> Download .md
          </Button>
        </div>
      </div>
    </div>
  );
};