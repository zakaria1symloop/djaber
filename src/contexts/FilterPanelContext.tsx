'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface FilterPanelContextType {
  filterPanelOpen: boolean;
  setFilterPanelOpen: (open: boolean) => void;
}

const FilterPanelContext = createContext<FilterPanelContextType>({
  filterPanelOpen: false,
  setFilterPanelOpen: () => {},
});

export function FilterPanelProvider({ children }: { children: ReactNode }) {
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  return (
    <FilterPanelContext.Provider value={{ filterPanelOpen, setFilterPanelOpen }}>
      {children}
    </FilterPanelContext.Provider>
  );
}

export function useFilterPanel() {
  return useContext(FilterPanelContext);
}
