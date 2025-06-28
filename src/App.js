import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

function App() {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatEnded, setChatEnded] = useState(false);
  const [showThankYouPage, setShowThankYouPage] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize chat session
  useEffect(() => {
    startNewChatSession();
  }, []);

  const startNewChatSession = async () => {
    try {
      setIsLoading(true);
      setConnectionError(false);
      
      const response = await axios.post(`${API_BASE_URL}/chat/start`);
      const { sessionId: newSessionId, welcomeMessage } = response.data;
      
      setSessionId(newSessionId);
      setMessages([
        {
          id: 1,
          text: welcomeMessage,
          sender: 'bot',
          timestamp: new Date(),
          type: 'welcome'
        }
      ]);
      setIsLoading(false);
    } catch (error) {
      console.error('Error starting chat session:', error);
      setConnectionError(true);
      setIsLoading(false);
      
      // Fallback to offline mode
      setMessages([
        {
          id: 1,
          text: "Welcome to BankBot Assistant! I'm here to help you with your banking needs. Note: Currently running in offline mode. How can I assist you today?",
          sender: 'bot',
          timestamp: new Date(),
          type: 'welcome'
        }
      ]);
    }
  };

  const getBankingBotResponse = (userMessage) => {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('balance') || lowerMessage.includes('account')) {
      return {
        text: "For security reasons, I cannot display your account balance here. Please log into your secure banking portal or visit our nearest branch. Is there anything else I can help you with?",
        type: 'balance_inquiry'
      };
    } else if (lowerMessage.includes('transfer') || lowerMessage.includes('payment')) {
      return {
        text: "To make transfers or payments, please use our secure online banking platform or mobile app. I can guide you through the process. Would you like me to explain how to access these services?",
        type: 'transfer_inquiry'
      };
    } else if (lowerMessage.includes('loan') || lowerMessage.includes('credit')) {
      return {
        text: "I can help you with information about our loan products. We offer personal loans, home loans, and business loans with competitive rates. Would you like to know more about any specific loan type?",
        type: 'loan_inquiry'
      };
    } else if (lowerMessage.includes('card') || lowerMessage.includes('debit') || lowerMessage.includes('credit card')) {
      return {
        text: "For card-related services including blocking, activation, or new card requests, I can guide you to the right department. What specific card service do you need help with?",
        type: 'card_inquiry'
      };
    } else if (lowerMessage.includes('branch') || lowerMessage.includes('location') || lowerMessage.includes('atm')) {
      return {
        text: "I can help you find the nearest branch or ATM. Please share your location or area, and I'll provide you with the closest banking facilities.",
        type: 'location_inquiry'
      };
    } else {
      return {
        text: "I understand your query. For detailed assistance with banking services, I recommend speaking with our customer service team at 1-800-BANK-HELP or visiting your nearest branch. Is there anything specific about our services I can explain?",
        type: 'general_inquiry'
      };
    }
  };

  const sendMessage = async () => {
    if (messageInput.trim() && !chatEnded) {
      const newMessage = {
        id: Date.now(),
        text: messageInput,
        sender: 'user',
        timestamp: new Date(),
        type: 'message'
      };
      
      setMessages(prev => [...prev, newMessage]);
      const currentMessage = messageInput;
      setMessageInput('');
      setIsTyping(true);
      
      try {
        if (sessionId && !connectionError) {
          // Try to send to backend
          const response = await axios.post(`${API_BASE_URL}/chat/message`, {
            sessionId,
            message: currentMessage
          });
          
          setTimeout(() => {
            setIsTyping(false);
            const botResponse = {
              id: Date.now() + 1,
              text: response.data.message,
              sender: 'bot',
              timestamp: new Date(response.data.timestamp),
              type: 'message'
            };
            setMessages(prev => [...prev, botResponse]);
          }, 1500);
        } else {
          throw new Error('No backend connection');
        }
        
      } catch (error) {
        console.error('Error sending message:', error);
        
        // Fallback to local response
        setTimeout(() => {
          setIsTyping(false);
          const localResponse = getBankingBotResponse(currentMessage);
          const botResponse = {
            id: Date.now() + 1,
            text: connectionError ? 
              `${localResponse.text} (Note: Running in offline mode)` : 
              "I'm sorry, I'm having trouble connecting to our servers. Please try again later or contact customer service at 1-800-BANK-HELP.",
            sender: 'bot',
            timestamp: new Date(),
            type: connectionError ? localResponse.type : 'error'
          };
          setMessages(prev => [...prev, botResponse]);
        }, 1500);
      }
    }
  };

  const endChat = async () => {
    setChatEnded(true);
    
    try {
      if (sessionId && !connectionError) {
        await axios.post(`${API_BASE_URL}/chat/end`, { sessionId });
      }
    } catch (error) {
      console.error('Error ending chat session:', error);
    }
    
    const endMessage = {
      id: Date.now(),
      text: "Thank you for using BankBot Assistant. Your chat session has been ended securely. We appreciate your time and hope we were able to help you today.",
      sender: 'bot',
      timestamp: new Date(),
      type: 'system'
    };
    
    setMessages(prev => [...prev, endMessage]);
    
    setTimeout(() => {
      setShowThankYouPage(true);
    }, 2000);
  };

  const restartChat = () => {
    setShowThankYouPage(false);
    setChatEnded(false);
    setSessionId(null);
    setMessages([]);
    setMessageInput('');
    setConnectionError(false);
    startNewChatSession();
  };

  const clearChat = async () => {
    if (!chatEnded && sessionId && !connectionError) {
      try {
        await axios.post(`${API_BASE_URL}/chat/end`, { sessionId });
      } catch (error) {
        console.error('Error ending previous session:', error);
      }
    }
    
    setMessages([]);
    setSessionId(null);
    setConnectionError(false);
    startNewChatSession();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to BankBot Assistant...</p>
          {connectionError && (
            <p className="text-orange-600 text-sm mt-2">Switching to offline mode...</p>
          )}
        </div>
      </div>
    );
  }

  // Thank You Page Component
  if (showThankYouPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Thank You for Using BankBot Assistant!
          </h1>
          
          <p className="text-lg text-gray-600 mb-6 leading-relaxed">
            We appreciate you taking the time to chat with our digital assistant. 
            Your session has been completed securely and all conversation data has been encrypted.
          </p>
          
          <div className="bg-blue-50 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Need More Help?</h3>
            <div className="space-y-2 text-sm text-blue-800">
              <p>📞 Customer Service: 1-800-BANK-HELP</p>
              <p>🌐 Online Banking: www.bankbot.com/login</p>
              <p>📍 Find a Branch: www.bankbot.com/locations</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={restartChat}
              className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 font-medium flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>Start New Chat</span>
            </button>
          </div>
          
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 flex items-center justify-center space-x-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span>Your privacy is protected. This session was secured with 256-bit encryption.</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a2 2 0 114 0 2 2 0 01-4 0zm8 0a2 2 0 114 0 2 2 0 01-4 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold">BankBot Assistant</h1>
              <p className="text-blue-100 text-sm">Your trusted banking companion</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full animate-pulse ${connectionError ? 'bg-orange-400' : 'bg-green-400'}`}></div>
              <span className="text-sm text-blue-100">
                {connectionError ? 'Offline Mode' : 'Secure Connection'}
              </span>
            </div>
            
            <button
              onClick={endChat}
              disabled={chatEnded}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-200 flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>End Chat</span>
            </button>
          </div>
        </div>

        {/* Chat Ended Overlay */}
        {chatEnded && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <div className="bg-white rounded-xl p-8 max-w-md mx-4 text-center shadow-2xl">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Chat Session Ended</h3>
              <p className="text-gray-600 mb-4">
                Thank you for using BankBot Assistant. You will be redirected to our contact page shortly.
              </p>
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                <span className="ml-2">Redirecting...</span>
              </div>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-xs lg:max-w-md ${message.sender === 'user' ? 'order-2' : 'order-1'}`}>
                {message.sender === 'bot' && (
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-600 font-medium">Banking Assistant</span>
                  </div>
                )}
                
                <div className={`px-4 py-3 rounded-2xl shadow-sm ${
                  message.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md ml-4'
                    : 'bg-white text-gray-800 rounded-bl-md border border-gray-200'
                } ${message.type === 'welcome' ? 'bg-green-50 text-green-800 border-green-200' : ''}
                  ${message.type === 'system' ? 'bg-red-50 text-red-800 border-red-200' : ''}
                  ${message.type === 'error' ? 'bg-orange-50 text-orange-800 border-orange-200' : ''}`}>
                  <p className="text-sm leading-relaxed">{message.text}</p>
                  <p className={`text-xs mt-2 ${
                    message.sender === 'user' 
                      ? 'text-blue-100' 
                      : 'text-gray-500'
                  }`}>
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          ))}
          
          {isTyping && !chatEnded && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                  <span className="text-sm text-gray-500">Assistant is typing...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className={`bg-white border-t border-gray-200 px-6 py-4 ${chatEnded ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={chatEnded ? "Chat session has ended" : "Ask me about your banking needs..."}
                rows="1"
                disabled={chatEnded}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none resize-none transition-all duration-200 text-gray-800 placeholder-gray-500 disabled:bg-gray-100"
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            </div>
            
            <button
              onClick={sendMessage}
              disabled={!messageInput.trim() || chatEnded}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
            >
              Send
            </button>
            
            <button
              onClick={clearChat}
              disabled={chatEnded}
              className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
            >
              Clear
            </button>
          </div>
          
          <div className="mt-3 flex items-center justify-center">
            <p className="text-xs text-gray-500 flex items-center space-x-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span>Your conversation is secured with 256-bit encryption</span>
              {connectionError && <span className="text-orange-500"> • Offline Mode Active</span>}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
