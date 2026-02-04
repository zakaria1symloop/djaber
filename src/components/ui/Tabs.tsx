'use client';

import { createContext, useContext, useState, HTMLAttributes, forwardRef, ButtonHTMLAttributes } from 'react';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider');
  }
  return context;
}

interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  ({ defaultValue, value, onValueChange, className = '', children, ...props }, ref) => {
    const [internalValue, setInternalValue] = useState(defaultValue);

    const activeTab = value ?? internalValue;
    const setActiveTab = (newValue: string) => {
      setInternalValue(newValue);
      onValueChange?.(newValue);
    };

    return (
      <TabsContext.Provider value={{ activeTab, setActiveTab }}>
        <div ref={ref} className={className} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);

Tabs.displayName = 'Tabs';

interface TabsListProps extends HTMLAttributes<HTMLDivElement> {}

export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          inline-flex items-center gap-1 p-1 bg-zinc-900 border border-white/10 rounded-lg
          ${className}
        `}
        role="tablist"
        {...props}
      >
        {children}
      </div>
    );
  }
);

TabsList.displayName = 'TabsList';

interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  icon?: React.ReactNode;
}

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value, icon, className = '', children, ...props }, ref) => {
    const { activeTab, setActiveTab } = useTabsContext();
    const isActive = activeTab === value;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        onClick={() => !props.disabled && setActiveTab(value)}
        className={`
          inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md
          transition-all duration-200 ease-out
          ${isActive
            ? 'bg-white text-black'
            : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }
          ${className}
        `}
        {...props}
      >
        {icon}
        {children}
      </button>
    );
  }
);

TabsTrigger.displayName = 'TabsTrigger';

interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, className = '', children, ...props }, ref) => {
    const { activeTab } = useTabsContext();

    if (activeTab !== value) {
      return null;
    }

    return (
      <div
        ref={ref}
        role="tabpanel"
        className={`mt-4 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

TabsContent.displayName = 'TabsContent';
