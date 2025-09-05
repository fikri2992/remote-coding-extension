import React, { useState } from 'react';
import { GestureSettings, GestureType } from '../../types/gesture';
import { getGestureSetting, updateGestureSetting } from './gestureUtils';

interface GestureConfigProps {
  settings: GestureSettings;
  onSettingsChange: (settings: Partial<GestureSettings>) => void;
  className?: string;
  showAdvanced?: boolean;
  onTestGesture?: (type: GestureType) => void;
}

export const GestureConfig: React.FC<GestureConfigProps> = ({
  settings,
  onSettingsChange,
  className = '',
  showAdvanced = false,
  onTestGesture
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['global']));
  const [testingGesture, setTestingGesture] = useState<GestureType | null>(null);
  const gestureTypes: GestureType[] = ['tap', 'double-tap', 'triple-tap', 'long-press', 'swipe', 'pinch', 'pan'];
  
  // Map kebab-case to camelCase for settings access (unused, kept for reference)
  // const getSettingsKey = (type: GestureType): keyof GestureSettings => {
  //   const mapping: Record<GestureType, keyof GestureSettings> = {
  //     'tap': 'tap',
  //     'double-tap': 'doubleTap',
  //     'triple-tap': 'tripleTap',
  //     'long-press': 'longPress',
  //     'swipe': 'swipe',
  //     'pinch': 'pinch',
  //     'pan': 'pan'
  //   };
  //   return mapping[type];
  // };

  const handleGestureToggle = (type: GestureType, enabled: boolean) => {
    onSettingsChange(updateGestureSetting(settings, type, { enabled }));
  };

  const handleSensitivityChange = (type: GestureType, sensitivity: number) => {
    onSettingsChange(updateGestureSetting(settings, type, { sensitivity }));
  };

  const handleThresholdChange = (type: GestureType, threshold: number) => {
    onSettingsChange(updateGestureSetting(settings, type, { threshold }));
  };

  const handleTimeoutChange = (type: GestureType, timeout: number) => {
    onSettingsChange(updateGestureSetting(settings, type, { timeout }));
  };

  const handleGlobalSensitivityChange = (sensitivity: number) => {
    onSettingsChange({ globalSensitivity: sensitivity });
  };

  const handleFeedbackToggle = (type: 'haptic' | 'visual', enabled: boolean) => {
    if (type === 'haptic') {
      onSettingsChange({ hapticFeedback: enabled });
    } else {
      onSettingsChange({ visualFeedback: enabled });
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleTestGesture = (type: GestureType) => {
    setTestingGesture(type);
    onTestGesture?.(type);
    setTimeout(() => setTestingGesture(null), 1000);
  };

  const resetToDefaults = () => {
    const defaultSettings: Partial<GestureSettings> = {
      tap: { enabled: true, sensitivity: 1, threshold: 10, timeout: 300 },
      doubleTap: { enabled: true, sensitivity: 1, threshold: 10, timeout: 300 },
      tripleTap: { enabled: true, sensitivity: 1, threshold: 10, timeout: 400 },
      longPress: { enabled: true, sensitivity: 1, threshold: 10, timeout: 500 },
      swipe: { enabled: true, sensitivity: 1, threshold: 50, timeout: 1000 },
      pinch: { enabled: true, sensitivity: 1, threshold: 20 },
      pan: { enabled: true, sensitivity: 1, threshold: 10 },
      globalSensitivity: 1,
      hapticFeedback: true,
      visualFeedback: true
    };
    onSettingsChange(defaultSettings);
  };

  return (
    <div className={`gesture-config ${className}`}>
      <div className="gesture-config-header">
        <h3>Gesture Settings</h3>
      </div>

      {/* Global Settings */}
      <div className="gesture-config-section">
        <div 
          className="section-header" 
          onClick={() => toggleSection('global')}
        >
          <h4>Global Settings</h4>
          <span className={`expand-icon ${expandedSections.has('global') ? 'expanded' : ''}`}>▼</span>
        </div>
        
        {expandedSections.has('global') && (
          <div className="section-content">
            <div className="setting-row">
              <label>Global Sensitivity</label>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={settings.globalSensitivity}
                onChange={(e) => handleGlobalSensitivityChange(parseFloat(e.target.value))}
              />
              <span>{settings.globalSensitivity.toFixed(1)}</span>
            </div>

            <div className="setting-row">
              <label>
                <input
                  type="checkbox"
                  checked={settings.hapticFeedback}
                  onChange={(e) => handleFeedbackToggle('haptic', e.target.checked)}
                />
                Haptic Feedback
              </label>
            </div>

            <div className="setting-row">
              <label>
                <input
                  type="checkbox"
                  checked={settings.visualFeedback}
                  onChange={(e) => handleFeedbackToggle('visual', e.target.checked)}
                />
                Visual Feedback
              </label>
            </div>

            <div className="setting-row">
              <button 
                className="reset-button"
                onClick={resetToDefaults}
                title="Reset all settings to defaults"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Individual Gesture Settings */}
      <div className="gesture-config-section">
        <div 
          className="section-header" 
          onClick={() => toggleSection('gestures')}
        >
          <h4>Individual Gestures</h4>
          <span className={`expand-icon ${expandedSections.has('gestures') ? 'expanded' : ''}`}>▼</span>
        </div>
        
        {expandedSections.has('gestures') && (
          <div className="section-content">
            {gestureTypes.map(type => {
              const gestureSetting = getGestureSetting(settings, type);
              
              return (
                <div key={type} className="gesture-setting">
                  <div className="gesture-header">
                    <label>
                      <input
                        type="checkbox"
                        checked={gestureSetting.enabled}
                        onChange={(e) => handleGestureToggle(type, e.target.checked)}
                      />
                      <span className="gesture-name">{type.replace('-', ' ').toUpperCase()}</span>
                    </label>
                  </div>
                  
                  {gestureSetting.enabled && (
                    <div className="gesture-details">
                      <div className="setting-row">
                        <label>Sensitivity</label>
                        <input
                          type="range"
                          min="0.1"
                          max="3"
                          step="0.1"
                          value={gestureSetting.sensitivity}
                          onChange={(e) => handleSensitivityChange(type, parseFloat(e.target.value))}
                        />
                        <span>{gestureSetting.sensitivity.toFixed(1)}</span>
                      </div>

                      {gestureSetting.threshold !== undefined && (
                        <div className="setting-row">
                          <label>Threshold</label>
                          <input
                            type="range"
                            min="5"
                            max="100"
                            step="5"
                            value={gestureSetting.threshold!}
                            onChange={(e) => handleThresholdChange(type, parseInt(e.target.value))}
                          />
                          <span>{gestureSetting.threshold}px</span>
                        </div>
                      )}

                      {gestureSetting.timeout !== undefined && (
                        <div className="setting-row">
                          <label>Timeout</label>
                          <input
                            type="range"
                            min="100"
                            max="2000"
                            step="100"
                            value={gestureSetting.timeout!}
                            onChange={(e) => handleTimeoutChange(type, parseInt(e.target.value))}
                          />
                          <span>{gestureSetting.timeout}ms</span>
                        </div>
                      )}

                      {onTestGesture && (
                        <div className="setting-row">
                          <button 
                            className={`test-button ${testingGesture === type ? 'testing' : ''}`}
                            onClick={() => handleTestGesture(type)}
                            disabled={testingGesture !== null}
                          >
                            {testingGesture === type ? 'Testing...' : 'Test Gesture'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="gesture-config-section">
          <div 
            className="section-header" 
            onClick={() => toggleSection('advanced')}
          >
            <h4>Advanced Settings</h4>
            <span className={`expand-icon ${expandedSections.has('advanced') ? 'expanded' : ''}`}>▼</span>
          </div>
          
          {expandedSections.has('advanced') && (
            <div className="section-content">
              <div className="setting-row">
                <label>Gesture Conflict Resolution</label>
                <select 
                  value="priority"
                  onChange={() => {}}
                  disabled
                >
                  <option value="priority">Priority-based (Default)</option>
                  <option value="first">First gesture wins</option>
                  <option value="last">Last gesture wins</option>
                </select>
              </div>
              
              <div className="setting-row">
                <label>Debug Mode</label>
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) {
                      console.log('Gesture debug mode enabled');
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        .gesture-config {
          padding: 1rem;
          background: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
          color: var(--vscode-foreground);
        }

        .gesture-config-header h3 {
          margin: 0 0 1rem 0;
          color: var(--vscode-foreground);
          font-weight: 600;
        }

        .gesture-config-section {
          margin-bottom: 1.5rem;
        }

        .gesture-config-section h4 {
          margin: 0 0 0.75rem 0;
          color: var(--vscode-descriptionForeground);
          font-weight: 500;
          font-size: 0.9rem;
        }

        .setting-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
          min-height: 2rem;
        }

        .setting-row label {
          min-width: 120px;
          font-size: 0.85rem;
          color: var(--vscode-foreground);
        }

        .setting-row input[type="range"] {
          flex: 1;
          max-width: 150px;
        }

        .setting-row span {
          min-width: 40px;
          text-align: right;
          font-size: 0.8rem;
          color: var(--vscode-descriptionForeground);
        }

        .gesture-setting {
          margin-bottom: 1rem;
          padding: 0.75rem;
          background: var(--vscode-input-background);
          border: 1px solid var(--vscode-input-border);
          border-radius: 3px;
        }

        .gesture-header {
          margin-bottom: 0.5rem;
        }

        .gesture-name {
          font-weight: 500;
          margin-left: 0.5rem;
        }

        .gesture-details {
          margin-left: 1.5rem;
          padding-top: 0.5rem;
          border-top: 1px solid var(--vscode-panel-border);
        }

        input[type="checkbox"] {
          margin-right: 0.5rem;
        }

        input[type="range"] {
          accent-color: var(--vscode-focusBorder);
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          padding: 0.25rem 0;
          border-bottom: 1px solid var(--vscode-panel-border);
          margin-bottom: 0.75rem;
        }

        .section-header:hover {
          background: var(--vscode-list-hoverBackground);
          margin: 0 -0.5rem 0.75rem -0.5rem;
          padding: 0.25rem 0.5rem;
          border-radius: 3px;
        }

        .expand-icon {
          transition: transform 0.2s ease;
          font-size: 0.8rem;
          color: var(--vscode-descriptionForeground);
        }

        .expand-icon.expanded {
          transform: rotate(180deg);
        }

        .section-content {
          animation: slideDown 0.2s ease-out;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            max-height: 0;
          }
          to {
            opacity: 1;
            max-height: 500px;
          }
        }

        .test-button, .reset-button {
          padding: 0.25rem 0.75rem;
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-size: 0.8rem;
          transition: background-color 0.2s ease;
        }

        .test-button:hover, .reset-button:hover {
          background: var(--vscode-button-hoverBackground);
        }

        .test-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .test-button.testing {
          background: var(--vscode-progressBar-background);
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        select {
          background: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border);
          border-radius: 3px;
          padding: 0.25rem;
          font-size: 0.85rem;
        }

        select:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};