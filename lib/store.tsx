import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { ChatSession, Message, CitationReference } from './types';
import { api } from './api';

interface AppState {
  currentChatId: string | null;
  chats: ChatSession[];
  activeCitations: CitationReference[];
  highlightedCitationId: string | null; // The ID of the citation currently highlighted (e.g. from user click)
  isSourcesPanelOpen: boolean;
  disclaimerAccepted: boolean;
  theme: 'light' | 'dark' | 'system';
}

type Action =
  | { type: 'NEW_CHAT'; chatId?: string }
  | { type: 'START_CHAT'; chatId: string; initialMessage: Message }
  | { type: 'REKEY_CURRENT_CHAT'; newChatId: string }
  | { type: 'LOAD_CHAT'; chatId: string }
  | { type: 'ADD_MESSAGE'; message: Message }
  | { type: 'SET_CHATS'; chats: ChatSession[] }
  | { type: 'SET_CITATIONS'; citations: CitationReference[] }
  | { type: 'HIGHLIGHT_CITATION'; caseId: string | null }
  | { type: 'TOGGLE_SOURCES_PANEL' }
  | { type: 'ACCEPT_DISCLAIMER' }
  | { type: 'SET_THEME'; theme: 'light' | 'dark' | 'system' }
  | { type: 'RESTORE_STATE'; state: AppState };

const initialState: AppState = {
  currentChatId: null,
  chats: [],
  activeCitations: [],
  highlightedCitationId: null,
  isSourcesPanelOpen: true,
  disclaimerAccepted: false,
  theme: 'system',
};

const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action> }>({
  state: initialState,
  dispatch: () => null,
});

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'NEW_CHAT': {
      const nextId = action.chatId || (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString());
      const newChat: ChatSession = {
        id: nextId,
        title: 'New Case Research',
        lastModified: Date.now(),
        messages: [],
      };
      return {
        ...state,
        chats: [newChat, ...state.chats],
        currentChatId: newChat.id,
        activeCitations: [],
        highlightedCitationId: null,
      };
    }
    case 'START_CHAT': {
      const newChat: ChatSession = {
        id: action.chatId,
        title: action.initialMessage.content.slice(0, 40) + (action.initialMessage.content.length > 40 ? '...' : ''),
        lastModified: Date.now(),
        messages: [action.initialMessage],
      };
      return {
        ...state,
        chats: [newChat, ...state.chats],
        currentChatId: newChat.id,
        activeCitations: [],
        highlightedCitationId: null,
      };
    }
    case 'REKEY_CURRENT_CHAT': {
      if (!state.currentChatId || !action.newChatId || action.newChatId === state.currentChatId) {
        return state;
      }

      const current = state.chats.find((c) => c.id === state.currentChatId);
      if (!current) return state;

      const existing = state.chats.find((c) => c.id === action.newChatId);
      let rekeyedChats: ChatSession[];

      if (existing) {
        const mergedMessages = [...existing.messages, ...current.messages]
          .filter((msg, idx, arr) => arr.findIndex((m) => m.id === msg.id) === idx)
          .sort((a, b) => a.timestamp - b.timestamp);

        rekeyedChats = state.chats.map((chat) => (
          chat.id === action.newChatId
            ? {
                ...chat,
                messages: mergedMessages,
                lastModified: Math.max(chat.lastModified, current.lastModified),
              }
            : chat
        )).filter((chat) => chat.id !== state.currentChatId);
      } else {
        rekeyedChats = state.chats.map((chat) => (
          chat.id === state.currentChatId
            ? { ...chat, id: action.newChatId }
            : chat
        ));
      }

      return {
        ...state,
        chats: rekeyedChats,
        currentChatId: action.newChatId,
      };
    }
    case 'LOAD_CHAT': {
      const chat = state.chats.find(c => c.id === action.chatId);
      // Collect all citations from this chat history to populate the panel
      const allCitations = chat 
        ? chat.messages.flatMap(m => m.citations || []) 
        : [];
        
      // Deduplicate citations by stable source reference (fallback to caseId)
      const uniqueCitations = Array.from(
        new Map(
          allCitations.map((item) => [item.id || item.referenceId || item.caseId, item])
        ).values()
      );

      return {
        ...state,
        currentChatId: action.chatId,
        activeCitations: uniqueCitations,
        highlightedCitationId: null,
      };
    }
    case 'ADD_MESSAGE': {
      if (!state.currentChatId) return state;
      
      const updatedChats = state.chats.map(chat => {
        if (chat.id === state.currentChatId) {
          return {
            ...chat,
            messages: [...chat.messages, action.message],
            lastModified: Date.now(),
            // Update title if it's the first user message
            title: chat.messages.length === 0 && action.message.role === 'user' 
              ? action.message.content.slice(0, 30) + (action.message.content.length > 30 ? '...' : '') 
              : chat.title
          };
        }
        return chat;
      });

      return {
        ...state,
        chats: updatedChats,
      };
    }
    case 'SET_CHATS': {
      const chatIdSet = new Set(action.chats.map((c) => c.id));
      const keepCurrent = state.currentChatId && chatIdSet.has(state.currentChatId) ? state.currentChatId : null;
      return {
        ...state,
        chats: action.chats,
        currentChatId: keepCurrent,
        activeCitations: keepCurrent
          ? state.activeCitations
          : [],
        highlightedCitationId: null,
      };
    }
    case 'SET_CITATIONS': {
      return {
        ...state,
        activeCitations: action.citations,
      };
    }
    case 'HIGHLIGHT_CITATION':
      return { ...state, highlightedCitationId: action.caseId, isSourcesPanelOpen: true };
    case 'TOGGLE_SOURCES_PANEL':
      return { ...state, isSourcesPanelOpen: !state.isSourcesPanelOpen };
    case 'ACCEPT_DISCLAIMER':
      return { ...state, disclaimerAccepted: true };
    case 'SET_THEME':
      return { ...state, theme: action.theme };
    case 'RESTORE_STATE':
      return action.state;
    default:
      return state;
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem('rcic-app-state');
    let savedChats: ChatSession[] = [];
    let savedDisclaimerAccepted = false;
    let savedTheme: 'light' | 'dark' | 'system' = 'system';
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        savedChats = Array.isArray(parsed.chats) ? parsed.chats : [];
        savedDisclaimerAccepted = Boolean(parsed.disclaimerAccepted);
        savedTheme = parsed.theme || 'system';
      } catch (e) {
        console.error("Failed to load local state", e);
      }
    }

    dispatch({
      type: 'RESTORE_STATE',
      state: {
        ...initialState,
        chats: savedChats,
        disclaimerAccepted: savedDisclaimerAccepted,
        theme: savedTheme,
      }
    });

    let alive = true;
    (async () => {
      const history = await api.loadHistory();
      if (!alive || !Array.isArray(history) || history.length === 0) return;
      dispatch({ type: 'SET_CHATS', chats: history });
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('rcic-app-state', JSON.stringify({
      chats: state.chats,
      disclaimerAccepted: state.disclaimerAccepted,
      theme: state.theme
    }));
  }, [state.chats, state.disclaimerAccepted, state.theme]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = () => useContext(AppContext);
