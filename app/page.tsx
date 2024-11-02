'use client';

import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Send, Bot } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dynamic from 'next/dynamic';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { useHotkeys } from 'react-hotkeys-hook';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type ChatMode = 'software' | 'notetaking' | 'research' | 'general';

type SuggestedPrompt = {
  mode: ChatMode;
  text: string;
};

const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  { mode: 'software', text: 'Explain time complexity in Big O notation' },
  { mode: 'software', text: 'What are the SOLID principles?' },
  { mode: 'notetaking', text: 'Summarize the key points from this text: ' },
  { mode: 'notetaking', text: 'Create a structured outline for: ' },
  { mode: 'research', text: 'What are the latest developments in: ' },
  { mode: 'research', text: 'Compare and contrast: ' },
  { mode: 'general', text: 'Help me understand: ' },
  { mode: 'general', text: 'Can you explain: ' },
];

const EmptyState = ({ mode }: { mode: ChatMode }) => (
  <div className="flex flex-col items-center justify-center h-full text-center p-4 sm:p-8 space-y-2">
    <Bot className="w-10 h-10 sm:w-12 sm:h-12 text-blue-500" />
    <h2 className="text-xl sm:text-2xl font-semibold">Groq70</h2>
    <p className="text-gray-500 max-w-sm text-sm sm:text-base">
      {mode === 'software' && 'high-performance technical assistant'}
      {mode === 'notetaking' && 'high-performance note-taking assistant'}
      {mode === 'research' && 'high-performance research assistant'}
      {mode === 'general' && 'high-performance general assistant'}
    </p>
  </div>
);

const ChatInterface = dynamic(() => Promise.resolve(({
  messages,
  isLoading,
  input,
  setInput,
  handleSubmit,
  messagesEndRef,
  mode,
  setMode,
  isCommandOpen,
  setIsCommandOpen,
  handleQuickSubmit,
}: {
  messages: Message[];
  isLoading: boolean;
  input: string;
  setInput: (value: string) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  mode: ChatMode;
  setMode: (mode: ChatMode) => void;
  isCommandOpen: boolean;
  setIsCommandOpen: (open: boolean) => void;
  handleQuickSubmit: (text: string, newMode?: ChatMode) => Promise<void>;
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

    <div className="fixed bottom-4 right-4 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 bg-background/80 backdrop-blur-sm border-muted-foreground/20 hover:bg-background/90 transition-all"
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${mode === 'software' ? 'bg-blue-500' :
                mode === 'notetaking' ? 'bg-green-500' :
                  mode === 'research' ? 'bg-purple-500' :
                    'bg-gray-400'
                }`}></div>
              <span className="text-xs">
                {mode === 'software' && 'Technical Interview'}
                {mode === 'notetaking' && 'Note Taking'}
                {mode === 'research' && 'Research'}
                {mode === 'general' && 'General Chat'}
              </span>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[200px] animate-in fade-in-0 zoom-in-95"
        >
          <DropdownMenuItem onClick={() => setMode('general')}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-400"></div>
              General Chat
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMode('software')}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              Technical Interview
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMode('notetaking')}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              Note Taking
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMode('research')}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              Research
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <main className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-3 sm:space-y-4">
      {messages.length === 0 ? (
        <EmptyState mode={mode} />
      ) : (
        messages.map((message, index) => (
          <div key={index} className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground ml-1">
              {message.role === 'user' ? 'You' : 'Groq70'}
            </span>
            <Card className={`w-full ${message.role === 'assistant' ? 'bg-muted' : ''}`}>
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
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground ml-1">Groq70</span>
          <Card className="w-full bg-muted">
            <CardContent className="p-2 sm:p-3">
              <div className="animate-pulse text-xs sm:text-sm">Thinking...</div>
            </CardContent>
          </Card>
        </div>
      )}
      <div ref={messagesEndRef} />
    </main>

    <CommandDialog open={isCommandOpen} onOpenChange={setIsCommandOpen}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) {
            handleQuickSubmit(input);
            setIsCommandOpen(false);
          }
        }}
        className="flex flex-col gap-4"
      >
        <div className="sr-only">Quick Chat Command Menu</div>
        <CommandInput
          placeholder="Type a message or select a suggestion..."
          value={input}
          onValueChange={setInput}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
              e.preventDefault();
              handleQuickSubmit(input);
              setIsCommandOpen(false);
            }
          }}
        />
        <CommandList className="max-h-[300px] overflow-y-auto">
          <CommandEmpty>No suggestions found.</CommandEmpty>
          <CommandGroup heading="Suggested Prompts">
            {SUGGESTED_PROMPTS.map((prompt, index) => (
              <CommandItem
                key={index}
                onSelect={() => {
                  handleQuickSubmit(prompt.text, prompt.mode);
                  setIsCommandOpen(false);
                }}
              >
                <div className={`w-2 h-2 rounded-full ${prompt.mode === 'software' ? 'bg-blue-500' :
                  prompt.mode === 'notetaking' ? 'bg-green-500' :
                    prompt.mode === 'research' ? 'bg-purple-500' :
                      'bg-gray-400'
                  }`}></div>
                {prompt.text}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </form>
    </CommandDialog>
  </>
)), { ssr: false });

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>('general');
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useHotkeys('meta+k, ctrl+k', (e) => {
    e.preventDefault();
    setIsCommandOpen(prev => !prev);
  }, {
    enableOnFormTags: true,
    preventDefault: true
  });

  const handleQuickSubmit = async (text: string, newMode?: ChatMode) => {
    if (newMode) {
      setMode(newMode);
    }
    setInput('');
    const fakeEvent = { preventDefault: () => { } } as React.FormEvent;
    await handleSubmit(fakeEvent, text);
  };

  async function handleSubmit(e: React.FormEvent, submittedText?: string) {
    e.preventDefault();
    const textToSubmit = submittedText || input;
    if (!textToSubmit.trim()) return;

    const newMessage = { role: 'user' as const, content: textToSubmit };
    setMessages(prev => [...prev, newMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, newMessage],
          mode
        }),
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
        mode={mode}
        setMode={setMode}
        isCommandOpen={isCommandOpen}
        setIsCommandOpen={setIsCommandOpen}
        handleQuickSubmit={handleQuickSubmit}
      />
    </div>
  );
}
