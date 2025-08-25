/**
 * Touch Gesture Service - Handles touch interactions and gestures
 */

export class TouchGestureService {
    constructor(stateManager, notificationService) {
        this.stateManager = stateManager;
        this.notificationService = notificationService;
        
        // Gesture state
        this.isTouch = false;
        this.touchStartTime = 0;
        this.touchStartPos = { x: 0, y: 0 };
        this.touchCurrentPos = { x: 0, y: 0 };
        this.longPressTimer = null;
        this.swipeThreshold = 50;
        this.longPressDelay = 500;
        this.tapTimeout = null;
        this.doubleTapDelay = 300;
        this.lastTap = 0;
        
        // Gesture recognition
        this.activeGestures = new Set();
        this.gestureHandlers = new Map();
        
        // Bind methods
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.handleTouchCancel = this.handleTouchCancel.bind(this);
        this.handleLongPress = this.handleLongPress.bind(this);
    }

    async initialize() {
        console.log('🤏 Initializing Touch Gesture Service...');
        
        // Detect touch capability
        this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        if (this.isTouch) {
            this.setupTouchListeners();
            this.setupGestureHandlers();
            document.body.classList.add('touch-device');
        }
        
        // Setup pointer events as fallback
        this.setupPointerEvents();
        
        console.log('✅ Touch Gesture Service initialized');
    }

    setupTouchListeners() {
        // Add touch event listeners to document
        document.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd, { passive: false });
        document.addEventListener('touchcancel', this.handleTouchCancel, { passive: false });
        
        // Prevent default touch behaviors on specific elements
        document.addEventListener('touchstart', (e) => {
            const target = e.target.closest('.prevent-touch-default');
            if (target) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    setupPointerEvents() {
        // Setup pointer events for better cross-device support
        if (window.PointerEvent) {
            document.addEventListener('pointerdown', this.handlePointerDown.bind(this));
            document.addEventListener('pointermove', this.handlePointerMove.bind(this));
            document.addEventListener('pointerup', this.handlePointerUp.bind(this));
            document.addEventListener('pointercancel', this.handlePointerCancel.bind(this));
        }
    }

    setupGestureHandlers() {
        // Register default gesture handlers
        this.registerGestureHandler('swipe-left', this.handleSwipeLeft.bind(this));
        this.registerGestureHandler('swipe-right', this.handleSwipeRight.bind(this));
        this.registerGestureHandler('swipe-up', this.handleSwipeUp.bind(this));
        this.registerGestureHandler('swipe-down', this.handleSwipeDown.bind(this));
        this.registerGestureHandler('long-press', this.handleLongPressGesture.bind(this));
        this.registerGestureHandler('double-tap', this.handleDoubleTap.bind(this));
        this.registerGestureHandler('pinch', this.handlePinch.bind(this));
    }

    registerGestureHandler(gestureType, handler) {
        this.gestureHandlers.set(gestureType, handler);
    }

    handleTouchStart(e) {
        const touch = e.touches[0];
        this.touchStartTime = Date.now();
        this.touchStartPos = { x: touch.clientX, y: touch.clientY };
        this.touchCurrentPos = { x: touch.clientX, y: touch.clientY };
        
        // Start long press timer
        this.longPressTimer = setTimeout(this.handleLongPress, this.longPressDelay);
        
        // Add touch feedback
        this.addTouchFeedback(e.target);
        
        // Emit touch start event
        this.emitGestureEvent('touch-start', {
            position: this.touchStartPos,
            target: e.target,
            timestamp: this.touchStartTime
        });
    }

    handleTouchMove(e) {
        if (e.touches.length === 0) return;
        
        const touch = e.touches[0];
        this.touchCurrentPos = { x: touch.clientX, y: touch.clientY };
        
        // Calculate movement
        const deltaX = this.touchCurrentPos.x - this.touchStartPos.x;
        const deltaY = this.touchCurrentPos.y - this.touchStartPos.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Cancel long press if moved too much
        if (distance > 10 && this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
        
        // Handle swipe indicators
        this.updateSwipeIndicators(deltaX, deltaY);
        
        // Emit touch move event
        this.emitGestureEvent('touch-move', {
            position: this.touchCurrentPos,
            delta: { x: deltaX, y: deltaY },
            distance,
            target: e.target
        });
        
        // Prevent scrolling for certain elements
        const target = e.target.closest('.prevent-scroll');
        if (target) {
            e.preventDefault();
        }
    }

    handleTouchEnd(e) {
        // Clear long press timer
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
        
        // Calculate gesture
        const deltaX = this.touchCurrentPos.x - this.touchStartPos.x;
        const deltaY = this.touchCurrentPos.y - this.touchStartPos.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const duration = Date.now() - this.touchStartTime;
        
        // Remove touch feedback
        this.removeTouchFeedback();
        
        // Determine gesture type
        if (distance < 10 && duration < 300) {
            // Tap gesture
            this.handleTap(e);
        } else if (distance > this.swipeThreshold) {
            // Swipe gesture
            this.handleSwipe(deltaX, deltaY, e);
        }
        
        // Clear swipe indicators
        this.clearSwipeIndicators();
        
        // Emit touch end event
        this.emitGestureEvent('touch-end', {
            position: this.touchCurrentPos,
            delta: { x: deltaX, y: deltaY },
            distance,
            duration,
            target: e.target
        });
    }

    handleTouchCancel(e) {
        // Clear timers
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
        
        // Remove feedback
        this.removeTouchFeedback();
        this.clearSwipeIndicators();
        
        // Emit cancel event
        this.emitGestureEvent('touch-cancel', {
            target: e.target
        });
    }

    handleTap(e) {
        const now = Date.now();
        const timeSinceLastTap = now - this.lastTap;
        
        if (timeSinceLastTap < this.doubleTapDelay) {
            // Double tap
            if (this.tapTimeout) {
                clearTimeout(this.tapTimeout);
                this.tapTimeout = null;
            }
            
            this.emitGestureEvent('double-tap', {
                position: this.touchCurrentPos,
                target: e.target
            });
            
            this.lastTap = 0; // Reset to prevent triple tap
        } else {
            // Single tap (with delay to detect double tap)
            this.tapTimeout = setTimeout(() => {
                this.emitGestureEvent('tap', {
                    position: this.touchCurrentPos,
                    target: e.target
                });
                this.tapTimeout = null;
            }, this.doubleTapDelay);
            
            this.lastTap = now;
        }
    }

    handleSwipe(deltaX, deltaY, e) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        
        let direction;
        if (absX > absY) {
            direction = deltaX > 0 ? 'right' : 'left';
        } else {
            direction = deltaY > 0 ? 'down' : 'up';
        }
        
        this.emitGestureEvent(`swipe-${direction}`, {
            delta: { x: deltaX, y: deltaY },
            direction,
            target: e.target
        });
    }

    handleLongPress() {
        this.emitGestureEvent('long-press', {
            position: this.touchStartPos,
            target: document.elementFromPoint(this.touchStartPos.x, this.touchStartPos.y)
        });
        
        // Add haptic feedback simulation
        this.simulateHapticFeedback('medium');
    }

    // Gesture handlers
    handleSwipeLeft(data) {
        const { target } = data;
        
        // Handle sidebar swipe
        if (target.closest('.main-content') && window.innerWidth <= 768) {
            this.stateManager.updateNavigation({ sidebarOpen: true });
        }
        
        // Handle navigation swipe
        if (target.closest('.chat-interface')) {
            // Could implement message navigation
        }
    }

    handleSwipeRight(data) {
        const { target } = data;
        
        // Handle sidebar close
        if (target.closest('.sidebar') && window.innerWidth <= 768) {
            this.stateManager.updateNavigation({ sidebarOpen: false });
        }
    }

    handleSwipeUp(data) {
        const { target } = data;
        
        // Handle pull-to-refresh
        if (target.closest('.message-history') && this.isAtTop(target)) {
            this.handlePullToRefresh();
        }
    }

    handleSwipeDown(data) {
        // Could implement additional down swipe actions
    }

    handleLongPressGesture(data) {
        const { target, position } = data;
        
        // Show context menu
        if (target.closest('.tree-item, .message, .prompt-item')) {
            this.showContextMenu(target, position);
        }
    }

    handleDoubleTap(data) {
        const { target } = data;
        
        // Handle double tap actions
        if (target.closest('.message')) {
            // Could implement message selection
        }
        
        if (target.closest('.tree-item')) {
            // Toggle folder expansion
            const treeItem = target.closest('.tree-item');
            const expandButton = treeItem.querySelector('.tree-item-expand');
            if (expandButton) {
                expandButton.click();
            }
        }
    }

    handlePinch(data) {
        // Handle pinch zoom for specific elements
        const { target } = data;
        
        if (target.closest('.code-block, .diff-viewer')) {
            // Could implement zoom functionality
        }
    }

    // Pointer event handlers (for cross-device support)
    handlePointerDown(e) {
        if (e.pointerType === 'touch') {
            // Handle as touch
            return;
        }
        
        // Handle mouse/pen input
        this.addTouchFeedback(e.target);
    }

    handlePointerMove(e) {
        // Handle pointer move
    }

    handlePointerUp(e) {
        this.removeTouchFeedback();
    }

    handlePointerCancel(e) {
        this.removeTouchFeedback();
    }

    // Utility methods
    addTouchFeedback(element) {
        const target = element.closest('.touch-feedback');
        if (target) {
            target.classList.add('touching');
        }
    }

    removeTouchFeedback() {
        const touchingElements = document.querySelectorAll('.touching');
        touchingElements.forEach(el => el.classList.remove('touching'));
    }

    updateSwipeIndicators(deltaX, deltaY) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        
        if (absX > absY && absX > 20) {
            // Horizontal swipe
            const indicator = deltaX > 0 ? 
                document.querySelector('.swipe-indicator.right') :
                document.querySelector('.swipe-indicator.left');
            
            if (indicator) {
                indicator.classList.add('visible');
            }
        }
    }

    clearSwipeIndicators() {
        const indicators = document.querySelectorAll('.swipe-indicator');
        indicators.forEach(indicator => indicator.classList.remove('visible'));
    }

    showContextMenu(target, position) {
        // Emit context menu event
        const event = new CustomEvent('show-context-menu', {
            detail: {
                target,
                position,
                source: 'touch'
            }
        });
        document.dispatchEvent(event);
    }

    handlePullToRefresh() {
        // Show pull-to-refresh indicator
        const indicator = document.querySelector('.pull-refresh-indicator');
        if (indicator) {
            indicator.classList.add('visible', 'loading');
            
            // Emit refresh event
            this.emitGestureEvent('pull-refresh', {});
            
            // Hide indicator after delay
            setTimeout(() => {
                indicator.classList.remove('visible', 'loading');
            }, 2000);
        }
    }

    isAtTop(element) {
        const scrollContainer = element.closest('.scroll-container');
        return scrollContainer ? scrollContainer.scrollTop === 0 : false;
    }

    simulateHapticFeedback(intensity = 'light') {
        // Simulate haptic feedback with visual cues
        document.body.classList.add(`haptic-${intensity}`);
        
        setTimeout(() => {
            document.body.classList.remove(`haptic-${intensity}`);
        }, intensity === 'light' ? 100 : intensity === 'medium' ? 150 : 200);
        
        // Use actual haptic feedback if available
        if (navigator.vibrate) {
            const pattern = {
                light: [10],
                medium: [20],
                heavy: [30, 10, 30]
            };
            navigator.vibrate(pattern[intensity] || pattern.light);
        }
    }

    emitGestureEvent(type, data) {
        const event = new CustomEvent(`gesture-${type}`, {
            detail: data,
            bubbles: true
        });
        
        if (data.target) {
            data.target.dispatchEvent(event);
        } else {
            document.dispatchEvent(event);
        }
    }

    // Public API
    enableGesture(gestureType) {
        this.activeGestures.add(gestureType);
    }

    disableGesture(gestureType) {
        this.activeGestures.delete(gestureType);
    }

    isGestureEnabled(gestureType) {
        return this.activeGestures.has(gestureType);
    }

    destroy() {
        // Clear timers
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
        }
        if (this.tapTimeout) {
            clearTimeout(this.tapTimeout);
        }
        
        // Remove event listeners
        document.removeEventListener('touchstart', this.handleTouchStart);
        document.removeEventListener('touchmove', this.handleTouchMove);
        document.removeEventListener('touchend', this.handleTouchEnd);
        document.removeEventListener('touchcancel', this.handleTouchCancel);
        
        // Clear gesture handlers
        this.gestureHandlers.clear();
        this.activeGestures.clear();
        
        console.log('🧹 Touch Gesture Service destroyed');
    }
}