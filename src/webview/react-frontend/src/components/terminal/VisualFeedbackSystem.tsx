import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';

export interface TouchInteraction {
  id: string;
  x: number;
  y: number;
  timestamp: number;
  type?: 'tap' | 'long-press' | 'swipe' | 'pinch';
}

export interface VisualFeedbackSystemProps {
  interactions: TouchInteraction[];
  className?: string;
  showRipples?: boolean;
  rippleDuration?: number;
  rippleColor?: string;
}

interface RippleEffect {
  id: string;
  x: number;
  y: number;
  startTime: number;
  duration: number;
  color: string;
  type: 'tap' | 'long-press' | 'swipe' | 'pinch';
}

export const VisualFeedbackSystem: React.FC<VisualFeedbackSystemProps> = ({
  interactions,
  className,
  showRipples = true,
  rippleDuration = 600,
  rippleColor = 'rgba(59, 130, 246, 0.3)' // Blue with transparency
}) => {
  const [ripples, setRipples] = useState<RippleEffect[]>([]);
  const [animationFrame, setAnimationFrame] = useState<number | null>(null);

  // Create ripple effects from interactions
  useEffect(() => {
    interactions.forEach(interaction => {
      // Check if we already have a ripple for this interaction
      const existingRipple = ripples.find(ripple => ripple.id === interaction.id);
      if (!existingRipple && showRipples) {
        const newRipple: RippleEffect = {
          id: interaction.id,
          x: interaction.x,
          y: interaction.y,
          startTime: interaction.timestamp,
          duration: rippleDuration,
          color: rippleColor,
          type: interaction.type || 'tap'
        };
        
        setRipples(prev => [...prev, newRipple]);
      }
    });
  }, [interactions, showRipples, rippleDuration, rippleColor]);

  // Animation loop to update ripple effects
  useEffect(() => {
    const animate = () => {
      const now = Date.now();
      
      setRipples(prev => 
        prev.filter(ripple => now - ripple.startTime < ripple.duration)
      );
      
      setAnimationFrame(requestAnimationFrame(animate));
    };

    if (ripples.length > 0) {
      setAnimationFrame(requestAnimationFrame(animate));
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [ripples.length]);

  // Calculate ripple animation progress
  const getRippleStyle = (ripple: RippleEffect): React.CSSProperties => {
    const now = Date.now();
    const elapsed = now - ripple.startTime;
    const progress = Math.min(elapsed / ripple.duration, 1);
    
    // Different animations for different interaction types
    let scale = 1;
    let opacity = 1;
    
    switch (ripple.type) {
      case 'tap':
        scale = 1 + progress * 2; // Expand from 1x to 3x
        opacity = 1 - progress; // Fade out
        break;
      
      case 'long-press':
        scale = 1 + progress * 1.5; // Slower expansion
        opacity = Math.max(0.3, 1 - progress); // Maintain some opacity longer
        break;
      
      case 'swipe':
        scale = 1 + progress * 3; // Faster expansion
        opacity = 1 - Math.pow(progress, 2); // Quadratic fade
        break;
      
      case 'pinch':
        scale = 1 + Math.sin(progress * Math.PI) * 0.5; // Pulsing effect
        opacity = 1 - progress;
        break;
    }

    return {
      position: 'absolute',
      left: ripple.x - 20,
      top: ripple.y - 20,
      width: 40,
      height: 40,
      borderRadius: '50%',
      backgroundColor: ripple.color,
      transform: `scale(${scale})`,
      opacity,
      pointerEvents: 'none',
      zIndex: 1000,
      transition: ripple.type === 'pinch' ? 'none' : 'transform 0.1s ease-out'
    };
  };

  return (
    <div className={cn('visual-feedback-system', className)}>
      {/* Ripple effects */}
      {showRipples && ripples.map(ripple => (
        <div
          key={ripple.id}
          className="ripple-effect"
          style={getRippleStyle(ripple)}
        />
      ))}
      
      {/* Touch indicators for active touches */}
      {interactions.map(interaction => {
        const age = Date.now() - interaction.timestamp;
        if (age > 100) return null; // Only show very recent touches
        
        return (
          <div
            key={`indicator-${interaction.id}`}
            className="touch-indicator"
            style={{
              position: 'absolute',
              left: interaction.x - 15,
              top: interaction.y - 15,
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: '2px solid rgba(59, 130, 246, 0.8)',
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              pointerEvents: 'none',
              zIndex: 1001,
              animation: 'pulse 0.3s ease-out'
            }}
          />
        );
      })}
      

    </div>
  );
};

// Hook for managing visual feedback
export const useVisualFeedback = () => {
  const [interactions, setInteractions] = useState<TouchInteraction[]>([]);

  const addInteraction = (interaction: Omit<TouchInteraction, 'timestamp'>) => {
    const newInteraction: TouchInteraction = {
      ...interaction,
      timestamp: Date.now()
    };
    
    setInteractions(prev => [...prev, newInteraction]);
    
    // Auto-remove after a delay
    setTimeout(() => {
      setInteractions(prev => 
        prev.filter(i => i.id !== newInteraction.id)
      );
    }, 1000);
  };

  const clearInteractions = () => {
    setInteractions([]);
  };

  return {
    interactions,
    addInteraction,
    clearInteractions
  };
};