import type { ReactNode } from "react";
import React, { useEffect } from "react";

import { useSocket } from "./BasedSocketContext";
import { useBasedThreadContext } from "./BasedThreadContext";

export interface ExposedFunction {
  [functionName: string]: {
    function: (...args: any[]) => any | Promise<any>;
    params?: object;
  };
}

export interface ExposedComponent {
  name: string;
  description: string;
  props?: object;
  element?: React.ComponentType<any>;
  loader?: (...args: any[]) => any | Promise<any>;
  extraData: object;
}

interface FunctionMessage {
  role: "function";
  content: {
    id: string;
    name: string;
    params?: string;
    returnValue: string;
  };
}

interface ComponentMessage {
  role: "component";
  content: {
    id: string;
    name: string;
    props?: string;
    element?: ReactNode;
  };
}

interface TextMessage {
  role: "user" | "assistant";
  content: string;
}

const useBased = (
  productMessage: string,
  availableComponents: Array<ExposedComponent>,
  availableFunctions?: Array<ExposedFunction>
) => {
  const { thread, setThread } = useBasedThreadContext();
  const { socket } = useSocket();

  const listeners = {
    thread: ({ id }: { id: string }) => {
      console.log(id);
      setThread({
        ...thread,
        id,
      });
    },
    messagesReceived: async (messages: Array<TextMessage | FunctionMessage | ComponentMessage>) => {
      const receievedMessages: Array<TextMessage | FunctionMessage | ComponentMessage> = [];
      const functionsOutputs: { [id: string]: string } = {};

      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        switch (message.role) {
          case "function":
            if (availableFunctions) {
              console.log("\n== availableFunctions ==\n", availableFunctions, "\n");
              const { name, params } = message.content;
              const func = availableFunctions.find((f) => f[message.content.name]);

              if (func) {
                try {
                  const parsedParams = params ? JSON.parse(params) : undefined;

                  const result = await func[name].function(parsedParams);
                  message.content.returnValue = JSON.stringify(result);
                } catch (error) {
                  message.content.returnValue = JSON.stringify(error);
                }
              } else {
                message.content.returnValue = "Function not found on client side!";
              }

              functionsOutputs[message.content.id] = message.content.returnValue;
            }
            break;

          case "component":
            const route = message.content;

            const selectedComponent = availableComponents.find(({ name }) => name === route.name);
            if (selectedComponent) {
              const { element, loader } = selectedComponent;
              if (element) {
                let data = {};

                if (loader) {
                  let props = "{}";
                  if (route.props) {
                    let fixedProps = route.props.replace(/(?:\r\n|\r|\n)/g, "\\n");
                    fixedProps =
                      fixedProps.charAt(fixedProps.length - 1) === "}" ? fixedProps : `${fixedProps}}`;
                    props = JSON.parse(fixedProps);
                  }

                  data = await loader(props);
                }

                const instance = React.createElement(element, { ...data });
                if (React.isValidElement(instance)) {
                  message.content.element = instance;
                }
              }
            }

            functionsOutputs[message.content.id] =
              "Client side notified! The UI element should be shown soon.";
            break;

          default:
            break;
        }

        receievedMessages.push(message);
      }

      if (Object.keys(functionsOutputs).length === messages.length) {
        socket?.emit("functionsOutputs", {
          threadId: thread?.id,
          functionsOutputs,
        });
      }

      setThread({
        ...thread,
        id: thread?.id ? thread.id : "",
        messages: [...(thread?.messages ? thread?.messages : []), ...receievedMessages],
      });
    },
  };

  useEffect(() => {
    socket?.on("setThread", listeners.thread);
    socket?.on("messagesReceived", listeners.messagesReceived);

    return () => {
      socket?.off("setThread", listeners.thread);
      socket?.off("messagesReceived", listeners.messagesReceived);
    };
  }, [
    availableComponents,
    availableFunctions,
    listeners.messagesReceived,
    listeners.thread,
    setThread,
    socket,
    thread,
  ]);

  const generateUI = async (prompt: string) => {
    setThread({
      ...thread,
      id: thread?.id ? thread.id : "",
      messages: [...(thread?.messages ? thread?.messages : []), { role: "user", content: prompt }],
    });

    socket?.emit("generateUI", {
      productMessage,
      threadId: thread?.id,
      prompt,
      availableComponents,
      availableFunctions,
    });
  };

  return { generateUI, thread };
};

export { useBased };
