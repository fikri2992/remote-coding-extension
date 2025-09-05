import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '../../lib/utils';

export interface TerminalSession {
  id: string;
  title: string;
  cwd: string;
  lastActivity: Date;
  isActive: boolean;
  status: 'active' | 'background' | 'disconnected';
  output?: string;
}

export interface SessionManagerProps {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  onSessionSwitch: (sessionId: string) => void;
  onSessionCreate: () => void;
  onSessionClose: (sessionId: string) => void;
  onSessionReorder: (fromIndex: number, toIndex: number) => void;
  className?: string;
  enableSwipeNavigation?: boolean;
  enableDragReorder?: boolean;
}

export const SessionManager: React.FC<SessionManagerProps> = ({
  sessions,
  activeSessionId,
  onSessionSwitch,
  onSessionCreate,
  onSessionClose,
  onSessionReorder,
  className,
  enableSwipeNavigation = true,
  enableDragReorder = true
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [swipePreview, setSwipePreview] = useState<{
    sessionId: string;
    direction: 'left' | 'right';
    progress: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; sessionId: string } | null>(null);
  const swipeThreshold = 50; // Minimum distance for swipe detection
  const previewThreshold = 20; // Distance to start showing preview

  // Handle touch start for swipe detection
  const handleTouchStart = useCallback((event: React.TouchEvent, sessionId: string) => {
    if (!enableSwipeNavigation) return;
    
    const touch = event.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      sessionId
    };
  }, [enableSwipeNavigation]);

  // Handle touch move for swipe preview
  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (!enableSwipeNavigation || !touchStartRef.current) return;
    
    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    
    // Only handle horizontal swipes
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    
    const currentIndex = sessions.findIndex(s => s.id === touchStartRef.current!.sessionId);
    if (currentIndex === -1) return;
    
    // Determine swipe direction and target session
    let targetIndex = -1;
    let direction: 'left' | 'right' | null = null;
    
    if (deltaX > previewThreshold && currentIndex > 0) {
      // Swiping right (previous session)
      targetIndex = currentIndex - 1;
      direction = 'right';
    } else if (deltaX < -previewThreshold && currentIndex < sessions.length - 1) {
      // Swiping left (next session)
      targetIndex = currentIndex + 1;
      direction = 'left';
    }
    
    if (targetIndex >= 0 && direction) {
      const progress = Math.min(1, Math.abs(deltaX) / swipeThreshold);
      setSwipePreview({
        sessionId: sessions[targetIndex].id,
        direction,
        progress
      });
    } else {
      setSwipePreview(null);
    }
  }, [enableSwipeNavigation, sessions, previewThreshold, swipeThreshold]);

  // Handle touch end for swipe completion
  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    if (!enableSwipeNavigation || !touchStartRef.current) return;
    
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    
    // Only handle horizontal swipes
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      touchStartRef.current = null;
      setSwipePreview(null);
      return;
    }
    
    const currentIndex = sessions.findIndex(s => s.id === touchStartRef.current!.sessionId);
    if (currentIndex === -1) {
      touchStartRef.current = null;
      setSwipePreview(null);
      return;
    }
    
    // Check if swipe distance exceeds threshold
    if (Math.abs(deltaX) >= swipeThreshold) {
      let targetIndex = -1;
      
      if (deltaX > 0 && currentIndex > 0) {
        // Swipe right (previous session)
        targetIndex = currentIndex - 1;
      } else if (deltaX < 0 && currentIndex < sessions.length - 1) {
        // Swipe left (next session)
        targetIndex = currentIndex + 1;
      }
      
      if (targetIndex >= 0) {
        onSessionSwitch(sessions[targetIndex].id);
      }
    }
    
    touchStartRef.current = null;
    setSwipePreview(null);
  }, [enableSwipeNavigation, sessions, swipeThreshold, onSessionSwitch]);

  // Handle drag start for reordering
  const handleDragStart = useCallback((event: React.DragEvent, index: number) => {
    if (!enableDragReorder) return;
    
    setDraggedIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', index.toString());
  }, [enableDragReorder]);

  // Handle drag over for reordering
  const handleDragOver = useCallback((event: React.DragEvent, index: number) => {
    if (!enableDragReorder || draggedIndex === null) return;
    
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, [enableDragReorder, draggedIndex]);

  // Handle drop for reordering
  const handleDrop = useCallback((event: React.DragEvent, index: number) => {
    if (!enableDragReorder || draggedIndex === null) return;
    
    event.preventDefault();
    
    if (draggedIndex !== index) {
      onSessionReorder(draggedIndex, index);
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [enableDragReorder, draggedIndex, onSessionReorder]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  // Get session status indicator
  const getStatusIndicator = (session: TerminalSession) => {
    switch (session.status) {
      case 'active':
        return <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />;
      case 'background':
        return <div className="w-2 h-2 bg-yellow-500 rounded-full" />;
      case 'disconnected':
        return <div className="w-2 h-2 bg-red-500 rounded-full" />;
      default:
        return <div className="w-2 h-2 bg-gray-400 rounded-full" />;
    }
  };

  // Format session title
  const formatSessionTitle = (session: TerminalSession) => {
    if (session.title && session.title !== session.id) {
      return session.title;
    }
    return `Session ${session.id.slice(-6)}`;
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        'relative flex items-center gap-2 p-2 bg-background border-b border-border overflow-x-auto',
        'scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent',
        className
      )}
    >
      {/* Session Tabs */}
      <div className="flex items-center gap-1 min-w-0 flex-1">
        {sessions.map((session, index) => (
          <div
            key={session.id}
            className={cn(
              'relative flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-all duration-200',
              'min-w-[120px] max-w-[200px] flex-shrink-0',
              'border border-transparent hover:border-border',
              session.id === activeSessionId
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted hover:bg-muted/80',
              draggedIndex === index && 'opacity-50 scale-95',
              dragOverIndex === index && draggedIndex !== null && 'border-primary border-dashed',
              swipePreview?.sessionId === session.id && 'ring-2 ring-primary ring-opacity-50'
            )}
            draggable={enableDragReorder}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onTouchStart={(e) => handleTouchStart(e, session.id)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={() => onSessionSwitch(session.id)}
          >
            {/* Status Indicator */}
            <div className="flex-shrink-0">
              {getStatusIndicator(session)}
            </div>
            
            {/* Session Info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {formatSessionTitle(session)}
              </div>
              <div className="text-xs opacity-70 truncate">
                {session.cwd}
              </div>
            </div>
            
            {/* Close Button */}
            <button
              className={cn(
                'flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center',
                'hover:bg-destructive hover:text-destructive-foreground transition-colors',
                'opacity-0 group-hover:opacity-100'
              )}
              onClick={(e) => {
                e.stopPropagation();
                onSessionClose(session.id);
              }}
            >
              <span className="text-xs">×</span>
            </button>
            
            {/* Swipe Preview Overlay */}
            {swipePreview?.sessionId === session.id && (
              <div 
                className={cn(
                  'absolute inset-0 bg-primary/20 rounded-md transition-opacity duration-150',
                  'flex items-center justify-center text-primary font-medium text-sm'
                )}
                style={{ opacity: swipePreview.progress }}
              >
                Switch to {formatSessionTitle(session)}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Add Session Button */}
      <button
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-md border border-dashed border-border',
          'flex items-center justify-center hover:border-primary hover:bg-primary/10',
          'transition-colors duration-200'
        )}
        onClick={onSessionCreate}
        title="Create new session"
      >
        <span className="text-lg">+</span>
      </button>
      
      {/* Swipe Indicator */}
      {swipePreview && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/20">
          <div 
            className="h-full bg-primary transition-all duration-150"
            style={{ width: `${swipePreview.progress * 100}%` }}
          />
        </div>
      )}
    </div>
  );
};