import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { ChatSession, Message, CitationReference } from './types';

interface AppState {
  currentChatId: string | null;
  chats: ChatSession[];
  activeCitations: CitationReference[];
  highlightedCitationId: string | null; // The ID of the citation currently highlighted (e.g. from user click)
  isSourcesPanelOpen: boolean;
  disclaimerAccepted: boolean;
}

type Action =
  | { type: 'NEW_CHAT' }
  | { type: 'START_CHAT'; chatId: string; initialMessage: Message }
  | { type: 'LOAD_CHAT'; chatId: string }
  | { type: 'ADD_MESSAGE'; message: Message }
  | { type: 'SET_CITATIONS'; citations: CitationReference[] }
  | { type: 'HIGHLIGHT_CITATION'; caseId: string | null }
  | { type: 'TOGGLE_SOURCES_PANEL' }
  | { type: 'ACCEPT_DISCLAIMER' }
  | { type: 'RESTORE_STATE'; state: AppState };

const initialState: AppState = {
  currentChatId: null,
  chats: [],
  activeCitations: [],
  highlightedCitationId: null,
  isSourcesPanelOpen: true,
  disclaimerAccepted: false,
};

const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action> }>({
  state: initialState,
  dispatch: () => null,
});

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'NEW_CHAT': {
      const newChat: ChatSession = {
        id: Date.now().toString(),
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
    case 'LOAD_CHAT': {
      const chat = state.chats.find(c => c.id === action.chatId);
      // Collect all citations from this chat history to populate the panel
      const allCitations = chat 
        ? chat.messages.flatMap(m => m.citations || []) 
        : [];
        
      // Deduplicate citations by caseId
      const uniqueCitations = Array.from(new Map(allCitations.map(item => [item.caseId, item])).values());

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
    case 'SET_CITATIONS': {
      // Merge new citations with existing ones, avoiding duplicates
      const existingIds = new Set(state.activeCitations.map(c => c.caseId));
      const newUnique = action.citations.filter(c => !existingIds.has(c.caseId));
      return {
        ...state,
        activeCitations: [...state.activeCitations, ...newUnique],
      };
    }
    case 'HIGHLIGHT_CITATION':
      return { ...state, highlightedCitationId: action.caseId, isSourcesPanelOpen: true };
    case 'TOGGLE_SOURCES_PANEL':
      return { ...state, isSourcesPanelOpen: !state.isSourcesPanelOpen };
    case 'ACCEPT_DISCLAIMER':
      return { ...state, disclaimerAccepted: true };
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
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // We only really want to restore chats and disclaimer status, not ephemeral UI state
        dispatch({ 
          type: 'RESTORE_STATE', 
          state: { 
            ...initialState, 
            chats: parsed.chats || [], 
            disclaimerAccepted: parsed.disclaimerAccepted || false 
          } 
        });
      } catch (e) {
        console.error("Failed to load state", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('rcic-app-state', JSON.stringify({
      chats: state.chats,
      disclaimerAccepted: state.disclaimerAccepted
    }));
  }, [state.chats, state.disclaimerAccepted]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = () => useContext(AppContext);