/**
 * SidebarContext — collapsed/expanded state of the left sidebar,
 * shared so every page shifts its content together. The choice is
 * remembered in localStorage across visits.
 */
import { createContext, useContext, useEffect, useState } from 'react';

const SidebarContext = createContext();

// Provider — owns the collapsed/expanded state.
export const SidebarProvider = ({ children }) => {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('ms_sidebar') === 'collapsed'
  );

  useEffect(() => {
    document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
    localStorage.setItem('ms_sidebar', collapsed ? 'collapsed' : 'open');
  }, [collapsed]);

  return (
    <SidebarContext.Provider value={{ collapsed, toggleSidebar: () => setCollapsed((c) => !c) }}>
      {children}
    </SidebarContext.Provider>
  );
};

// Hook: collapsed state + toggle.
export const useSidebar = () => useContext(SidebarContext);
