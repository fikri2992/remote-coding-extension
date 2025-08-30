/**
 * Utility functions for gesture-based animations and CSS transforms
 */

export interface AnimationOptions {
  duration?: number
  easing?: string
  delay?: number
  fillMode?: 'none' | 'forwards' | 'backwards' | 'both'
}

export interface TransformOptions {
  translateX?: number
  translateY?: number
  scale?: number
  rotate?: number
  opacity?: number
}

/**
 * Apply CSS transform to an element with optional animation
 */
export function applyTransform(
  element: HTMLElement,
  transforms: TransformOptions,
  animate: boolean = false,
  options: AnimationOptions = {}
): void {
  const {
    duration = 300,
    easing = 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    delay = 0,
    fillMode = 'forwards'
  } = options

  // Build transform string
  const transformParts: string[] = []
  
  if (transforms.translateX !== undefined) {
    transformParts.push(`translateX(${transforms.translateX}px)`)
  }
  
  if (transforms.translateY !== undefined) {
    transformParts.push(`translateY(${transforms.translateY}px)`)
  }
  
  if (transforms.scale !== undefined) {
    transformParts.push(`scale(${transforms.scale})`)
  }
  
  if (transforms.rotate !== undefined) {
    transformParts.push(`rotate(${transforms.rotate}deg)`)
  }

  const transformString = transformParts.join(' ')

  if (animate) {
    // Apply transition
    element.style.transition = `transform ${duration}ms ${easing} ${delay}ms, opacity ${duration}ms ${easing} ${delay}ms`
    ;(element.style as any).transitionFillMode = fillMode
  } else {
    // Remove transition for immediate application
    element.style.transition = 'none'
  }

  // Apply transforms
  element.style.transform = transformString
  
  if (transforms.opacity !== undefined) {
    element.style.opacity = transforms.opacity.toString()
  }
}

/**
 * Reset element transforms and styles
 */
export function resetTransform(element: HTMLElement, animate: boolean = true): void {
  if (animate) {
    applyTransform(element, {
      translateX: 0,
      translateY: 0,
      scale: 1,
      rotate: 0,
      opacity: 1
    }, true)
  } else {
    element.style.transform = ''
    element.style.opacity = ''
    element.style.transition = ''
  }
}

/**
 * Create elastic pull animation for pull-to-refresh
 */
export function createElasticPullAnimation(
  element: HTMLElement,
  distance: number,
  maxDistance: number,
  elasticity: number = 0.5
): void {
  // Apply elastic resistance
  const elasticDistance = distance * (1 - Math.min(distance / maxDistance, 1) * elasticity)
  
  applyTransform(element, {
    translateY: elasticDistance
  }, false)
}

/**
 * Animate element back to original position
 */
export function animateSnapBack(
  element: HTMLElement,
  duration: number = 300,
  onComplete?: () => void
): void {
  applyTransform(element, {
    translateX: 0,
    translateY: 0,
    scale: 1,
    opacity: 1
  }, true, { duration })

  if (onComplete) {
    setTimeout(onComplete, duration)
  }
}

/**
 * Create swipe reveal animation for file actions
 */
export function animateSwipeReveal(
  element: HTMLElement,
  direction: 'left' | 'right',
  distance: number,
  animate: boolean = true
): void {
  const translateX = direction === 'left' ? -distance : distance
  
  applyTransform(element, {
    translateX
  }, animate, {
    duration: animate ? 250 : 0,
    easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
  })
}

/**
 * Create scale animation for pinch gestures
 */
export function animateScale(
  element: HTMLElement,
  scale: number,
  animate: boolean = false
): void {
  applyTransform(element, {
    scale
  }, animate, {
    duration: animate ? 200 : 0,
    easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
  })
}

/**
 * Create ripple effect for touch feedback
 */
export function createRippleEffect(
  element: HTMLElement,
  x: number,
  y: number,
  color: string = 'rgba(255, 255, 255, 0.3)'
): void {
  const ripple = document.createElement('div')
  const rect = element.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height)
  
  ripple.style.position = 'absolute'
  ripple.style.borderRadius = '50%'
  ripple.style.background = color
  ripple.style.transform = 'scale(0)'
  ripple.style.animation = 'ripple 600ms linear'
  ripple.style.left = (x - rect.left - size / 2) + 'px'
  ripple.style.top = (y - rect.top - size / 2) + 'px'
  ripple.style.width = size + 'px'
  ripple.style.height = size + 'px'
  ripple.style.pointerEvents = 'none'
  
  element.style.position = 'relative'
  element.style.overflow = 'hidden'
  element.appendChild(ripple)
  
  // Remove ripple after animation
  setTimeout(() => {
    if (ripple.parentNode) {
      ripple.parentNode.removeChild(ripple)
    }
  }, 600)
}

/**
 * Add CSS keyframes for ripple animation if not already present
 */
export function ensureRippleKeyframes(): void {
  const styleId = 'gesture-ripple-keyframes'
  
  if (document.getElementById(styleId)) {
    return
  }
  
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    @keyframes ripple {
      to {
        transform: scale(4);
        opacity: 0;
      }
    }
  `
  
  document.head.appendChild(style)
}

/**
 * Create loading spinner animation for pull refresh
 */
export function createLoadingSpinner(
  element: HTMLElement,
  size: number = 24,
  color: string = '#3b82f6'
): HTMLElement {
  const spinner = document.createElement('div')
  spinner.className = 'gesture-loading-spinner'
  
  spinner.style.width = size + 'px'
  spinner.style.height = size + 'px'
  spinner.style.border = `2px solid transparent`
  spinner.style.borderTop = `2px solid ${color}`
  spinner.style.borderRadius = '50%'
  spinner.style.animation = 'spin 1s linear infinite'
  spinner.style.margin = '0 auto'
  
  element.appendChild(spinner)
  
  // Ensure spin keyframes exist
  ensureSpinKeyframes()
  
  return spinner
}

/**
 * Add CSS keyframes for spinner animation if not already present
 */
export function ensureSpinKeyframes(): void {
  const styleId = 'gesture-spin-keyframes'
  
  if (document.getElementById(styleId)) {
    return
  }
  
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `
  
  document.head.appendChild(style)
}

/**
 * Create bounce animation for haptic feedback
 */
export function animateBounce(
  element: HTMLElement,
  intensity: 'light' | 'medium' | 'heavy' = 'medium'
): void {
  const scaleMap = {
    light: 0.98,
    medium: 0.95,
    heavy: 0.9
  }
  
  const scale = scaleMap[intensity]
  
  // Scale down
  applyTransform(element, { scale }, true, { duration: 100 })
  
  // Scale back up
  setTimeout(() => {
    applyTransform(element, { scale: 1 }, true, { duration: 150 })
  }, 100)
}

/**
 * Create slide animation for context menus
 */
export function animateSlideIn(
  element: HTMLElement,
  direction: 'up' | 'down' | 'left' | 'right' = 'up',
  distance: number = 20
): void {
  const transforms: TransformOptions = { opacity: 0 }
  
  switch (direction) {
    case 'up':
      transforms.translateY = distance
      break
    case 'down':
      transforms.translateY = -distance
      break
    case 'left':
      transforms.translateX = distance
      break
    case 'right':
      transforms.translateX = -distance
      break
  }
  
  // Set initial state
  applyTransform(element, transforms, false)
  
  // Animate to final state
  requestAnimationFrame(() => {
    applyTransform(element, {
      translateX: 0,
      translateY: 0,
      opacity: 1
    }, true, {
      duration: 250,
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
    })
  })
}

/**
 * Initialize all required CSS keyframes
 */
export function initializeGestureAnimations(): void {
  ensureRippleKeyframes()
  ensureSpinKeyframes()
}