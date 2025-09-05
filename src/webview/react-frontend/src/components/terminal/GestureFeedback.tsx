import React, { useEffect, useState } from 'react';
import { GestureType, TouchGesture } from '../../types/gesture';

interface GestureFeedbackProps {
  gesture?: TouchGesture;
  hapticEnabled?: boolean;
  visualEnabled?: boolean;
  className?: string;
}

interface FeedbackIndicator {
  id: string;
  x: number;
  y: number;
  type: GestureType;
  timestamp: number;
}

export const GestureFeedback: React.FC<GestureFeedbackProps> = ({
  gesture,
  hapticEnabled = true,
  visualEnabled = true,
  className = ''
}) => {
  const [indicators, setIndicators] = useState<FeedbackIndicator[]>([]);

  // Haptic feedback patterns
  const hapticPatterns: Record<GestureType, number[]> = {
    'tap': [10],
    'double-tap': [10, 50, 10],
    'triple-tap': [10, 50, 10, 50, 10],
    'long-press': [50],
    'swipe': [20],
    'pinch': [15, 30, 15],
    'pan': [5]
  };

  // Visual feedback colors
  const visualColors: Record<GestureType, string> = {
    'tap': 'rgba(0, 123, 255, 0.6)',
    'double-tap': 'rgba(40, 167, 69, 0.6)',
    'triple-tap': 'rgba(255, 193, 7, 0.6)',
    'long-press': 'rgba(220, 53, 69, 0.6)',
    'swipe': 'rgba(108, 117, 125, 0.6)',
    'pinch': 'rgba(102, 16, 242, 0.6)',
    'pan': 'rgba(23, 162, 184, 0.6)'
  };

  // Trigger haptic feedback
  const triggerHapticFeedback = (type: GestureType) => {
    if (!hapticEnabled || !('vibrate' in navigator)) return;
    
    const pattern = hapticPatterns[type];
    if (pattern) {
      navigator.vibrate(pattern);
    }
  };

  // Trigger visual feedback
  const triggerVisualFeedback = (gesture: TouchGesture) => {
    if (!visualEnabled || !gesture.data.center) return;

    const indicator: FeedbackIndicator = {
      id: `${Date.now()}-${Math.random()}`,
      x: gesture.data.center.x,
      y: gesture.data.center.y,
      type: gesture.type,
      timestamp: Date.now()
    };

    setIndicators(prev => [...prev, indicator]);

    // Remove indicator after animation
    setTimeout(() => {
      setIndicators(prev => prev.filter(i => i.id !== indicator.id));
    }, 600);
  };

  // Handle gesture feedback
  useEffect(() => {
    if (!gesture) return;

    triggerHapticFeedback(gesture.type);
    triggerVisualFeedback(gesture);
  }, [gesture, hapticEnabled, visualEnabled]);

  // Get animation class based on gesture type
  const getAnimationClass = (type: GestureType): string => {
    switch (type) {
      case 'tap':
        return 'feedback-tap';
      case 'double-tap':
        return 'feedback-double-tap';
      case 'triple-tap':
        return 'feedback-triple-tap';
      case 'long-press':
        return 'feedback-long-press';
      case 'swipe':
        return 'feedback-swipe';
      case 'pinch':
        return 'feedback-pinch';
      case 'pan':
        return 'feedback-pan';
      default:
        return 'feedback-default';
    }
  };

  return (
    <div className={`gesture-feedback ${className}`}>
      {indicators.map(indicator => (
        <div
          key={indicator.id}
          className={`feedback-indicator ${getAnimationClass(indicator.type)}`}
          style={{
            position: 'fixed',
            left: indicator.x - 20,
            top: indicator.y - 20,
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: visualColors[indicator.type],
            border: `2px solid ${visualColors[indicator.type].replace('0.6', '0.8')}`,
            pointerEvents: 'none',
            zIndex: 9999,
            transform: 'scale(0)',
          }}
        />
      ))}

      <style>{`
        .gesture-feedback {
          position: relative;
          pointer-events: none;
        }

        .feedback-indicator {
          animation-fill-mode: forwards;
        }

        .feedback-tap {
          animation: tapRipple 0.3s ease-out;
        }

        .feedback-double-tap {
          animation: doubleTapRipple 0.5s ease-out;
        }

        .feedback-triple-tap {
          animation: tripleTapRipple 0.7s ease-out;
        }

        .feedback-long-press {
          animation: longPressRipple 0.8s ease-out;
        }

        .feedback-swipe {
          animation: swipeRipple 0.4s ease-out;
        }

        .feedback-pinch {
          animation: pinchRipple 0.6s ease-out;
        }

        .feedback-pan {
          animation: panRipple 0.3s ease-out;
        }

        .feedback-default {
          animation: defaultRipple 0.3s ease-out;
        }

        @keyframes tapRipple {
          0% {
            transform: scale(0);
            opacity: 1;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.8;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }

        @keyframes doubleTapRipple {
          0% {
            transform: scale(0);
            opacity: 1;
          }
          25% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(0.5);
            opacity: 0.6;
          }
          75% {
            transform: scale(1.5);
            opacity: 0.4;
          }
          100% {
            transform: scale(2.5);
            opacity: 0;
          }
        }

        @keyframes tripleTapRipple {
          0% {
            transform: scale(0);
            opacity: 1;
          }
          20% {
            transform: scale(0.8);
            opacity: 0.9;
          }
          40% {
            transform: scale(0.4);
            opacity: 0.7;
          }
          60% {
            transform: scale(1.2);
            opacity: 0.5;
          }
          80% {
            transform: scale(0.6);
            opacity: 0.3;
          }
          100% {
            transform: scale(3);
            opacity: 0;
          }
        }

        @keyframes longPressRipple {
          0% {
            transform: scale(0);
            opacity: 1;
          }
          30% {
            transform: scale(0.8);
            opacity: 0.8;
          }
          70% {
            transform: scale(1.5);
            opacity: 0.6;
          }
          100% {
            transform: scale(2.5);
            opacity: 0;
          }
        }

        @keyframes swipeRipple {
          0% {
            transform: scale(0) skewX(0deg);
            opacity: 1;
          }
          50% {
            transform: scale(1.5) skewX(15deg);
            opacity: 0.6;
          }
          100% {
            transform: scale(3) skewX(30deg);
            opacity: 0;
          }
        }

        @keyframes pinchRipple {
          0% {
            transform: scale(0);
            opacity: 1;
            border-radius: 50%;
          }
          50% {
            transform: scale(1.8);
            opacity: 0.7;
            border-radius: 30%;
          }
          100% {
            transform: scale(3.5);
            opacity: 0;
            border-radius: 10%;
          }
        }

        @keyframes panRipple {
          0% {
            transform: scale(0);
            opacity: 1;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }

        @keyframes defaultRipple {
          0% {
            transform: scale(0);
            opacity: 1;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};