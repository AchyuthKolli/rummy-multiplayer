import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from 'app';
import { MessageResponse } from 'types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, X } from 'lucide-react';

interface Props {
  tableId: string;
  userId: string;
  isOpen: boolean;
  onToggle: () => void;
}

export const ChatPanel: React.FC<Props> = ({ tableId, userId, isOpen, onToggle }) => {
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 2000); // Poll every 2s
    return () => clearInterval(interval);
  }, [tableId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadMessages = async () => {
    try {
      const response = await apiClient.get_messages({ table_id: tableId });
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await apiClient.send_message({ table_id: tableId, message: newMessage.trim() });
      setNewMessage('');
      await loadMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed right-4 bottom-4 bg-green-600 hover:bg-green-700 text-white p-4 rounded-full shadow-lg z-50 transition-all"
          title="Open Chat"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat Sidebar */}
      {isOpen && (
        <div className="fixed right-0 top-0 h-full w-80 bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
            <h3 className="font-bold text-white flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-500" />
              Table Chat
            </h3>
            <Button variant="ghost" size="sm" onClick={onToggle}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg ${
                    msg.user_id === userId
                      ? 'bg-green-600/20 border border-green-600/30 ml-8'
                      : msg.is_system
                      ? 'bg-amber-600/20 border border-amber-600/30 text-center'
                      : 'bg-slate-800 border border-slate-700 mr-8'
                  }`}
                >
                  {!msg.is_system && (
                    <div className="text-xs text-slate-400 mb-1">
                      {msg.user_id === userId ? 'You' : msg.user_email?.split('@')[0] || 'Player'}
                      {msg.private_to && <span className="ml-2 text-amber-400">(Private)</span>}
                    </div>
                  )}
                  <div className={`text-sm ${
                    msg.is_system ? 'text-amber-300 font-medium' : 'text-white'
                  }`}>
                    {msg.message}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-slate-700 bg-slate-800">
            <div className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                disabled={sending}
                className="flex-1 bg-slate-900 border-slate-700 text-white"
              />
              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                className="bg-green-600 hover:bg-green-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
