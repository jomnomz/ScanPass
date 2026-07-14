// src/components/Forms/Chatbot/Chatbot.jsx
import { useState, useRef, useEffect } from 'react';
import styles from './Chatbot.module.css';
import SendIcon from '@mui/icons-material/Send';
import { apiClient } from '../../../config/api.js'; // Import apiClient

function Chatbot() {
  const [messages, setMessages] = useState([
    { text: "Hello! I'm your AI assistant for the QR Code Attendance Tracking System. How can I help you today?", sender: 'bot' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

      // Use apiClient instead of fetch
      const response = await apiClient.post('/api/chatbot', {
        userMessage,
        recentMessages
      });

      const data = response.data;

      if (!data.success) {
        throw new Error(data.error || 'Chat request failed');
      }

      const botMessage = data.message;

      setMessages(prev => [...prev, { text: botMessage, sender: 'bot' }]);
    } catch (error) {
      console.error('Chatbot error:', error);
      
      let errorMessage = "Sorry, I'm having trouble connecting. ";
      
      // Better error handling with axios error object
      if (error.response) {
        // Server responded with error status
        const errorData = error.response.data;
        
        if (errorData.error) {
          errorMessage += errorData.error;
        } else if (error.response.status === 404) {
          errorMessage += "The AI assistant service is not available on the server.";
        } else if (error.response.status === 429) {
          errorMessage += "Too many requests. Please try again later.";
        } else if (error.response.status >= 500) {
          errorMessage += "The server encountered an error. Please try again later.";
        } else {
          errorMessage += `Server error (${error.response.status}). Please try again.`;
        }
      } else if (error.request) {
        // Request made but no response received
        errorMessage += "Network error. Please check your internet connection.";
      } else {
        // Something else happened
        if (error.message.includes('not configured')) {
          errorMessage += "The AI assistant is not configured on the server.";
        } else if (error.message.includes('API key not valid') || error.message.includes('quota')) {
          errorMessage += "The server-side Gemini key is invalid or out of quota.";
        } else {
          errorMessage += error.message;
        }
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