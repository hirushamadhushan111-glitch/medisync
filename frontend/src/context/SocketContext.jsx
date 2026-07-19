/**
 * SocketContext — one Socket.IO connection shared by the whole app,
 * used for live queue updates and notifications. The socket is opened
 * only after login (it authenticates with the same JWT) and is closed
 * automatically on logout.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

// Provider — opens/closes the socket with the login state.
export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setSocket(null);
      return undefined;
    }

    const instance = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    setSocket(instance);

    return () => {
      instance.disconnect();
      setSocket(null);
    };
  }, [isAuthenticated, token]);

  const value = useMemo(() => ({ socket }), [socket]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

// Hook: the shared socket (or null before login).
export const useSocket = () => useContext(SocketContext);
