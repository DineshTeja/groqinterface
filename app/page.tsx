'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Send, Bot, Trash2, Minimize2, Menu, Command, FileEdit } from "lucide-react";
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
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Database } from "@/types/supabase";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] sm:h-full text-center p-4 sm:p-8 space-y-2">
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
  isCommandOpen: boolean;
  setIsCommandOpen: (open: boolean) => void;
  handleQuickSubmit: (text: string, newMode?: ChatMode) => Promise<void>;
}) => (
  <>
    <div className="sm:sticky sm:top-0 fixed bottom-[56px] sm:bottom-auto left-0 right-0 z-10 bg-background/95 backdrop-blur-md border-t sm:border-t-0 sm:border-b px-4 sm:px-2">
      <div className="max-w-4xl mx-auto">
        <div className="py-2 sm:py-4 flex flex-col gap-2">
          <form onSubmit={handleSubmit} className="relative flex items-center gap-2 bg-input rounded-md focus-within:ring-1 focus-within:ring-ring">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={isLoading}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
            <Button 
              type="submit" 
              size="icon" 
              disabled={isLoading}
              className="absolute right-1 top-1 bottom-1 h-auto"
            >
              <Send className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </form>
          
          <p className="text-[10px] sm:text-xs text-center text-muted-foreground hidden sm:block">
            Powered by Llama 3.1 70B via Groq
          </p>
        </div>
      </div>
    </div>

    <main className="flex-1 overflow-y-auto p-2 pb-[140px] sm:pb-4 sm:p-4 space-y-3 sm:space-y-4 h-[calc(100dvh-112px)] sm:h-[calc(100vh-80px)]">
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
  const [chatHistories, setChatHistories] = useState<Database['public']['Tables']['chat_histories']['Row'][]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useHotkeys('meta+k, ctrl+k', (e) => {
    e.preventDefault();
    setIsCommandOpen(prev => !prev);
  }, {
    enableOnFormTags: true,
    preventDefault: true
  });

  useHotkeys('meta+e, ctrl+e', (e) => {
    e.preventDefault();
    setIsSidebarOpen(prev => !prev);
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

  const loadChatHistories = async () => {
    const { data, error } = await supabase
      .from('chat_histories')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error loading chat histories:', error);
      toast.error('Failed to load chat histories');
      return;
    }

    setChatHistories(data);
  };

  const deleteChat = async (id: string) => {
    const { error } = await supabase
      .from('chat_histories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting chat:', error);
      toast.error('Failed to delete chat');
      return;
    }

    if (selectedChatId === id) {
      setSelectedChatId(null);
      setMessages([]);
    }
    loadChatHistories();
    toast.success('Chat deleted successfully');
  };

  const loadChat = async (id: string) => {
    const { data, error } = await supabase
      .from('chat_histories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error loading chat:', error);
      toast.error('Failed to load chat');
      return;
    }

    setMessages(data.messages as Message[]);
    setMode(data.mode as ChatMode);
    setSelectedChatId(id);
  };

  useEffect(() => {
    loadChatHistories();
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      const isMobileView = window.innerWidth < 640; // 640px is the 'sm' breakpoint
      setIsMobile(isMobileView);
      if (isMobileView) {
        setIsSidebarOpen(false);
      }
    };

    // Check initial screen size
    checkMobile();

    // Add event listener for window resize
    window.addEventListener('resize', checkMobile);

    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [isMobile]);

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
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        fullResponse += chunk;
        setMessages(prev => [
          ...prev.slice(0, -1),
          {
            role: 'assistant',
            content: prev[prev.length - 1].content + chunk
          }
        ]);
      }

      const updatedMessages = [...messages, newMessage, { role: 'assistant', content: fullResponse }];
      
      if (selectedChatId) {
        const { error } = await supabase
          .from('chat_histories')
          .update({
            messages: updatedMessages,
          })
          .eq('id', selectedChatId);

        if (error) {
          console.error('Error updating chat:', error);
          toast.error('Failed to update chat history');
        }
      } else {
        const title = newMessage.content.slice(0, 50) + (newMessage.content.length > 50 ? '...' : '');
        const { data, error } = await supabase
          .from('chat_histories')
          .insert([
            {
              title,
              messages: updatedMessages,
              mode,
            },
          ])
          .select()
          .single();

        if (error) {
          console.error('Error creating chat:', error);
          toast.error('Failed to create chat history');
        } else {
          setSelectedChatId(data.id);
          loadChatHistories();
        }
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
    <div className="flex h-screen">
      <div 
        className={`hidden sm:block ${
          isSidebarOpen ? 'sm:w-64' : 'sm:w-10'
        } border-r bg-muted/50 transition-all duration-300 overflow-hidden sticky top-0 h-screen`}
      >
        {isSidebarOpen ? (
          // Expanded sidebar content
          <div className="flex flex-col h-full">
            <div className="p-4 border-b bg-background flex items-center gap-2">
              <Button
                variant="outline"
                className="flex-1 text-xs sm:text-sm"
                onClick={() => {
                  setSelectedChatId(null);
                  setMessages([]);
                  setMode('general');
                }}
              >
                <FileEdit className="mr-2 h-4 w-4" />
                New Chat
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsSidebarOpen(false)}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {chatHistories.map((chat) => (
                <div
                  key={chat.id}
                  className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-muted transition-colors ${
                    selectedChatId === chat.id ? 'bg-muted' : ''
                  }`}
                  onClick={() => loadChat(chat.id)}
                >
                  <div className="flex-1 truncate text-xs sm:text-sm">
                    {chat.title}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(chat.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Collapsed sidebar content
          <div className="w-10 flex flex-col items-center py-2 gap-4">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-transparent"
                    onClick={() => setIsSidebarOpen(true)}
                  >
                    <div className="flex items-center text-[10px] text-muted-foreground/70 hover:text-muted-foreground transition-colors">
                      <Command className="h-2.5 w-2.5" />
                      <span className="ml-[2px]">E</span>
                    </div>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex items-center">
                  Expand Sidebar
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setSelectedChatId(null);
                      setMessages([]);
                      setMode('general');
                    }}
                  >
                    <FileEdit className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex items-center">
                  New Chat
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>

      <div 
        className={`
          fixed inset-x-0 bottom-0 z-50
          transform transition-transform duration-300 ease-in-out
          ${!isMobile ? 'sm:hidden' : ''}
          ${isSidebarOpen ? 'translate-y-0' : 'translate-y-full'}
          ${isMobile ? '' : 'hidden'}
        `}
      >
        <div className="bg-background border-t rounded-t-lg max-h-[80vh] flex flex-col shadow-lg">
          <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-background rounded-t-lg">
            <h2 className="font-semibold">Chat History</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsSidebarOpen(false)}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="overflow-y-auto p-2 space-y-2 flex-1">
            {chatHistories.map((chat) => (
              <div
                key={chat.id}
                className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-muted transition-colors ${
                  selectedChatId === chat.id ? 'bg-muted' : ''
                }`}
                onClick={() => {
                  loadChat(chat.id);
                  setIsSidebarOpen(false);
                }}
              >
                <div className="flex-1 truncate text-sm">
                  {chat.title}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(chat.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {chatHistories.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">
                No chat history yet
              </div>
            )}
          </div>
          <div className="h-16" /> {/* Add padding at bottom to account for toolbar */}
        </div>
      </div>

      {isSidebarOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 sm:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col w-full relative">
        <div className="max-w-4xl mx-auto w-full">
          <ChatInterface
            messages={messages}
            isLoading={isLoading}
            input={input}
            setInput={setInput}
            handleSubmit={handleSubmit}
            messagesEndRef={messagesEndRef}
            mode={mode}
            isCommandOpen={isCommandOpen}
            setIsCommandOpen={setIsCommandOpen}
            handleQuickSubmit={handleQuickSubmit}
          />
        </div>

        <div className="fixed bottom-4 right-4 z-40 hidden sm:block">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 bg-background/80 backdrop-blur-sm border-muted-foreground/20"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    mode === 'software' ? 'bg-blue-500' :
                    mode === 'notetaking' ? 'bg-green-500' :
                    mode === 'research' ? 'bg-purple-500' :
                    'bg-gray-400'
                  }`} />
                  <span className="text-xs">
                    {mode === 'software' && 'Technical'}
                    {mode === 'notetaking' && 'Notes'}
                    {mode === 'research' && 'Research'}
                    {mode === 'general' && 'General'}
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

        <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-background/95 backdrop-blur-md px-4 border-t h-[56px] flex items-center">
          <div className="max-w-4xl mx-auto w-full">
            <div className="bg-background border rounded-lg p-2 flex items-center justify-between gap-2 shadow-lg h-[48px]">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                className="flex-1 h-8 text-xs"
                onClick={() => {
                  setSelectedChatId(null);
                  setMessages([]);
                  setMode('general');
                }}
              >
                <FileEdit className="mr-2 h-4 w-4" />
                New Chat
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        mode === 'software' ? 'bg-blue-500' :
                        mode === 'notetaking' ? 'bg-green-500' :
                        mode === 'research' ? 'bg-purple-500' :
                        'bg-gray-400'
                      }`} />
                      <span className="text-xs">
                        {mode === 'software' && 'Technical'}
                        {mode === 'notetaking' && 'Notes'}
                        {mode === 'research' && 'Research'}
                        {mode === 'general' && 'General'}
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
          </div>
        </div>
      </div>
    </div>
  );
}
