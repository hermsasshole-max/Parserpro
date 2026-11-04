import React, { createContext, useContext, useEffect, useState } from 'react';

interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface SafeAreaContextType {
  insets: SafeAreaInsets;
  viewportHeight: number;
  hasBottomNav: boolean;
  setHasBottomNav: (has: boolean) => void;
}

const SafeAreaContext = createContext<SafeAreaContextType>({
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 800,
  hasBottomNav: true,
  setHasBottomNav: () => {},
});

export const SafeAreaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [viewportHeight, setViewportHeight] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerHeight : 800
  );
  const [hasBottomNav, setHasBottomNav] = useState<boolean>(true);
  const [insets, setInsets] = useState<SafeAreaInsets>({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  useEffect(() => {
    const updateDimensions = () => {
      // Use visualViewport if available to account for virtual keyboard
      const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      setViewportHeight(h);

      // Probe CSS env variables if possible
      const computed = window.getComputedStyle(document.documentElement);
      const topVal = parseFloat(computed.getPropertyValue('--safe-area-inset-top')) || 0;
      const bottomVal = parseFloat(computed.getPropertyValue('--safe-area-inset-bottom')) || 0;
      setInsets({
        top: topVal,
        bottom: bottomVal,
        left: 0,
        right: 0,
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    window.addEventListener('orientationchange', updateDimensions);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateDimensions);
    }

    return () => {
      window.removeEventListener('resize', updateDimensions);
      window.removeEventListener('orientationchange', updateDimensions);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateDimensions);
      }
    };
  }, []);

  return (
    <SafeAreaContext.Provider value={{ insets, viewportHeight, hasBottomNav, setHasBottomNav }}>
      {children}
    </SafeAreaContext.Provider>
  );
};

export const useSafeArea = () => useContext(SafeAreaContext);

interface SafeAreaViewProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  as?: React.ElementType;
  className?: string;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  bottomOffsetClass?: string;
}

export const SafeAreaView: React.FC<SafeAreaViewProps> = ({
  children,
  className = '',
  edges = ['top', 'bottom'],
  bottomOffsetClass = 'pb-24 sm:pb-12', // Ensures space for MobileBottomNav
  ...props
}) => {
  const hasTop = edges.includes('top');
  const hasBottom = edges.includes('bottom');

  return (
    <div
      className={`min-h-[100dvh] w-full flex flex-col ${
        hasTop ? 'pt-safe' : ''
      } ${hasBottom ? 'pb-safe' : ''} ${bottomOffsetClass} ${className}`}
      style={{ minHeight: '100dvh' }}
      {...props}
    >
      {children}
    </div>
  );
};

export default SafeAreaView;
