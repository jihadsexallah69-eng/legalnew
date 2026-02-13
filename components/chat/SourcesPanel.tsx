import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../lib/store';
import { Badge } from '../ui/Generic.tsx';
import { ExternalLink, Quote, Library, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { cn } from '../../lib/cn';
import { CitationReference } from '../../lib/types';

const CitationCard: React.FC<{
  citation: CitationReference;
  isHighlighted: boolean;
  onOpen?: (citation: CitationReference) => void;
}> = ({ citation, isHighlighted, onOpen }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const buildTitle = (citation: any) => {
    const manual = citation.manual?.toString().trim();
    const chapter = citation.chapter?.toString().trim();
    const baseTitle = citation.title || citation.caseName || 'Source';
    const prefix = [manual, chapter].filter(Boolean).join(' ');
    if (prefix && typeof baseTitle === 'string' && baseTitle.startsWith(prefix)) {
      return baseTitle;
    }
    return [prefix, baseTitle].filter(Boolean).join(' ').trim();
  };

  const title = buildTitle(citation);

  // Helper to build the locator string
  const buildLocator = (citation: any) => {
      if (citation.locator && typeof citation.locator === 'string') {
        return citation.locator;
      }
      const parts: string[] = [];
      const manual = citation.manual?.toString().trim();
      const chapter = citation.chapter?.toString().trim();
      const manualChapter = [manual, chapter].filter(Boolean).join(' ');
      if (manualChapter) parts.push(manualChapter);
      if (citation.citation) parts.push(citation.citation);
      
      const pageStart = citation.pageStart;
      const pageEnd = citation.pageEnd;
      if (typeof pageStart === 'number' && typeof pageEnd === 'number') {
        parts.push(`pp. ${pageStart}-${pageEnd}`);
      } else if (typeof pageStart === 'number') {
        parts.push(`p. ${pageStart}`);
      }
      return parts.join(' | ');
  };

  const locator = buildLocator(citation);

  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-white dark:bg-slate-900 transition-all duration-300 overflow-hidden",
        isHighlighted ? "ring-2 ring-amber-400 ring-offset-2 border-amber-300 shadow-md dark:ring-amber-500 dark:ring-offset-slate-900 dark:border-amber-500" : "border-slate-200 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm",
        isExpanded ? "shadow-md ring-1 ring-slate-900/5 dark:ring-slate-100/5" : ""
      )}
    >
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="cursor-pointer p-3 flex flex-col gap-1.5"
      >
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
                <h3 className={cn(
                    "font-serif font-bold text-slate-800 dark:text-slate-100 leading-snug transition-colors group-hover:text-blue-700 dark:group-hover:text-blue-400",
                    isExpanded ? "text-sm" : "text-xs truncate"
                )}>
                    {title}
                </h3>
                {locator && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 truncate">
                        {locator}
                    </p>
                )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
                 {citation.relevanceScore && (
                     <span className={cn(
                         "text-[9px] font-bold px-1.5 py-0.5 rounded-full border",
                         citation.relevanceScore > 85 
                            ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800" 
                            : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-700"
                     )}>
                         {Math.round(citation.relevanceScore)}%
                     </span>
                 )}
                 {isExpanded ? <ChevronUp className="h-3 w-3 text-slate-400" /> : <ChevronDown className="h-3 w-3 text-slate-400" />}
            </div>
        </div>

        {/* Content Snippet */}
        {citation.snippet && (
            <div className={cn(
                "relative text-slate-600 dark:text-slate-300 font-serif leading-relaxed transition-all",
                isExpanded ? "text-xs mt-2 pl-3 border-l-2 border-amber-200 dark:border-amber-700" : "text-[11px] opacity-80 line-clamp-2"
            )}>
                {isExpanded ? (
                     <p className="max-h-40 overflow-y-auto pr-1 custom-scrollbar whitespace-pre-wrap break-words">"{citation.snippet}"</p>
                ) : (
                     <p className="opacity-70">"{citation.snippet}"</p>
                )}
            </div>
        )}
      </div>

      {/* Expanded Actions */}
      {isExpanded && (
          <div className="bg-slate-50 dark:bg-slate-800/50 px-3 py-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center animate-fade-in">
              <button
                onClick={(e) => {
                    e.stopPropagation();
                    if (citation.snippet) navigator.clipboard?.writeText(citation.snippet);
                }}
                className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors px-2 py-1 rounded hover:bg-white dark:hover:bg-slate-700"
              >
                  <Copy className="h-3 w-3" /> Copy Quote
              </button>
              
              <button
                onClick={(e) => {
                    e.stopPropagation();
                    if (citation.sourceUrl) window.open(citation.sourceUrl, '_blank', 'noopener,noreferrer');
                }}
                className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30"
              >
                  Read Source <ExternalLink className="h-3 w-3" />
              </button>
          </div>
      )}
    </div>
  );
};

export const SourcesPanel: React.FC<{
  onCloseMobile: () => void;
  onCitationOpen?: (citation: CitationReference) => void;
  isOverlayOpen?: boolean;
}> = ({ onCloseMobile, onCitationOpen, isOverlayOpen }) => {
  const { state } = useAppStore();
  const refs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    if (state.highlightedCitationId && refs.current[state.highlightedCitationId]) {
      refs.current[state.highlightedCitationId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [state.highlightedCitationId]);

  return (
    <div className="flex h-full flex-col bg-[#fdfdfd] dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-4 py-3 shrink-0 h-14">
        <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 uppercase tracking-wide">
          <Library className="h-3.5 w-3.5 text-amber-500" />
          Sources
        </h2>
        <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono text-[10px] h-5 px-1.5 border border-slate-200 dark:border-slate-700">
            {state.activeCitations.length}
        </Badge>
      </div>

      <div className={cn(
        "flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar transition-all duration-300",
        isOverlayOpen && "opacity-50 blur-[1px] pointer-events-none"
      )}>
        {state.activeCitations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 dark:text-slate-600 text-center">
            <div className="h-10 w-10 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center mb-3">
                <Quote className="h-4 w-4 opacity-40" />
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-500">No citations yet</p>
          </div>
        ) : (
          state.activeCitations.map((citation) => {
            const key = citation.id || citation.referenceId || citation.caseId;
            return (
            <div key={key} ref={(el) => refs.current[citation.caseId] = el}>
                <CitationCard 
                    citation={citation} 
                    isHighlighted={state.highlightedCitationId === citation.caseId}
                    onOpen={onCitationOpen}
                />
            </div>
          )})
        )}
      </div>
    </div>
  );
};
