import type { DefaultEventsMap } from "@socket.io/component-emitter";
import type { ReactNode } from "react";
import React, { createContext, useContext, useState, useEffect } from "react";
import type { Socket } from "socket.io-client";
import io from "socket.io-client";

import { BasedThreadProvider } from "./BasedThreadContext";

interface ISocketContext {
  socket: Socket | null;
}

// Create a context with a default value of null
const SocketContext = createContext<ISocketContext>({ socket: null });

interface SocketProviderProps {
  children: ReactNode;
  token: string;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children, token }) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    let newSocket: Socket<DefaultEventsMap, DefaultEventsMap> | null = null;
    if (token) {
      newSocket = io(`ws://localhost:4020`, {
        transports: ["websocket", "polling", "flashsocket"],
        auth: {
          token,
        },
      });

      setSocket(newSocket);
    }

    return () => {
      if (newSocket) {
        newSocket.close();
      }
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket }}>
      <BasedThreadProvider>{children}</BasedThreadProvider>
    </SocketContext.Provider>
  );
};

// Custom hook to use the socket context
export const useSocket = (): ISocketContext => useContext(SocketContext);
