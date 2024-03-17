import type { ReactNode } from "react";
import React, { createContext, useContext, useState } from "react";

export interface FunctionMessage {
  role: "function";
  content: {
    id: string;
    name: string;
    params?: string;
    returnValue: string;
  };
}

export interface ComponentMessage {
  role: "component";
  content: {
    id: string;
    name: string;
    props?: string;
    element?: ReactNode;
  };
}

export interface TextMessage {
  role: "user" | "assistant";
  content: string;
}

interface Thread {
  id: string;
  messages?: Array<TextMessage | FunctionMessage | ComponentMessage>;
}

interface ThreadContextType {
  thread: Thread | undefined;
  setThread: (thread: Thread) => void;
}

const ThreadContext = createContext<ThreadContextType | undefined>(undefined);

export const BasedThreadProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [thread, setThread] = useState<Thread | undefined>();

  return <ThreadContext.Provider value={{ thread, setThread }}>{children}</ThreadContext.Provider>;
};

export const useBasedThreadContext = () => {
  const context = useContext(ThreadContext);
  if (context === undefined) {
    throw new Error("useBasedThreadContext must be used within an BasedThreadProvider");
  }

  return context;
};
