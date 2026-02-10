import React from 'react';
import { MessageSquare, Book, FileText, Settings, ShieldAlert, Scale, Plus, LogOut, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useAppStore } from '../../lib/store';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, isOpen, onCloseMobile, onLogout }) => {
  const { state, dispatch } = useAppStore();

  const handleNewChat = () => {
    dispatch({ type: 'NEW_CHAT' });
    onNavigate('chat');
    onCloseMobile();
  };

  const navItems = [
    { id: 'chat', label: 'Research Chat', icon: MessageSquare },
    { id: 'cases', label: 'Case Library', icon: Book },
    { id: 'memos', label: 'Saved Memos', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 w-72 bg-[#fdfdfd] border-r border-slate-200/60 text-slate-600 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col font-sans",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      {/* Brand Header */}
      <div className="h-20 flex items-center px-6 shrink-0">
        <div className="bg-slate-900 text-white p-1.5 rounded-lg mr-3 shadow-md shadow-slate-900/10">
          <Scale className="h-5 w-5" />
        </div>
        <span className="font-serif font-bold text-lg text-slate-900 tracking-tight">RCIC Assistant</span>
      </div>

      {/* New Chat Action */}
      <div className="px-4 mb-2">
        <button 
          onClick={handleNewChat}
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition-all hover:bg-black hover:shadow-xl hover:translate-y-[-1px] active:translate-y-[0px]"
        >
          <Plus className="h-4 w-4" /> 
          <span>New Research</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-4 overflow-y-auto">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 mb-3 mt-2">Menu</div>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => { onNavigate(item.id); onCloseMobile(); }}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 group",
              currentPage === item.id 
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" 
                : "text-slate-500 hover:bg-slate-100/60 hover:text-slate-900"
            )}
          >
            <div className="flex items-center gap-3">
                <item.icon className={cn("h-4 w-4 transition-colors", currentPage === item.id ? "text-amber-500" : "text-slate-400 group-hover:text-slate-600")} />
                {item.label}
            </div>
            {currentPage === item.id && <ChevronRight className="h-3 w-3 text-slate-300" />}
          </button>
        ))}
        
        {/* Recent Chats Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between px-4 mb-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent Sessions</div>
          </div>
          <div className="space-y-0.5">
            {state.chats.slice(0, 5).map(chat => (
              <button
                key={chat.id}
                onClick={() => { dispatch({ type: 'LOAD_CHAT', chatId: chat.id }); onNavigate('chat'); onCloseMobile(); }}
                className={cn(
                  "block w-full truncate rounded-lg px-4 py-2 text-left text-xs transition-colors",
                  state.currentChatId === chat.id ? "bg-slate-100 text-slate-900 font-medium" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                )}
              >
                {chat.title}
              </button>
            ))}
            {state.chats.length === 0 && (
                <div className="px-4 py-2 text-xs text-slate-300 italic">No recent history</div>
            )}
          </div>
        </div>
      </nav>

      {/* User / Footer */}
      <div className="border-t border-slate-200 p-4 bg-white/50 backdrop-blur-sm">
         <div className="group flex items-center justify-between p-2 rounded-xl hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-slate-200 transition-all cursor-pointer">
            <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-sm ring-2 ring-white">
                    JD
                </div>
                <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-bold text-slate-700 truncate">Jane Doe</p>
                    <p className="text-[10px] text-slate-400 truncate font-medium">PREMIUM PLAN</p>
                </div>
            </div>
            <button 
                onClick={onLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                title="Sign out"
            >
                <LogOut className="h-4 w-4" />
            </button>
         </div>
      </div>
    </aside>
  );
};