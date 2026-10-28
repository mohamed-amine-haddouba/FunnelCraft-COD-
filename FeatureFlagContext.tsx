import React, { createContext, useContext, useState, useEffect } from 'react';

interface FeatureFlags {
  [key: string]: boolean;
}

interface FeatureFlagContextType {
  flags: FeatureFlags;
  toggleFeature: (featureName: string, enabled: boolean) => Promise<void>;
  isLoading: boolean;
}

const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(undefined);

export const FeatureFlagProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [flags, setFlags] = useState<FeatureFlags>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings/features')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.features) {
          setFlags(data.features);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const toggleFeature = async (featureName: string, enabled: boolean) => {
    try {
      const res = await fetch('/api/admin/settings/features', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: featureName, enabled }),
      });
      if (res.ok) {
        setFlags((prev) => ({ ...prev, [featureName]: enabled }));
      }
    } catch (error) {
      console.error('Failed to toggle feature', error);
    }
  };

  return (
    <FeatureFlagContext.Provider value={{ flags, toggleFeature, isLoading }}>
      {children}
    </FeatureFlagContext.Provider>
  );
};

export const useFeatureFlag = (featureName: string): boolean => {
  const context = useContext(FeatureFlagContext);
  if (!context) return false;
  return context.flags[featureName] || false;
};

export const useFeatureFlagsAdmin = () => {
  const context = useContext(FeatureFlagContext);
  if (!context) throw new Error('useFeatureFlagsAdmin must be used within FeatureFlagProvider');
  return context;
};
