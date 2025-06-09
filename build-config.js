// build-config.js - Build configuration for different deployment targets

const BUILD_TARGETS = {
  CLOUD: 'cloud',
  LOCAL: 'local'
};

const getCurrentTarget = () => {
  return process.env.BUILD_TARGET || BUILD_TARGETS.LOCAL;
};

const getFeatureFlags = (target) => {
  const baseFeatures = {
    // Core features available in both versions
    TASK_MANAGEMENT: true,
    DATA_EXPORT_IMPORT: true,
    AI_EXTRACTION: true,
    KEYBOARD_SHORTCUTS: true,
    MULTIPLE_TASKS: true
  };

  const cloudFeatures = {
    ...baseFeatures,
    // Cloud-only features
    OPENAI_API: true,
    OLLAMA_LOCAL: false,
    OPENWEBUI_LOCAL: false,
    LOCAL_FILE_ACCESS: false,
    ADVANCED_CONFIG: false
  };

  const localFeatures = {
    ...baseFeatures,
    // Local/self-hosted features
    OPENAI_API: true,
    OLLAMA_LOCAL: true,
    OPENWEBUI_LOCAL: true,
    LOCAL_FILE_ACCESS: true,
    ADVANCED_CONFIG: true
  };

  return target === BUILD_TARGETS.CLOUD ? cloudFeatures : localFeatures;
};

const getBuildConfig = (target = getCurrentTarget()) => {
  const features = getFeatureFlags(target);
  
  return {
    target,
    features,
    buildInfo: {
      version: target === BUILD_TARGETS.CLOUD ? 'Cloud' : 'Self-Hosted',
      timestamp: new Date().toISOString(),
      capabilities: Object.keys(features).filter(key => features[key])
    },
    serviceConfig: {
      availableServices: target === BUILD_TARGETS.CLOUD 
        ? ['openai'] 
        : ['ollama', 'openwebui', 'openai'],
      defaultService: target === BUILD_TARGETS.CLOUD ? 'openai' : 'ollama'
    }
  };
};

// Export for use in build tools and runtime
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BUILD_TARGETS, getBuildConfig, getFeatureFlags };
} else {
  window.BuildConfig = { BUILD_TARGETS, getBuildConfig, getFeatureFlags };
}
