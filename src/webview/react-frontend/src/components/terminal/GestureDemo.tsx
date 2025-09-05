import React, { useState, useCallback } from 'react';
import { GestureHandler, useGestureHandler } from './GestureHandler';
import { GestureConfig } from './GestureConfig';
import { GestureFeedback } from './GestureFeedback';
import { TouchGesture, GestureType } from '../../types/gesture';

export const GestureDemo: React.FC = () => {
  const { gestureHandler, settings } = useGestureHandler();
  const [lastGesture, setLastGesture] = useState<TouchGesture | null>(null);
  const [gestureLog, setGestureLog] = useState<TouchGesture[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedText, setSelectedText] = useState<string>('');

  // Handle gesture events
  const handleGesture = useCallback((gesture: TouchGesture) => {
    setLastGesture(gesture);
    setGestureLog(prev => [gesture, ...prev.slice(0, 9)]); // Keep last 10 gestures
    
    // Handle text selection gestures
    if (gesture.type === 'double-tap' || gesture.type === 'triple-tap') {
      handleTextSelection(gesture);
    }
  }, []);

  // Handle text selection
  const handleTextSelection = (gesture: TouchGesture) => {
    const sampleText = "This is a sample text for testing gesture-based text selection. Double-tap to select a word, triple-tap to select a line.";
    
    if (gesture.type === 'double-tap') {
      // Simulate word selection
      const words = sampleText.split(' ');
      const randomWord = words[Math.floor(Math.random() * words.length)];
      setSelectedText(`Selected word: "${randomWord}"`);
    } else if (gesture.type === 'triple-tap') {
      // Simulate line selection
      setSelectedText(`Selected line: "${sampleText}"`);
    }
  };

  // Handle text selection callback
  const handleTextSelectionCallback = useCallback((startX: number, startY: number, endX: number, endY: number) => {
    console.log('Text selection area:', { startX, startY, endX, endY });
  }, []);

  // Format gesture data for display
  const formatGestureData = (gesture: TouchGesture): string => {
    const data = gesture.data;
    const parts: string[] = [];
    
    if (data.deltaX !== undefined || data.deltaY !== undefined) {
      parts.push(`Δ(${data.deltaX?.toFixed(1) || 0}, ${data.deltaY?.toFixed(1) || 0})`);
    }
    if (data.velocity) {
      parts.push(`v(${data.velocity.x.toFixed(2)}, ${data.velocity.y.toFixed(2)})`);
    }
    if (data.scale !== undefined) {
      parts.push(`scale: ${data.scale.toFixed(2)}`);
    }
    if (data.direction) {
      parts.push(`dir: ${data.direction}`);
    }
    if (data.distance !== undefined) {
      parts.push(`dist: ${data.distance.toFixed(1)}px`);
    }
    
    return parts.join(', ');
  };

  // Get gesture type color
  const getGestureColor = (type: GestureType): string => {
    const colors: Record<GestureType, string> = {
      'tap': '#007bff',
      'double-tap': '#28a745',
      'triple-tap': '#ffc107',
      'long-press': '#dc3545',
      'swipe': '#6c757d',
      'pinch': '#6610f2',
      'pan': '#17a2b8'
    };
    return colors[type] || '#6c757d';
  };

  return (
    <div className="gesture-demo">
      <div className="demo-header">
        <h2>Gesture Handling System Demo</h2>
        <button 
          onClick={() => setShowConfig(!showConfig)}
          className="config-toggle"
        >
          {showConfig ? 'Hide' : 'Show'} Configuration
        </button>
      </div>

      {showConfig && (
        <div className="config-panel">
          <GestureConfig
            settings={settings}
            onSettingsChange={gestureHandler.updateGestureSettings}
          />
        </div>
      )}

      <div className="demo-content">
        <div className="gesture-area">
          <GestureHandler
            onGesture={handleGesture}
            onTextSelection={handleTextSelectionCallback}
            gestureSettings={settings}
            enableTouchGestures={true}
            enableMouseGestures={true}
            className="touch-area"
          >
            <div className="touch-content">
              <h3>Touch Area</h3>
              <p>Try different gestures on this area:</p>
              <ul>
                <li><strong>Tap:</strong> Single touch</li>
                <li><strong>Double-tap:</strong> Two quick taps (selects word)</li>
                <li><strong>Triple-tap:</strong> Three quick taps (selects line)</li>
                <li><strong>Long-press:</strong> Hold for 500ms</li>
                <li><strong>Swipe:</strong> Fast directional movement</li>
                <li><strong>Pinch:</strong> Two-finger zoom gesture</li>
                <li><strong>Pan:</strong> Slow dragging movement</li>
              </ul>
              
              <div className="sample-text">
                This is a sample text for testing gesture-based text selection. 
                Double-tap to select a word, triple-tap to select a line.
              </div>
              
              {selectedText && (
                <div className="selection-result">
                  {selectedText}
                </div>
              )}
            </div>
          </GestureHandler>
        </div>

        <div className="gesture-info">
          <div className="current-gesture">
            <h4>Last Gesture</h4>
            {lastGesture ? (
              <div className="gesture-details">
                <div 
                  className="gesture-type"
                  style={{ color: getGestureColor(lastGesture.type) }}
                >
                  {lastGesture.type.toUpperCase()}
                </div>
                <div className="gesture-data">
                  Duration: {lastGesture.duration}ms
                </div>
                <div className="gesture-data">
                  {formatGestureData(lastGesture)}
                </div>
                <div className="gesture-position">
                  Start: ({lastGesture.startPosition.x.toFixed(0)}, {lastGesture.startPosition.y.toFixed(0)})
                  <br />
                  End: ({lastGesture.endPosition.x.toFixed(0)}, {lastGesture.endPosition.y.toFixed(0)})
                </div>
              </div>
            ) : (
              <div className="no-gesture">No gestures detected yet</div>
            )}
          </div>

          <div className="gesture-log">
            <h4>Gesture Log</h4>
            <div className="log-entries">
              {gestureLog.map((gesture, index) => (
                <div key={`${gesture.type}-${gesture.duration}-${index}`} className="log-entry">
                  <span 
                    className="log-type"
                    style={{ color: getGestureColor(gesture.type) }}
                  >
                    {gesture.type}
                  </span>
                  <span className="log-duration">{gesture.duration}ms</span>
                  <span className="log-data">{formatGestureData(gesture)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <GestureFeedback
        gesture={lastGesture || undefined}
        hapticEnabled={settings.hapticFeedback}
        visualEnabled={settings.visualFeedback}
      />

      <style>{`
        .gesture-demo {
          padding: 1rem;
          font-family: var(--vscode-font-family);
          color: var(--vscode-foreground);
          background: var(--vscode-editor-background);
          min-height: 100vh;
        }

        .demo-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--vscode-panel-border);
        }

        .demo-header h2 {
          margin: 0;
          color: var(--vscode-foreground);
        }

        .config-toggle {
          padding: 0.5rem 1rem;
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-size: 0.9rem;
        }

        .config-toggle:hover {
          background: var(--vscode-button-hoverBackground);
        }

        .config-panel {
          margin-bottom: 1.5rem;
        }

        .demo-content {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 1.5rem;
        }

        .gesture-area {
          min-height: 400px;
        }

        .touch-area {
          width: 100%;
          height: 100%;
          min-height: 400px;
          background: var(--vscode-input-background);
          border: 2px dashed var(--vscode-input-border);
          border-radius: 8px;
          cursor: pointer;
          user-select: none;
          touch-action: none;
        }

        .touch-content {
          padding: 1.5rem;
          height: 100%;
        }

        .touch-content h3 {
          margin: 0 0 1rem 0;
          color: var(--vscode-foreground);
        }

        .touch-content ul {
          margin: 1rem 0;
          padding-left: 1.5rem;
        }

        .touch-content li {
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
        }

        .sample-text {
          margin: 1.5rem 0;
          padding: 1rem;
          background: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
          font-style: italic;
          line-height: 1.5;
        }

        .selection-result {
          margin-top: 1rem;
          padding: 0.75rem;
          background: var(--vscode-textPreformat-background);
          border-left: 3px solid var(--vscode-focusBorder);
          font-family: monospace;
          font-size: 0.85rem;
        }

        .gesture-info {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .current-gesture, .gesture-log {
          background: var(--vscode-input-background);
          border: 1px solid var(--vscode-input-border);
          border-radius: 4px;
          padding: 1rem;
        }

        .current-gesture h4, .gesture-log h4 {
          margin: 0 0 0.75rem 0;
          color: var(--vscode-foreground);
          font-size: 0.95rem;
        }

        .gesture-details {
          font-size: 0.85rem;
        }

        .gesture-type {
          font-weight: bold;
          font-size: 1rem;
          margin-bottom: 0.5rem;
        }

        .gesture-data {
          margin-bottom: 0.25rem;
          color: var(--vscode-descriptionForeground);
        }

        .gesture-position {
          margin-top: 0.5rem;
          font-family: monospace;
          font-size: 0.8rem;
          color: var(--vscode-descriptionForeground);
        }

        .no-gesture {
          color: var(--vscode-descriptionForeground);
          font-style: italic;
          font-size: 0.85rem;
        }

        .log-entries {
          max-height: 200px;
          overflow-y: auto;
        }

        .log-entry {
          display: flex;
          gap: 0.5rem;
          padding: 0.25rem 0;
          border-bottom: 1px solid var(--vscode-panel-border);
          font-size: 0.8rem;
        }

        .log-entry:last-child {
          border-bottom: none;
        }

        .log-type {
          font-weight: bold;
          min-width: 80px;
        }

        .log-duration {
          min-width: 50px;
          color: var(--vscode-descriptionForeground);
        }

        .log-data {
          flex: 1;
          color: var(--vscode-descriptionForeground);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        @media (max-width: 768px) {
          .demo-content {
            grid-template-columns: 1fr;
          }
          
          .demo-header {
            flex-direction: column;
            gap: 1rem;
            align-items: stretch;
          }
        }
      `}</style>
    </div>
  );
};