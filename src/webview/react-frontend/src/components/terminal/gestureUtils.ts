import { GestureType, GestureSettings, GestureConfig } from '../../types/gesture';

// Map kebab-case gesture types to camelCase settings keys
export const getSettingsKey = (type: GestureType): keyof GestureSettings => {
  const mapping: Record<GestureType, keyof GestureSettings> = {
    'tap': 'tap',
    'double-tap': 'doubleTap',
    'triple-tap': 'tripleTap',
    'long-press': 'longPress',
    'swipe': 'swipe',
    'pinch': 'pinch',
    'pan': 'pan'
  };
  return mapping[type];
};

// Get gesture setting by type with proper key mapping
export const getGestureSetting = (settings: GestureSettings, type: GestureType): GestureConfig => {
  const key = getSettingsKey(type);
  const setting = settings[key];
  
  // Ensure we return a GestureConfig object
  if (typeof setting === 'object' && setting !== null && 'enabled' in setting) {
    return setting as GestureConfig;
  }
  
  // Return default config if not found
  return {
    enabled: true,
    sensitivity: 1,
    threshold: 10,
    timeout: 300
  };
};

// Update gesture setting by type with proper key mapping
export const updateGestureSetting = (
  settings: GestureSettings, 
  type: GestureType, 
  update: Partial<GestureConfig>
): Partial<GestureSettings> => {
  const key = getSettingsKey(type);
  const currentSetting = getGestureSetting(settings, type);
  
  return {
    [key]: { ...currentSetting, ...update }
  };
};