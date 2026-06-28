import { useState, useRef, useEffect } from 'react';
import styles from './Chatbot.module.css';
import SendIcon from '@mui/icons-material/Send';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

function Chatbot() {
  const [messages, setMessages] = useState([
    { text: "Hello! I'm your AI assistant for the QR Code Attendance Tracking System. How can I help you today?", sender: 'bot' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage = inputText;
    setInputText('');
    
    setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);
    
    setIsLoading(true);

    try {
      const recentMessages = messages.slice(-4).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      const response = await fetch(`${API_BASE_URL}/api/chatbot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userMessage,
          recentMessages
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Chat request failed');
      }

      const botMessage = data.message;

      setMessages(prev => [...prev, { text: botMessage, sender: 'bot' }]);
    } catch (error) {
      console.error('Chatbot error:', error);
      
      let errorMessage = "Sorry, I'm having trouble connecting. ";
      
      if (error.message.includes('not configured')) {
        errorMessage += "The AI assistant is not configured on the server.";
      } else if (error.message.includes('API key not valid') || error.message.includes('quota')) {
        errorMessage += "The server-side Gemini key is invalid or out of quota.";
      } else if (error.message.includes('Network Error')) {
        errorMessage += "Network error. Check your internet connection.";
      } else {
        errorMessage += error.message;
      }
      
      setMessages(prev => [...prev, { 
        text: errorMessage, 
        sender: 'bot' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.chatbotSection}>
      <div className={styles.messagesContainer}>
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`${styles.message} ${msg.sender === 'user' ? styles.userMessage : styles.botMessage}`}
          >
            {msg.text}
          </div>
        ))}
        {isLoading && (
          <div className={styles.loadingMessage}>
            <div className={styles.loadingDots}>
              <span>.</span><span>.</span><span>.</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className={styles.inputContainer}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Any Questions?  Ask me anything!"
          className={styles.input}
          disabled={isLoading}
        />
        <button 
          className={styles.sendButton} 
          onClick={handleSend}
          disabled={isLoading || !inputText.trim()}
        >
          <SendIcon fontSize="small" />
        </button>
      </div>
    </div>
  );
}

export default Chatbot;