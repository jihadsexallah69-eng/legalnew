import React, { useState, useEffect } from 'react';
import { MOCK_CASES } from '../data/mockCases';
import { Card, Input, Badge, Button } from '../components/ui/Generic';
import { Search, Filter, ChevronRight, X } from 'lucide-react';
import { api } from '../lib/api';
import { Case } from '../lib/types';
import { cn } from '../lib/cn';

export const CasesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [results, setResults] = useState(MOCK_CASES);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const doSearch = async () => {
      setIsSearching(true);
      const res = await api.searchCases({ query: searchTerm });
      setResults(res);
      setIsSearching(false);
    };

    const debounce = setTimeout(doSearch, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  return (
    <div className="flex h-full bg-slate-50/50 dark:bg-slate-950 transition-colors">
      <div className={cn("flex-1 flex flex-col transition-all", selectedCase ? "mr-[400px] hidden lg:flex" : "")}>
        <div className="p-8 pb-4">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Case Law Library</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-6">Search and filter key immigration jurisprudence.</p>
          
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500" 
                placeholder="Search by name, citation, or topic (e.g. 'study permit')..." 
              />
            </div>
            <Button variant="outline" className="gap-2 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800">
              <Filter className="h-4 w-4" /> Filters
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map(c => (
              <Card 
                key={c.id} 
                className="cursor-pointer hover:shadow-md transition-shadow group bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                onClick={() => setSelectedCase(c)}
              >
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="secondary" className="text-[10px] dark:bg-slate-800 dark:text-slate-300">{c.court}</Badge>
                    <span className="text-xs text-slate-400 font-mono">{c.year}</span>
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 leading-snug mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{c.name}</h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-3">{c.citation}</div>
                  <div className="flex flex-wrap gap-1 mt-auto">
                    {c.tags.slice(0, 3).map(t => (
                      <Badge key={t} variant="outline" className="text-[10px] bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">{t}</Badge>
                    ))}
                    {c.tags.length > 3 && <span className="text-[10px] text-slate-400 self-center">+{c.tags.length - 3}</span>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
          {results.length === 0 && (
            <div className="text-center py-12 text-slate-400">No cases found matching your criteria.</div>
          )}
        </div>
      </div>

      {/* Case Details Drawer */}
      <div className={cn(
        "fixed inset-y-0 right-0 z-40 w-full lg:w-[500px] bg-white dark:bg-slate-900 border-l dark:border-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col",
        selectedCase ? "translate-x-0" : "translate-x-full"
      )}>
        {selectedCase && (
          <>
            <div className="flex items-center justify-between border-b dark:border-slate-800 px-6 py-4">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-slate-100 text-lg leading-tight">{selectedCase.name}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-mono mt-1">{selectedCase.citation}</p>
              </div>
              <button onClick={() => setSelectedCase(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="mb-6">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide mb-2">Summary</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded border border-slate-100 dark:border-slate-800">{selectedCase.summary}</p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide mb-3">Key Paragraphs</h3>
                <div className="space-y-4">
                  {selectedCase.paragraphs.map(p => (
                    <div key={p.id} className="relative pl-6">
                      <span className="absolute left-0 top-0 text-xs font-bold text-blue-500 dark:text-blue-400 font-sans">{p.number}</span>
                      <p className="font-serif text-slate-800 dark:text-slate-200 leading-relaxed text-sm">
                        {p.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide mb-2">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedCase.tags.map(t => (
                    <Badge key={t} variant="secondary" className="dark:bg-slate-800 dark:text-slate-300">{t}</Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white">Cite this Case</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};