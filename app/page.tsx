'use client';

import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Send, Bot } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dynamic from 'next/dynamic';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};


const EmptyState = () => (
  <div className="flex flex-col items-center justify-center h-full text-center p-4 sm:p-8 space-y-4">
    <Bot className="w-10 h-10 sm:w-12 sm:h-12 text-blue-500" />
    <h2 className="text-xl sm:text-2xl font-semibold">GroqBot</h2>
    <p className="text-gray-500 max-w-sm text-sm sm:text-base">
      an AI assistant powered by Llama 3.1 70B Versatile
    </p>
  </div>
);

const ChatInterface = dynamic(() => Promise.resolve(({
  messages,
  isLoading,
  input,
  setInput,
  handleSubmit,
  messagesEndRef
}: {
  messages: Message[];
  isLoading: boolean;
  input: string;
  setInput: (value: string) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}) => (
  <>
    <div className="p-2 sm:p-4 border-b bg-background sticky top-0 z-10">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 text-sm"
          disabled={isLoading}
        />
        <Button type="submit" size="icon" disabled={isLoading}>
          <Send className="h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
      </form>
      <p className="text-[10px] sm:text-xs text-center mt-2 text-muted-foreground">
        Powered by Llama 3.1 70B via Groq
      </p>
    </div>

    <main className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-3 sm:space-y-4">
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        messages.map((message, index) => (
          <div key={index} className="flex items-start gap-2 sm:gap-3">
            <Avatar className="w-6 h-6 sm:w-8 sm:h-8">
              <AvatarFallback className="text-xs sm:text-sm">
                {message.role === 'user' ? 'U' : 'AI'}
              </AvatarFallback>
            </Avatar>
            <Card className={`flex-1 ${message.role === 'assistant' ? 'bg-muted' : ''}`}>
              <CardContent className="p-2 sm:p-3 text-xs sm:text-sm break-words">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {message.role === 'user' ? (
                    message.content
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Style links
                        a: ({ children, ...props }) => (
                          <a {...props} className="text-blue-500 hover:underline">
                            {children}
                          </a>
                        ),
                        // Style code blocks
                        code: ({ children, ...props }) => (
                          <code {...props} className="bg-muted-foreground/20 rounded px-1 py-0.5">
                            {children}
                          </code>
                        ),
                        // Style lists
                        ul: ({ children, ...props }) => (
                          <ul {...props} className="list-disc pl-4 my-2">
                            {children}
                          </ul>
                        ),
                        ol: ({ children, ...props }) => (
                          <ol {...props} className="list-decimal pl-4 my-2">
                            {children}
                          </ol>
                        ),
                        // Add these new table-related components
                        table: ({ children, ...props }) => (
                          <div className="overflow-x-auto my-4">
                            <table {...props} className="min-w-full border-collapse border border-border">
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({ children, ...props }) => (
                          <thead {...props} className="bg-muted">
                            {children}
                          </thead>
                        ),
                        tbody: ({ children, ...props }) => (
                          <tbody {...props} className="divide-y divide-border">
                            {children}
                          </tbody>
                        ),
                        tr: ({ children, ...props }) => (
                          <tr {...props} className="even:bg-muted/50">
                            {children}
                          </tr>
                        ),
                        th: ({ children, ...props }) => (
                          <th {...props} className="px-4 py-2 text-left font-semibold border-r border-border last:border-r-0">
                            {children}
                          </th>
                        ),
                        td: ({ children, ...props }) => (
                          <td {...props} className="px-4 py-2 border-r border-border last:border-r-0">
                            {children}
                          </td>
                        ),
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ))
      )}
      {isLoading && (
        <div className="flex items-start gap-2 sm:gap-3">
          <Avatar className="w-6 h-6 sm:w-8 sm:h-8">
            <AvatarFallback className="text-xs sm:text-sm">AI</AvatarFallback>
          </Avatar>
          <Card className="flex-1 bg-muted">
            <CardContent className="p-2 sm:p-3">
              <div className="animate-pulse text-xs sm:text-sm">Thinking...</div>
            </CardContent>
          </Card>
        </div>
      )}
      <div ref={messagesEndRef} />
    </main>
  </>
)), { ssr: false });

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    const newMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, newMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, newMessage] }),
      });

      if (!response.ok) throw new Error('Failed to fetch');

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        setMessages(prev => [
          ...prev.slice(0, -1),
          {
            role: 'assistant',
            content: prev[prev.length - 1].content + chunk
          }
        ]);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'An error occurred while processing your request.'
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      <ChatInterface
        messages={messages}
        isLoading={isLoading}
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        messagesEndRef={messagesEndRef}
      />
    </div>
  );
}
