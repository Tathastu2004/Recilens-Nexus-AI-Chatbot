import { createContext , useContext , useEffect , useState } from "react";
import socket from "../socket.js";


const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    socket.on('receive-message', (msg) => {
      console.log('📩 Received from socket:', msg);
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off('receive-message');
    };
  }, []);

  return (
    <ChatContext.Provider value={{ socket, messages, setMessages }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
