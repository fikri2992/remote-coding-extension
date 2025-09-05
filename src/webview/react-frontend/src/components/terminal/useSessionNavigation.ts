import { useState, useCallback, useRef, useEffect } from 'react';
import { TerminalSession } from './SessionManager';

export interface SessionNavigationState {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  isTransitioning: boolean;
  transitionDirection: 'left' | 'right' | null;
}

export interface SessionNavigationActions {
  switchToSession: (sessionId: string) => void;
  createSession: (session?: Partial<TerminalSession>) => string;
  closeSession: (sessionId: string) => void;
  reorderSessions: (fromIndex: number, toIndex: number) => void;
  updateSession: (sessionId: string, updates: Partial<TerminalSession>) => void;
  switchToNextSession: () => void;
  switchToPreviousSession: () => void;
  getSessionById: (sessionId: string) => TerminalSession | undefined;
  getActiveSession: () => TerminalSession | undefined;
  getSessionIndex: (sessionId: string) => number;
}

export interface UseSessionNavigationOptions {
  initialSessions?: TerminalSession[];
  initialActiveSessionId?: string | null;
  maxSessions?: number;
  autoCreateFirstSession?: boolean;
  onSessionSwitch?: (fromSessionId: string | null, toSessionId: string) => void;
  onSessionCreate?: (session: TerminalSession) => void;
  onSessionClose?: (session: TerminalSession) => void;
  onSessionReorder?: (sessions: TerminalSession[]) => void;
}

export const useSessionNavigation = (options: UseSessionNavigationOptions = {}) => {
  const {
    initialSessions = [],
    initialActiveSessionId = null,
    maxSessions = 10,
    autoCreateFirstSession = true,
    onSessionSwitch,
    onSessionCreate,
    onSessionClose,
    onSessionReorder
  } = options;

  const [sessions, setSessions] = useState<TerminalSession[]>(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialActiveSessionId);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<'left' | 'right' | null>(null);
  
  const sessionIdCounter = useRef(1);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Generate unique session ID
  const generateSessionId = useCallback(() => {
    const timestamp = Date.now();
    const counter = sessionIdCounter.current++;
    return `session_${timestamp}_${counter}`;
  }, []);

  // Create a new session
  const createSession = useCallback((sessionData?: Partial<TerminalSession>): string => {
    if (sessions.length >= maxSessions) {
      console.warn(`Maximum number of sessions (${maxSessions}) reached`);
      return sessions[sessions.length - 1]?.id || '';
    }

    const sessionId = generateSessionId();
    const newSession: TerminalSession = {
      id: sessionId,
      title: `Session ${sessions.length + 1}`,
      cwd: '~',
      lastActivity: new Date(),
      isActive: false,
      status: 'active',
      ...sessionData
    };

    setSessions(prev => [...prev, newSession]);
    
    // Auto-switch to new session if no active session
    if (!activeSessionId) {
      setActiveSessionId(sessionId);
    }

    onSessionCreate?.(newSession);
    return sessionId;
  }, [sessions.length, maxSessions, generateSessionId, activeSessionId, onSessionCreate]);

  // Switch to a specific session
  const switchToSession = useCallback((sessionId: string) => {
    if (sessionId === activeSessionId || isTransitioning) return;

    const targetSession = sessions.find(s => s.id === sessionId);
    if (!targetSession) return;

    const currentIndex = sessions.findIndex(s => s.id === activeSessionId);
    const targetIndex = sessions.findIndex(s => s.id === sessionId);
    
    // Determine transition direction
    const direction = targetIndex > currentIndex ? 'left' : 'right';
    
    setIsTransitioning(true);
    setTransitionDirection(direction);
    
    // Clear any existing timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    
    // Update active session after a brief delay for animation
    transitionTimeoutRef.current = setTimeout(() => {
      const previousSessionId = activeSessionId;
      setActiveSessionId(sessionId);
      
      // Update session states
      setSessions(prev => prev.map(session => ({
        ...session,
        isActive: session.id === sessionId,
        lastActivity: session.id === sessionId ? new Date() : session.lastActivity
      })));
      
      onSessionSwitch?.(previousSessionId, sessionId);
      
      // Reset transition state
      setTimeout(() => {
        setIsTransitioning(false);
        setTransitionDirection(null);
      }, 50);
    }, 100);
  }, [activeSessionId, isTransitioning, sessions, onSessionSwitch]);

  // Close a session
  const closeSession = useCallback((sessionId: string) => {
    const sessionToClose = sessions.find(s => s.id === sessionId);
    if (!sessionToClose) return;

    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    const newSessions = sessions.filter(s => s.id !== sessionId);
    
    setSessions(newSessions);
    onSessionClose?.(sessionToClose);

    // Handle active session change if closing active session
    if (sessionId === activeSessionId) {
      if (newSessions.length === 0) {
        setActiveSessionId(null);
      } else {
        // Switch to adjacent session
        const newActiveIndex = Math.min(sessionIndex, newSessions.length - 1);
        const newActiveSession = newSessions[newActiveIndex];
        if (newActiveSession) {
          setActiveSessionId(newActiveSession.id);
          onSessionSwitch?.(sessionId, newActiveSession.id);
        }
      }
    }
  }, [sessions, activeSessionId, onSessionClose, onSessionSwitch]);

  // Reorder sessions
  const reorderSessions = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || 
        fromIndex >= sessions.length || toIndex >= sessions.length) {
      return;
    }

    const newSessions = [...sessions];
    const [movedSession] = newSessions.splice(fromIndex, 1);
    newSessions.splice(toIndex, 0, movedSession);
    
    setSessions(newSessions);
    onSessionReorder?.(newSessions);
  }, [sessions, onSessionReorder]);

  // Update session data
  const updateSession = useCallback((sessionId: string, updates: Partial<TerminalSession>) => {
    setSessions(prev => prev.map(session => 
      session.id === sessionId 
        ? { ...session, ...updates, lastActivity: new Date() }
        : session
    ));
  }, []);

  // Switch to next session
  const switchToNextSession = useCallback(() => {
    if (sessions.length <= 1) return;
    
    const currentIndex = sessions.findIndex(s => s.id === activeSessionId);
    const nextIndex = (currentIndex + 1) % sessions.length;
    const nextSession = sessions[nextIndex];
    
    if (nextSession) {
      switchToSession(nextSession.id);
    }
  }, [sessions, activeSessionId, switchToSession]);

  // Switch to previous session
  const switchToPreviousSession = useCallback(() => {
    if (sessions.length <= 1) return;
    
    const currentIndex = sessions.findIndex(s => s.id === activeSessionId);
    const prevIndex = currentIndex <= 0 ? sessions.length - 1 : currentIndex - 1;
    const prevSession = sessions[prevIndex];
    
    if (prevSession) {
      switchToSession(prevSession.id);
    }
  }, [sessions, activeSessionId, switchToSession]);

  // Get session by ID
  const getSessionById = useCallback((sessionId: string) => {
    return sessions.find(s => s.id === sessionId);
  }, [sessions]);

  // Get active session
  const getActiveSession = useCallback(() => {
    return activeSessionId ? getSessionById(activeSessionId) : undefined;
  }, [activeSessionId, getSessionById]);

  // Get session index
  const getSessionIndex = useCallback((sessionId: string) => {
    return sessions.findIndex(s => s.id === sessionId);
  }, [sessions]);

  // Auto-create first session if needed
  useEffect(() => {
    if (autoCreateFirstSession && sessions.length === 0) {
      createSession({
        title: 'Main Session',
        status: 'active'
      });
    }
  }, [autoCreateFirstSession, sessions.length, createSession]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  // Keyboard shortcuts for session navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + Tab: Next session
      if ((event.ctrlKey || event.metaKey) && event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault();
        switchToNextSession();
      }
      // Ctrl/Cmd + Shift + Tab: Previous session
      else if ((event.ctrlKey || event.metaKey) && event.key === 'Tab' && event.shiftKey) {
        event.preventDefault();
        switchToPreviousSession();
      }
      // Ctrl/Cmd + T: New session
      else if ((event.ctrlKey || event.metaKey) && event.key === 't') {
        event.preventDefault();
        const newSessionId = createSession();
        switchToSession(newSessionId);
      }
      // Ctrl/Cmd + W: Close current session
      else if ((event.ctrlKey || event.metaKey) && event.key === 'w' && activeSessionId) {
        event.preventDefault();
        closeSession(activeSessionId);
      }
      // Ctrl/Cmd + 1-9: Switch to session by number
      else if ((event.ctrlKey || event.metaKey) && /^[1-9]$/.test(event.key)) {
        event.preventDefault();
        const sessionIndex = parseInt(event.key) - 1;
        if (sessionIndex < sessions.length) {
          switchToSession(sessions[sessionIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [switchToNextSession, switchToPreviousSession, createSession, switchToSession, closeSession, activeSessionId, sessions]);

  const state: SessionNavigationState = {
    sessions,
    activeSessionId,
    isTransitioning,
    transitionDirection
  };

  const actions: SessionNavigationActions = {
    switchToSession,
    createSession,
    closeSession,
    reorderSessions,
    updateSession,
    switchToNextSession,
    switchToPreviousSession,
    getSessionById,
    getActiveSession,
    getSessionIndex
  };

  return { state, actions };
};