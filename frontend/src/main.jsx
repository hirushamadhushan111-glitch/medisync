/**
 * main.jsx — React entry point.
 * Mounts <App /> inside every global provider (theme → auth → socket →
 * sidebar → clinic). Order matters: providers lower in the tree may use
 * the ones above them (e.g. SocketProvider needs AuthProvider's token).
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './i18n/index.js';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { SidebarProvider } from './context/SidebarContext.jsx';
import { ClinicProvider } from './context/ClinicContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <SidebarProvider>
            <ClinicProvider>
              <App />
            </ClinicProvider>
          </SidebarProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
