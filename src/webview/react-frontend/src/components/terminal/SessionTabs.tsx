import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { TerminalSession } from './SessionManager';

export interface SessionTabsProps {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  onSessionSwitch: (sessionId: string) => void;
  onSessionClose: (sessionId: string) => void;
  onSessionReorder: (fromIndex: number, toIndex: number) => void;
  className?: string;
  enableSwipeNavigation?: boolean;
  enableDragReorder?: boolean;
  showCloseButtons?: boolean;
  maxTabWidth?: number;
  minTabWidth?: number;
}

export const SessionTabs: React.FC<SessionTabsProps> = ({
  sessions,
  activeSessionId,
  onSessionSwitch,
  onSessionClose,
  onSessionReorder,
  className,
  enableSwipeNavigation = true,
  enableDragReorder = true,
  showCloseButtons = true,
  maxTabWidth = 200,
  minTabWidth = 120
}) => {
  const [dragState, setDragState] = useState<{
    draggedIndex: number | null;
    dragOverIndex: number | null;
    dragOffset: { x: number; y: number };
  }>({
    draggedIndex: null,
    dragOverIndex: null,
    dragOffset: { x: 0, y: 0 }
  });

  const [swipeState, setSwipeState] = useState<{
    isActive: boolean;
    startX: number;
    currentX: number;
    targetIndex: number | null;
    direction: 'left' | 'right' | null;
  }>({
    isActive: false,
    startX: 0,
    currentX: 0,
    targetIndex: null,
    direction: null
  });

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLDivElement | null)[]>([]);
  const swipeThreshold = 60;
  const swipeVelocityThreshold = 0.3;

  // Get session status color
  const getStatusColor = (status: TerminalSession['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'background':
        return 'bg-yellow-500';
      case 'disconnected':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  // Format session title
  const formatSessionTitle = (session: TerminalSession) => {
    if (session.title && session.title !== session.id) {
      return session.title;
    }
    return `Session ${session.id.slice(-6)}`;
  };

  // Handle horizontal swipe navigation
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (!enableSwipeNavigation || sessions.length <= 1) return;
    
    const touch = event.touches[0];
    setSwipeState({
      isActive: true,
      startX: touch.clientX,
      currentX: touch.clientX,
      targetIndex: null,
      direction: null
    });
  }, [enableSwipeNavigation, sessions.length]);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (!swipeState.isActive || !enableSwipeNavigation) return;
    
    const touch = event.touches[0];
    const deltaX = touch.clientX - swipeState.startX;
    const currentIndex = sessions.findIndex(s => s.id === activeSessionId);
    
    if (currentIndex === -1) return;
    
    let targetIndex: number | null = null;
    let direction: 'left' | 'right' | null = null;
    
    // Determine swipe direction and target
    if (deltaX > 20 && currentIndex > 0) {
      // Swiping right (previous session)
      targetIndex = currentIndex - 1;
      direction = 'right';
    } else if (deltaX < -20 && currentIndex < sessions.length - 1) {
      // Swiping left (next session)
      targetIndex = currentIndex + 1;
      direction = 'left';
    }
    
    setSwipeState(prev => ({
      ...prev,
      currentX: touch.clientX,
      targetIndex,
      direction
    }));
    
    // Scroll to show target tab if needed
    if (targetIndex !== null && tabRefs.current[targetIndex]) {
      const targetTab = tabRefs.current[targetIndex];
      const container = tabsContainerRef.current;
      
      if (targetTab && container) {
        const tabRect = targetTab.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        if (tabRect.right > containerRect.right) {
          container.scrollLeft += tabRect.right - containerRect.right + 20;
        } else if (tabRect.left < containerRect.left) {
          container.scrollLeft -= containerRect.left - tabRect.left + 20;
        }
      }
    }
  }, [swipeState.isActive, swipeState.startX, enableSwipeNavigation, sessions, activeSessionId]);

  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    if (!swipeState.isActive || !enableSwipeNavigation) return;
    
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - swipeState.startX;
    const timeDelta = Date.now() - (event.timeStamp - 100); // Approximate touch duration
    const velocity = Math.abs(deltaX) / Math.max(timeDelta, 1);
    
    // Check if swipe should trigger navigation
    const shouldNavigate = Math.abs(deltaX) >= swipeThreshold || velocity >= swipeVelocityThreshold;
    
    if (shouldNavigate && swipeState.targetIndex !== null) {
      const targetSession = sessions[swipeState.targetIndex];
      if (targetSession) {
        onSessionSwitch(targetSession.id);
      }
    }
    
    setSwipeState({
      isActive: false,
      startX: 0,
      currentX: 0,
      targetIndex: null,
      direction: null
    });
  }, [swipeState, enableSwipeNavigation, swipeThreshold, swipeVelocityThreshold, sessions, onSessionSwitch]);

  // Handle drag and drop reordering
  const handleDragStart = useCallback((event: React.DragEvent, index: number) => {
    if (!enableDragReorder) return;
    
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    
    setDragState({
      draggedIndex: index,
      dragOverIndex: null,
      dragOffset: { x: offsetX, y: offsetY }
    });
    
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', index.toString());
    
    // Add drag image
    const dragImage = event.currentTarget.cloneNode(true) as HTMLElement;
    dragImage.style.opacity = '0.8';
    dragImage.style.transform = 'rotate(5deg)';
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, offsetX, offsetY);
    
    setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage);
      }
    }, 0);
  }, [enableDragReorder]);

  const handleDragOver = useCallback((event: React.DragEvent, index: number) => {
    if (!enableDragReorder || dragState.draggedIndex === null) return;
    
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    
    setDragState(prev => ({
      ...prev,
      dragOverIndex: index
    }));
  }, [enableDragReorder, dragState.draggedIndex]);

  const handleDrop = useCallback((event: React.DragEvent, index: number) => {
    if (!enableDragReorder || dragState.draggedIndex === null) return;
    
    event.preventDefault();
    
    if (dragState.draggedIndex !== index) {
      onSessionReorder(dragState.draggedIndex, index);
    }
    
    setDragState({
      draggedIndex: null,
      dragOverIndex: null,
      dragOffset: { x: 0, y: 0 }
    });
  }, [enableDragReorder, dragState.draggedIndex, onSessionReorder]);

  const handleDragEnd = useCallback(() => {
    setDragState({
      draggedIndex: null,
      dragOverIndex: null,
      dragOffset: { x: 0, y: 0 }
    });
  }, []);

  // Auto-scroll to active tab
  useEffect(() => {
    const activeIndex = sessions.findIndex(s => s.id === activeSessionId);
    if (activeIndex >= 0 && tabRefs.current[activeIndex] && tabsContainerRef.current) {
      const activeTab = tabRefs.current[activeIndex];
      const container = tabsContainerRef.current;
      
      const tabRect = activeTab.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      if (tabRect.right > containerRect.right || tabRect.left < containerRect.left) {
        activeTab.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest', 
          inline: 'center' 
        });
      }
    }
  }, [activeSessionId, sessions]);

  return (
    <div 
      className={cn(
        'relative flex items-center bg-background border-b border-border',
        'overflow-hidden', // Hide overflow for smooth scrolling
        className
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Scrollable tabs container */}
      <div 
        ref={tabsContainerRef}
        className={cn(
          'flex items-center gap-1 px-2 py-1 overflow-x-auto scrollbar-none',
          'scroll-smooth' // Smooth scrolling behavior
        )}
        style={{
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE/Edge
        }}
      >
        {sessions.map((session, index) => {
          const isActive = session.id === activeSessionId;
          const isDragged = dragState.draggedIndex === index;
          const isDragOver = dragState.dragOverIndex === index && dragState.draggedIndex !== null;
          const isSwipeTarget = swipeState.targetIndex === index;
          
          return (
            <div
              key={session.id}
              ref={(el) => { tabRefs.current[index] = el; }}
              className={cn(
                'relative flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer',
                'transition-all duration-200 select-none',
                'border border-transparent',
                // Size constraints
                'flex-shrink-0',
                // Active state
                isActive && 'bg-primary text-primary-foreground shadow-sm border-primary',
                // Inactive state
                !isActive && 'bg-muted hover:bg-muted/80 hover:border-border',
                // Drag states
                isDragged && 'opacity-50 scale-95 z-10',
                isDragOver && 'border-primary border-dashed bg-primary/10',
                // Swipe target highlight
                isSwipeTarget && 'ring-2 ring-primary ring-opacity-50',
                // Touch feedback
                'active:scale-95'
              )}
              style={{
                minWidth: `${minTabWidth}px`,
                maxWidth: `${maxTabWidth}px`,
                width: sessions.length > 4 ? `${Math.max(minTabWidth, 300 / sessions.length)}px` : 'auto'
              }}
              draggable={enableDragReorder}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => onSessionSwitch(session.id)}
            >
              {/* Status indicator */}
              <div className={cn(
                'w-2 h-2 rounded-full flex-shrink-0',
                getStatusColor(session.status),
                session.status === 'active' && 'animate-pulse'
              )} />
              
              {/* Session info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {formatSessionTitle(session)}
                </div>
                <div className="text-xs opacity-70 truncate">
                  {session.cwd}
                </div>
              </div>
              
              {/* Close button */}
              {showCloseButtons && (
                <button
                  className={cn(
                    'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center',
                    'hover:bg-destructive hover:text-destructive-foreground',
                    'transition-colors duration-200 opacity-0 group-hover:opacity-100',
                    'text-xs font-bold'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSessionClose(session.id);
                  }}
                  title="Close session"
                >
                  ×
                </button>
              )}
              
              {/* Drag handle indicator */}
              {enableDragReorder && (
                <div className={cn(
                  'absolute top-1 right-1 w-1 h-1 bg-current opacity-30',
                  'transition-opacity duration-200',
                  isDragged && 'opacity-100'
                )} />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Swipe progress indicator */}
      {swipeState.isActive && swipeState.direction && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/20">
          <div 
            className={cn(
              'h-full bg-primary transition-all duration-100',
              swipeState.direction === 'left' ? 'origin-left' : 'origin-right'
            )}
            style={{ 
              width: `${Math.min(100, Math.abs(swipeState.currentX - swipeState.startX) / swipeThreshold * 100)}%` 
            }}
          />
        </div>
      )}
      
      {/* Navigation hints for touch devices */}
      <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none opacity-50" />
      <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none opacity-50" />
    </div>
  );
};