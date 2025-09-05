import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { TerminalSession, SessionManager } from './SessionManager';
import { SessionNavigation } from './SessionNavigation';
import { SessionTabs } from './SessionTabs';

export interface SwipeableSessionContainerProps {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  onSessionSwitch: (sessionId: string) => void;
  onSessionCreate: () => void;
  onSessionClose: (sessionId: string) => void;
  onSessionReorder: (fromIndex: number, toIndex: number) => void;
  children: (session: TerminalSession) => React.ReactNode;
  className?: string;
  enableSwipeNavigation?: boolean;
  enableDragReorder?: boolean;
  showSessionTabs?: boolean;
  showSessionManager?: boolean;
  animationDuration?: number;
  swipeThreshold?: number;
}

export const SwipeableSessionContainer: React.FC<SwipeableSessionContainerProps> = ({
  sessions,
  activeSessionId,
  onSessionSwitch,
  onSessionCreate,
  onSessionClose,
  onSessionReorder,
  children,
  className,
  enableSwipeNavigation = true,
  enableDragReorder = true,
  showSessionTabs = true,
  showSessionManager = false,
  animationDuration = 300,
  swipeThreshold = 80
}) => {
  const [transitionState, setTransitionState] = useState<{
    isTransitioning: boolean;
    fromSessionId: string | null;
    toSessionId: string | null;
    direction: 'left' | 'right' | null;
    progress: number;
  }>({
    isTransitioning: false,
    fromSessionId: null,
    toSessionId: null,
    direction: null,
    progress: 0
  });

  const [swipeState, setSwipeState] = useState<{
    isActive: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    startTime: number;
    previewSessionId: string | null;
    direction: 'left' | 'right' | null;
  }>({
    isActive: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    startTime: 0,
    previewSessionId: null,
    direction: null
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);

  const activeIndex = sessions.findIndex(s => s.id === activeSessionId);
  const previewThreshold = 30;
  const velocityThreshold = 0.5; // pixels per ms

  // Handle session switch with smooth transition
  const handleSessionSwitch = useCallback((targetSessionId: string) => {
    if (targetSessionId === activeSessionId || transitionState.isTransitioning) return;
    
    const fromIndex = sessions.findIndex(s => s.id === activeSessionId);
    const toIndex = sessions.findIndex(s => s.id === targetSessionId);
    
    if (fromIndex === -1 || toIndex === -1) {
      onSessionSwitch(targetSessionId);
      return;
    }
    
    const direction = toIndex > fromIndex ? 'left' : 'right';
    
    setTransitionState({
      isTransitioning: true,
      fromSessionId: activeSessionId,
      toSessionId: targetSessionId,
      direction,
      progress: 0
    });
    
    // Animate the transition
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / animationDuration);
      
      // Easing function for smooth animation
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
      const easedProgress = easeOutCubic(progress);
      
      setTransitionState(prev => ({
        ...prev,
        progress: easedProgress
      }));
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Complete the transition
        onSessionSwitch(targetSessionId);
        setTransitionState({
          isTransitioning: false,
          fromSessionId: null,
          toSessionId: null,
          direction: null,
          progress: 0
        });
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
  }, [activeSessionId, sessions, transitionState.isTransitioning, animationDuration, onSessionSwitch]);

  // Handle touch start for swipe detection
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (!enableSwipeNavigation || sessions.length <= 1 || transitionState.isTransitioning) return;
    
    const touch = event.touches[0];
    setSwipeState({
      isActive: true,
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      startTime: Date.now(),
      previewSessionId: null,
      direction: null
    });
    
    // Cancel any ongoing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, [enableSwipeNavigation, sessions.length, transitionState.isTransitioning]);

  // Handle touch move for swipe preview
  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (!swipeState.isActive || !enableSwipeNavigation) return;
    
    const touch = event.touches[0];
    const deltaX = touch.clientX - swipeState.startX;
    const deltaY = touch.clientY - swipeState.startY;
    
    // Only handle horizontal swipes (ignore if more vertical than horizontal)
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    
    // Prevent default scrolling for horizontal swipes
    if (Math.abs(deltaX) > previewThreshold) {
      event.preventDefault();
    }
    
    setSwipeState(prev => ({
      ...prev,
      currentX: touch.clientX,
      currentY: touch.clientY
    }));
    
    // Determine preview session and direction
    let previewSessionId: string | null = null;
    let direction: 'left' | 'right' | null = null;
    
    if (deltaX > previewThreshold && activeIndex > 0) {
      // Swiping right (previous session)
      previewSessionId = sessions[activeIndex - 1].id;
      direction = 'right';
    } else if (deltaX < -previewThreshold && activeIndex < sessions.length - 1) {
      // Swiping left (next session)
      previewSessionId = sessions[activeIndex + 1].id;
      direction = 'left';
    }
    
    setSwipeState(prev => ({
      ...prev,
      previewSessionId,
      direction
    }));
  }, [swipeState.isActive, swipeState.startX, swipeState.startY, enableSwipeNavigation, activeIndex, sessions, previewThreshold]);

  // Handle touch end for swipe completion
  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    if (!swipeState.isActive || !enableSwipeNavigation) return;
    
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - swipeState.startX;
    const deltaY = touch.clientY - swipeState.startY;
    const timeDelta = Date.now() - swipeState.startTime;
    
    // Only handle horizontal swipes
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      setSwipeState(prev => ({ ...prev, isActive: false }));
      return;
    }
    
    // Calculate velocity
    const velocity = Math.abs(deltaX) / Math.max(timeDelta, 1);
    
    // Determine if swipe should trigger navigation
    const shouldNavigate = Math.abs(deltaX) >= swipeThreshold || velocity >= velocityThreshold;
    
    if (shouldNavigate && swipeState.previewSessionId) {
      handleSessionSwitch(swipeState.previewSessionId);
    }
    
    setSwipeState({
      isActive: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      startTime: 0,
      previewSessionId: null,
      direction: null
    });
  }, [swipeState, enableSwipeNavigation, swipeThreshold, velocityThreshold, handleSessionSwitch]);

  // Get transform style for session content
  const getSessionTransform = (sessionId: string) => {
    const isActive = sessionId === activeSessionId;
    const isPreview = sessionId === swipeState.previewSessionId;
    const isTransitionFrom = sessionId === transitionState.fromSessionId;
    const isTransitionTo = sessionId === transitionState.toSessionId;
    
    // Handle transition animation
    if (transitionState.isTransitioning && (isTransitionFrom || isTransitionTo)) {
      const progress = transitionState.progress;
      let translateX = 0;
      
      if (isTransitionFrom) {
        // Current session moves out
        translateX = transitionState.direction === 'left' ? -progress * 100 : progress * 100;
      } else if (isTransitionTo) {
        // New session moves in
        translateX = transitionState.direction === 'left' 
          ? (1 - progress) * 100 
          : -(1 - progress) * 100;
      }
      
      return {
        transform: `translateX(${translateX}%)`,
        transition: 'none'
      };
    }
    
    // Handle swipe preview
    if (swipeState.isActive && (isActive || isPreview)) {
      const deltaX = swipeState.currentX - swipeState.startX;
      const progress = Math.min(1, Math.abs(deltaX) / swipeThreshold);
      let translateX = 0;
      
      if (isActive) {
        // Current session follows swipe
        translateX = (deltaX / swipeThreshold) * 100;
      } else if (isPreview) {
        // Preview session slides in
        if (swipeState.direction === 'left') {
          translateX = (1 - progress) * 100;
        } else if (swipeState.direction === 'right') {
          translateX = -(1 - progress) * 100;
        }
      }
      
      return {
        transform: `translateX(${translateX}%)`,
        transition: 'none'
      };
    }
    
    // Default position
    return {
      transform: 'translateX(0%)',
      transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    };
  };

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const previewSession = sessions.find(s => s.id === swipeState.previewSessionId);

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Session Manager (optional) */}
      {showSessionManager && (
        <SessionManager
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSessionSwitch={handleSessionSwitch}
          onSessionCreate={onSessionCreate}
          onSessionClose={onSessionClose}
          onSessionReorder={onSessionReorder}
          enableSwipeNavigation={enableSwipeNavigation}
          enableDragReorder={enableDragReorder}
        />
      )}
      
      {/* Session Tabs (optional) */}
      {showSessionTabs && (
        <SessionTabs
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSessionSwitch={handleSessionSwitch}
          onSessionClose={onSessionClose}
          onSessionReorder={onSessionReorder}
          enableSwipeNavigation={enableSwipeNavigation}
          enableDragReorder={enableDragReorder}
        />
      )}
      
      {/* Session Content Container */}
      <div 
        ref={containerRef}
        className="relative flex-1 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div ref={contentRef} className="relative w-full h-full">
          {/* Active Session */}
          {activeSession && (
            <div
              className="absolute inset-0 w-full h-full"
              style={getSessionTransform(activeSession.id)}
            >
              {children(activeSession)}
            </div>
          )}
          
          {/* Preview Session (during swipe) */}
          {previewSession && swipeState.isActive && (
            <div
              className="absolute inset-0 w-full h-full"
              style={getSessionTransform(previewSession.id)}
            >
              {children(previewSession)}
            </div>
          )}
          
          {/* Transition Sessions */}
          {transitionState.isTransitioning && transitionState.toSessionId && (
            <div
              className="absolute inset-0 w-full h-full"
              style={getSessionTransform(transitionState.toSessionId)}
            >
              {children(sessions.find(s => s.id === transitionState.toSessionId)!)}
            </div>
          )}
        </div>
        
        {/* Swipe Progress Indicator */}
        {swipeState.isActive && swipeState.direction && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
            <div className={cn(
              'bg-background/90 backdrop-blur-sm border border-border rounded-lg px-3 py-2',
              'flex items-center gap-2 shadow-lg transition-opacity duration-200'
            )}>
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm font-medium">
                {swipeState.direction === 'left' ? '← ' : '→ '}
                {previewSession ? 
                  (previewSession.title || `Session ${previewSession.id.slice(-6)}`) : 
                  'Switch Session'
                }
              </span>
              <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-100"
                  style={{ 
                    width: `${Math.min(100, Math.abs(swipeState.currentX - swipeState.startX) / swipeThreshold * 100)}%` 
                  }}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Navigation Hints */}
        {!swipeState.isActive && !transitionState.isTransitioning && sessions.length > 1 && (
          <>
            {/* Left hint (previous session) */}
            {activeIndex > 0 && (
              <div className="absolute left-2 top-1/2 transform -translate-y-1/2 opacity-20 pointer-events-none">
                <div className="text-2xl text-muted-foreground">‹</div>
              </div>
            )}
            
            {/* Right hint (next session) */}
            {activeIndex < sessions.length - 1 && (
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-20 pointer-events-none">
                <div className="text-2xl text-muted-foreground">›</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};