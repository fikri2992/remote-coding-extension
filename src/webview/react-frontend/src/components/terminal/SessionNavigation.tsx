import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { TerminalSession } from './SessionManager';

export interface SessionNavigationProps {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  onSessionSwitch: (sessionId: string) => void;
  className?: string;
  enableSwipeNavigation?: boolean;
  animationDuration?: number;
  swipeThreshold?: number;
}

export const SessionNavigation: React.FC<SessionNavigationProps> = ({
  sessions,
  activeSessionId,
  onSessionSwitch,
  className,
  enableSwipeNavigation = true,
  animationDuration = 300,
  swipeThreshold = 50
}) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<'left' | 'right' | null>(null);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [previewSession, setPreviewSession] = useState<TerminalSession | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; timestamp: number } | null>(null);
  const animationRef = useRef<number | null>(null);

  const activeIndex = sessions.findIndex(s => s.id === activeSessionId);

  // Handle touch start
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (!enableSwipeNavigation || isTransitioning) return;
    
    const touch = event.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    };
    
    // Cancel any ongoing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, [enableSwipeNavigation, isTransitioning]);

  // Handle touch move with smooth preview
  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (!enableSwipeNavigation || !touchStartRef.current || isTransitioning) return;
    
    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    
    // Only handle horizontal swipes
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    
    // Prevent default to avoid scrolling
    event.preventDefault();
    
    const progress = Math.min(1, Math.abs(deltaX) / swipeThreshold);
    setSwipeProgress(progress);
    
    // Determine preview session
    let targetIndex = -1;
    let direction: 'left' | 'right' | null = null;
    
    if (deltaX > 20 && activeIndex > 0) {
      // Swiping right (previous session)
      targetIndex = activeIndex - 1;
      direction = 'right';
    } else if (deltaX < -20 && activeIndex < sessions.length - 1) {
      // Swiping left (next session)
      targetIndex = activeIndex + 1;
      direction = 'left';
    }
    
    if (targetIndex >= 0 && direction) {
      setPreviewSession(sessions[targetIndex]);
      setTransitionDirection(direction);
    } else {
      setPreviewSession(null);
      setTransitionDirection(null);
    }
  }, [enableSwipeNavigation, isTransitioning, activeIndex, sessions, swipeThreshold]);

  // Handle touch end with smooth animation
  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    if (!enableSwipeNavigation || !touchStartRef.current) return;
    
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.changedTouches[0].clientY - touchStartRef.current.y;
    const timeDelta = Date.now() - touchStartRef.current.timestamp;
    
    // Only handle horizontal swipes
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      resetSwipeState();
      return;
    }
    
    // Calculate velocity for momentum-based switching
    const velocity = Math.abs(deltaX) / timeDelta; // pixels per ms
    const shouldSwitch = Math.abs(deltaX) >= swipeThreshold || velocity > 0.5;
    
    if (shouldSwitch && previewSession) {
      // Perform smooth transition to new session
      performSessionTransition(previewSession.id);
    } else {
      // Animate back to current session
      animateSwipeReset();
    }
    
    touchStartRef.current = null;
  }, [enableSwipeNavigation, swipeThreshold, previewSession]);

  // Perform smooth session transition
  const performSessionTransition = useCallback((targetSessionId: string) => {
    setIsTransitioning(true);
    
    // Animate the transition
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / animationDuration);
      
      // Easing function for smooth animation
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
      const easedProgress = easeOutCubic(progress);
      
      setSwipeProgress(1 - easedProgress);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Complete the transition
        onSessionSwitch(targetSessionId);
        resetSwipeState();
        setIsTransitioning(false);
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
  }, [animationDuration, onSessionSwitch]);

  // Animate swipe reset
  const animateSwipeReset = useCallback(() => {
    const startProgress = swipeProgress;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / (animationDuration / 2));
      
      // Easing function for smooth reset
      const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
      const easedProgress = easeOutQuad(progress);
      
      setSwipeProgress(startProgress * (1 - easedProgress));
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        resetSwipeState();
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
  }, [swipeProgress, animationDuration]);

  // Reset swipe state
  const resetSwipeState = useCallback(() => {
    setSwipeProgress(0);
    setPreviewSession(null);
    setTransitionDirection(null);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Get transform style for session container
  const getTransformStyle = (sessionId: string) => {
    if (!previewSession || !transitionDirection) return {};
    
    const isActive = sessionId === activeSessionId;
    const isPreview = sessionId === previewSession.id;
    
    if (!isActive && !isPreview) return { display: 'none' };
    
    let translateX = 0;
    
    if (isActive) {
      // Current session moves out
      translateX = transitionDirection === 'left' ? -swipeProgress * 100 : swipeProgress * 100;
    } else if (isPreview) {
      // Preview session moves in
      translateX = transitionDirection === 'left' 
        ? (1 - swipeProgress) * 100 
        : -(1 - swipeProgress) * 100;
    }
    
    return {
      transform: `translateX(${translateX}%)`,
      transition: isTransitioning ? `transform ${animationDuration}ms cubic-bezier(0.4, 0, 0.2, 1)` : 'none'
    };
  };

  // Get session preview info
  const getSessionPreviewInfo = (session: TerminalSession) => {
    const lastActivityTime = new Date(session.lastActivity).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    return {
      title: session.title || `Session ${session.id.slice(-6)}`,
      cwd: session.cwd,
      lastActivity: lastActivityTime,
      status: session.status
    };
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        'relative w-full h-full overflow-hidden',
        'touch-pan-y', // Allow vertical scrolling but handle horizontal swipes
        className
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Session Content Containers */}
      {sessions.map((session) => {
        const isVisible = session.id === activeSessionId || session.id === previewSession?.id;
        
        return (
          <div
            key={session.id}
            className={cn(
              'absolute inset-0 w-full h-full',
              !isVisible && 'hidden'
            )}
            style={getTransformStyle(session.id)}
          >
            {/* Session content would be rendered here */}
            <div className="w-full h-full bg-background">
              {/* This is where the actual terminal content would go */}
              <div className="p-4">
                <div className="text-sm text-muted-foreground mb-2">
                  {getSessionPreviewInfo(session).title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {getSessionPreviewInfo(session).cwd}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      
      {/* Swipe Progress Indicator */}
      {swipeProgress > 0 && previewSession && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className={cn(
            'bg-background/90 backdrop-blur-sm border border-border rounded-lg px-3 py-2',
            'flex items-center gap-2 shadow-lg'
          )}>
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-medium">
              {transitionDirection === 'left' ? '← ' : '→ '}
              {getSessionPreviewInfo(previewSession).title}
            </span>
            <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-100"
                style={{ width: `${swipeProgress * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Navigation Hints */}
      {!isTransitioning && sessions.length > 1 && (
        <>
          {/* Left hint */}
          {activeIndex > 0 && (
            <div className="absolute left-2 top-1/2 transform -translate-y-1/2 opacity-30 pointer-events-none">
              <div className="text-2xl">‹</div>
            </div>
          )}
          
          {/* Right hint */}
          {activeIndex < sessions.length - 1 && (
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-30 pointer-events-none">
              <div className="text-2xl">›</div>
            </div>
          )}
        </>
      )}
    </div>
  );
};