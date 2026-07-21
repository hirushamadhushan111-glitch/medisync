/**
 * SidebarContext — collapsed/expanded state of the left sidebar,
 * shared so every page shifts its content together. The choice is
 * remembered in localStorage across visits.
 *
 * On mobile (<768px) the sidebar becomes a slide-in drawer instead:
 * `isMobile` tracks the breakpoint and `mobileOpen` the drawer state.
 * The navbar hamburger toggles the drawer on mobile and the
 * collapsed/expanded width on desktop.
 */
import { createContext, useContext, useEffect, useState } from 'react';

const SidebarContext = createContext();

// Matches Tailwind's `md` breakpoint (sidebar is a drawer below it).
const MOBILE_QUERY = '(max-width: 767px)';

// Provider — owns the collapsed/expanded + mobile drawer state.
export const SidebarProvider = ({ children }) => {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('ms_sidebar') === 'collapsed'
  );
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
    localStorage.setItem('ms_sidebar', collapsed ? 'collapsed' : 'open');
  }, [collapsed]);

  // Track the breakpoint; close the drawer when returning to desktop.
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e) => {
      setIsMobile(e.matches);
      if (!e.matches) setMobileOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Hamburger: drawer on mobile, collapse on desktop.
  const toggleSidebar = () => {
    if (window.matchMedia(MOBILE_QUERY).matches) setMobileOpen((o) => !o);
    else setCollapsed((c) => !c);
  };

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        isMobile,
        mobileOpen,
        toggleSidebar,
        closeMobileSidebar: () => setMobileOpen(false),
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

// Hook: collapsed/mobile state + toggles.
export const useSidebar = () => useContext(SidebarContext);
