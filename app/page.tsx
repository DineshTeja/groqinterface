'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Send, Trash2, Minimize2, Command, FileEdit, Origami, FolderPlus, Folder, History, LogOut } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';

type CodeProps = {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

type Message = {
  role: 'user' | 'assistant';
  content: string;
  comments?: Comment[];
};

type ChatMode = 'software' | 'notetaking' | 'research' | 'general';

type SuggestedPrompt = {
  mode: ChatMode;
  text: string;
};

type Comment = {
  id: string;
  text: string;
  highlightedText?: string;
  messageIndex?: number;
  selectionStart?: number;
  selectionEnd?: number;
  createdAt: string;
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
  <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] sm:h-full text-center p-4 sm:p-8 space-y-4">
    <div className="relative">
      <div className="absolute inset-0 blur-lg bg-blue-500/20 rounded-full" />
      <div className="relative bg-gradient-to-tr from-blue-600 to-blue-400 rounded-lg p-1.5 shadow-lg transform-gpu transition-transform hover:scale-110 duration-300">
        <Origami className="w-6 h-6 sm:w-8 sm:h-8 text-white/90" />
      </div>
    </div>
    <div className="space-y-1">
      <h2 className="text-lg sm:text-xl font-semibold bg-gradient-to-r from-blue-400 to-blue-600 text-transparent bg-clip-text">
        Groq70
      </h2>
      <p className="text-gray-500 max-w-sm text-sm">
        {mode === 'software' && 'high-performance technical assistant'}
        {mode === 'notetaking' && 'high-performance note-taking assistant'}
        {mode === 'research' && 'high-performance research assistant'}
        {mode === 'general' && 'high-performance general assistant'}
      </p>
    </div>
  </div>
);

const CollectionSelect = ({
  selectedCollectionId,
  setSelectedCollectionId,
  collections
}: {
  selectedCollectionId: string | null;
  setSelectedCollectionId: (id: string | null) => void;
  collections: Database['public']['Tables']['collections']['Row'][];
}) => (
  <Select
    value={selectedCollectionId || "standard"}
    onValueChange={(value) => setSelectedCollectionId(value === "standard" ? null : value)}
  >
    <SelectTrigger className="w-full h-8 px-2 text-sm bg-background/50 backdrop-blur-sm border-muted-foreground/20 hover:bg-accent transition-colors">
      <SelectValue placeholder="Select Collection">
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-muted-foreground/70" />
          <span className="truncate">
            {selectedCollectionId
              ? collections.find(c => c.id === selectedCollectionId)?.name
              : 'Standard Chats'}
          </span>
        </div>
      </SelectValue>
    </SelectTrigger>
    <SelectContent className="min-w-[200px]">
      <SelectItem value="standard" className="hover:bg-accent">
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-muted-foreground/70" />
          <span className="truncate">Standard Chats</span>
        </div>
      </SelectItem>
      {collections.map((collection) => (
        <SelectItem key={collection.id} value={collection.id} className="hover:bg-accent">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-muted-foreground/70" />
            <span className="truncate">{collection.name}</span>
          </div>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const HighlightedMessage = ({ content, comments }: { content: string, comments: Comment[] }) => {
  const validComments = comments.filter(comment => {
    if (!comment.highlightedText || comment.selectionStart === undefined || comment.selectionEnd === undefined) {
      return false;
    }
    const textAtPosition = content.slice(comment.selectionStart, comment.selectionEnd);
    return textAtPosition === comment.highlightedText;
  });

  if (validComments.length === 0) {
    return <>{content}</>;
  }

  const sortedComments = [...validComments].sort((a, b) => {
    return (a.selectionStart || 0) - (b.selectionStart || 0);
  });

  let lastIndex = 0;
  const elements: JSX.Element[] = [];

  sortedComments.forEach((comment, index) => {
    if (comment.selectionStart === undefined || comment.selectionEnd === undefined) return;

    if (comment.selectionStart > lastIndex) {
      elements.push(
        <span key={`text-${index}`}>
          {content.slice(lastIndex, comment.selectionStart)}
        </span>
      );
    }

    elements.push(
      <span
        key={`highlight-${index}`}
        className="bg-yellow-500/20 rounded px-0.5 cursor-pointer hover:bg-yellow-500/30 transition-colors"
        title={comment.text}
      >
        {content.slice(comment.selectionStart, comment.selectionEnd)}
      </span>
    );

    lastIndex = comment.selectionEnd;
  });

  if (lastIndex < content.length) {
    elements.push(
      <span key="text-end">
        {content.slice(lastIndex)}
      </span>
    );
  }

  return <>{elements}</>;
};

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
  comments,
  handleQuickSubmit,
  setActiveComment,
  isMobile,
  isAddingComment,
  setIsAddingComment,
  addGeneralComment,
  activeComment,
  saveComment,
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
  comments: Comment[];
  handleQuickSubmit: (text: string, newMode?: ChatMode) => Promise<void>;
  setActiveComment: (comment: {
    messageIndex: number;
    selectionStart: number;
    selectionEnd: number;
    highlightedText: string;
  } | null) => void;
  isMobile: boolean;
  isAddingComment: boolean;
  setIsAddingComment: (isAdding: boolean) => void;
  addGeneralComment: (text: string) => Promise<void>;
  activeComment: {
    messageIndex: number;
    selectionStart: number;
    selectionEnd: number;
    highlightedText: string;
  } | null;
  saveComment: (text: string) => Promise<void>;
}) => (
  <>
    <main
      className="no-scrollbar flex-1 overflow-y-auto p-2 pb-[112px] sm:pb-[80px] sm:p-4 space-y-3 sm:space-y-4 h-[calc(100dvh-104px)] sm:h-[calc(100vh-80px)] mt-[48px] sm:mt-0"
      onMouseUp={() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          setActiveComment(null);
          return;
        }

        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;

        // Find the message element and its index
        const messageEl = container.parentElement?.closest('[data-message-index]');
        if (!messageEl) {
          setActiveComment(null);
          return;
        }

        const messageIndex = parseInt(messageEl.getAttribute('data-message-index') || '0');
        const selectedText = selection.toString();

        // Get all text nodes in the message
        const walker = document.createTreeWalker(
          messageEl,
          NodeFilter.SHOW_TEXT,
          null
        );

        let currentPos = 0;
        let startPos = -1;
        let node = walker.nextNode();

        // Find the start position by walking through text nodes
        while (node) {
          if (node === range.startContainer) {
            startPos = currentPos + range.startOffset;
            break;
          }
          currentPos += node.textContent?.length || 0;
          node = walker.nextNode();
        }

        if (startPos === -1) {
          setActiveComment(null);
          return;
        }

        const endPos = startPos + selectedText.length;

        setActiveComment({
          messageIndex,
          selectionStart: startPos,
          selectionEnd: endPos,
          highlightedText: selectedText
        });
      }}
    >
      {messages.length === 0 ? (
        <EmptyState mode={mode} />
      ) : (
        <div>
          {messages.map((message, index) => {
            // Get comments for this message
            const messageComments = comments.filter(c => c.messageIndex === index);

            return (
              <div
                key={index}
                className="flex flex-col gap-1 mb-1"
                data-message-index={index}
              >
                <span className="text-base text-muted-foreground ml-1">
                  {message.role === 'user' ? 'You' : 'Groq70'}
                </span>
                <Card className={`w-full ${message.role === 'assistant' ? 'bg-muted' : ''}`}>
                  <CardContent className="p-2 sm:p-3 text-base break-words">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {message.role === 'user' ? (
                        <HighlightedMessage
                          content={message.content}
                          comments={messageComments}
                        />
                      ) : (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ children, ...props }) => (
                              <a {...props} className="text-blue-500 hover:underline">
                                {children}
                              </a>
                            ),
                            code: ({ inline, children, ...props }: CodeProps) => {
                              if (inline) {
                                return (
                                  <code className="bg-muted-foreground/20 rounded px-1 py-0.5" {...props}>
                                    {children}
                                  </code>
                                )
                              }
                              return (
                                <code className="inline-block text-sm" {...props}>
                                  {children}
                                </code>
                              )
                            },
                            pre: ({ children }) => (
                              <div className="relative w-full my-3">
                                <pre className="overflow-x-auto p-2 rounded-lg bg-muted-foreground/10 text-sm">
                                  {children}
                                </pre>
                              </div>
                            ),
                            p: ({ children }) => {
                              if (typeof children === 'string') {
                                return (
                                  <p className="mb-2">
                                    <HighlightedMessage
                                      content={children}
                                      comments={messageComments}
                                    />
                                  </p>
                                );
                              }
                              if (React.Children.toArray(children).some(child =>
                                React.isValidElement(child) && child.type === 'pre'
                              )) {
                                return <>{children}</>;
                              }
                              return <p className="mb-2">{children}</p>;
                            },
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

                {/* Add inline comments for mobile view */}
                {messageComments.length > 0 && (
                  <div className="sm:hidden space-y-2 mt-1 mb-3">
                    {messageComments.map((comment) => (
                      <div
                        key={comment.id}
                        className="ml-4 pl-3 border-l-2 border-blue-500/20"
                      >
                        <div className="bg-blue-500/5 rounded-lg p-2">
                          {comment.highlightedText && (
                            <div className="text-sm text-muted-foreground mb-1 italic">
                              &ldquo;{comment.highlightedText}&rdquo;
                            </div>
                          )}
                          <div className="text-sm">{comment.text}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(comment.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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

    <div className="sm:sticky sm:top-0 fixed bottom-[48px] sm:bottom-4 left-0 right-0 z-10 bg-background/95 backdrop-blur-md sm:border-t">
      <div className="px-2 sm:px-4 max-w-3xl mx-auto">
        <div className="py-2 sm:py-4 flex flex-col gap-2">
          <form onSubmit={handleSubmit} className="relative flex items-center gap-2 bg-input rounded-md focus-within:ring-1 focus-within:ring-ring">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 text-base border-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[44px] focus-within:ring-blue-500/20"
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
              className="absolute right-1 top-1 bottom-1 h-auto hover:bg-blue-500/10 bg-blue-500/20 text-blue-500/80 hover:text-blue-500"
            >
              <Send className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </form>

          <p className="text-base text-center text-muted-foreground hidden sm:block">
            Powered by Llama 3.1 70B via Groq
          </p>
        </div>
      </div>
    </div>

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

    <Button
      variant="outline"
      size="icon"
      className="sm:hidden fixed right-4 bottom-[64px] z-50 h-10 w-10 rounded-full shadow-lg bg-background border-blue-500/20 hover:bg-blue-500/10 hover:text-blue-500"
      onClick={() => setIsAddingComment(true)}
    >
      <FileEdit className="h-4 w-4" />
    </Button>

    <Dialog open={isAddingComment && isMobile} onOpenChange={setIsAddingComment}>
      <DialogContent className="w-[90%] max-w-[350px] p-4 gap-2 rounded-xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg">
            {activeComment ? 'Add Comment to Selection' : 'New Comment'}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const text = formData.get('comment') as string;

            if (activeComment) {
              saveComment(text);
            } else {
              addGeneralComment(text);
            }

            e.currentTarget.reset();
          }}
        >
          {activeComment?.highlightedText && (
            <div className="text-sm bg-muted/50 p-2 rounded-md border">
              <span className="text-muted-foreground">Selected text:</span>
              <p className="mt-1 font-medium line-clamp-3">
                &ldquo;{activeComment.highlightedText}&rdquo;
              </p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Input
              name="comment"
              placeholder="Type your comment..."
              autoFocus
              className="flex-1"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAddingComment(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Save
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </>
)), { ssr: false });

const MobileTopBar = ({
  selectedCollectionId,
  setSelectedCollectionId,
  collections,
  chatHistories,
  selectedChatId,
  loadChat,
  deleteChat,
}: {
  selectedCollectionId: string | null;
  setSelectedCollectionId: (id: string | null) => void;
  collections: Database['public']['Tables']['collections']['Row'][];
  chatHistories: Database['public']['Tables']['chat_histories']['Row'][];
  selectedChatId: string | null;
  loadChat: (id: string) => void;
  deleteChat: (id: string) => void;
}) => (
  <div className="fixed top-0 inset-x-0 z-50 sm:hidden bg-background/95 backdrop-blur-md px-4 border-b h-[48px] flex items-center">
    <div className="max-w-4xl mx-auto w-full flex items-center gap-2">
      <CollectionSelect
        selectedCollectionId={selectedCollectionId}
        setSelectedCollectionId={setSelectedCollectionId}
        collections={collections}
      />

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
          >
            <History className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          alignOffset={-8}
          className="w-80 p-0"
          sideOffset={16}
        >
          <ChatHistoriesPopover
            chatHistories={chatHistories}
            selectedChatId={selectedChatId}
            loadChat={loadChat}
            deleteChat={deleteChat}
          />
        </PopoverContent>
      </Popover>
    </div>
  </div>
);

// First, add this helper function at the top level
const getModeColor = (mode: ChatMode) => {
  switch (mode) {
    case 'software':
      return 'bg-blue-500';
    case 'notetaking':
      return 'bg-green-500';
    case 'research':
      return 'bg-purple-500';
    default:
      return 'bg-gray-400';
  }
};

// Add this new component near the other components at the top level
const ChatHistoriesPopover = ({
  chatHistories,
  selectedChatId,
  loadChat,
  deleteChat,
}: {
  chatHistories: Database['public']['Tables']['chat_histories']['Row'][];
  selectedChatId: string | null;
  loadChat: (id: string) => void;
  deleteChat: (id: string) => void;
}) => (
  <div className="w-80 flex flex-col gap-2 p-2">
    <div className="max-h-[400px] overflow-y-auto space-y-1">
      {chatHistories.map((chat) => (
        <div
          key={chat.id}
          className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-blue-500/5 transition-colors text-sm ${selectedChatId === chat.id ? 'bg-blue-500/10' : ''
            }`}
          onClick={() => loadChat(chat.id)}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${getModeColor(chat.mode as ChatMode)}`} />
          <div className="flex-1 truncate">
            {chat.title}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 h-6 w-6 transition-opacity duration-200"
            onClick={(e) => {
              e.stopPropagation();
              deleteChat(chat.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      {chatHistories.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-4">
          No chat history yet
        </div>
      )}
    </div>
  </div>
);

const UserProfile = ({ user, onLogout }: { user: User | null, onLogout: () => void }) => (
  <div className="p-2 border-t bg-muted/30">
    <div className="flex items-center gap-2 p-2">
      <div className="w-8 h-8 rounded-full bg-muted-foreground/10 flex items-center justify-center">
        {user?.user_metadata?.avatar_url ? (
          <img
            src={user.user_metadata.avatar_url}
            alt="User avatar"
            className="w-full h-full rounded-full"
          />
        ) : (
          <span className="text-sm font-medium">
            {user?.email?.[0].toUpperCase() || '?'}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {user?.user_metadata?.full_name || user?.email || 'Anonymous'}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {user?.email}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={onLogout}
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  </div>
);

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
  const [collections, setCollections] = useState<Database['public']['Tables']['collections']['Row'][]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [isNewCollectionDialogOpen, setIsNewCollectionDialogOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const { user } = useAuth();
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [activeComment, setActiveComment] = useState<{
    messageIndex: number;
    selectionStart: number;
    selectionEnd: number;
    highlightedText: string;
  } | null>(null);
  const [isCommentsSidebarOpen, setIsCommentsSidebarOpen] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('user', user);
    };

    fetchUser();
  }, []);

  useEffect(() => {
    // If no user is authenticated, redirect to auth page
    if (!user) {
      router.replace('/auth');
    }
  }, [user, router]);

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
    let query = supabase
      .from('chat_histories')
      .select('*')
      .order('updated_at', { ascending: false });

    if (selectedCollectionId) {
      query = query.eq('collection_id', selectedCollectionId);
    } else {
      query = query.is('collection_id', null);
    }

    const { data, error } = await query;

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
    setMode(data.mode as ChatMode || 'general');
    setSelectedChatId(id);
    setComments(data.comments as Comment[] || []);
  };

  const loadCollections = async () => {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .order('created_at', { ascending: false });

    console.log('collections', data);

    if (error) {
      console.error('Error loading collections:', error);
      toast.error('Failed to load collections');
      return;
    }

    setCollections(data);
  };

  const createCollection = async () => {
    if (!newCollectionName.trim()) {
      toast.error('Please enter a collection name');
      return;
    }

    const { error } = await supabase
      .from('collections')
      .insert([{
        name: newCollectionName.trim(),
        user: user?.id
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating collection:', error);
      toast.error('Failed to create collection');
      return;
    }

    setNewCollectionName('');
    setIsNewCollectionDialogOpen(false);
    loadCollections();
    toast.success('Collection created successfully');
  };

  useEffect(() => {
    loadChatHistories();
    loadCollections();
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      const isMobileView = window.innerWidth < 640; // 640px is the 'sm' breakpoint
      const isNarrowScreen = window.innerWidth < 1280; // Add a breakpoint for narrow screens
      setIsMobile(isMobileView);

      if (isMobileView) {
        setIsSidebarOpen(false);
        setIsCommentsSidebarOpen(false);
      } else if (isNarrowScreen) {
        // On narrow screens, collapse at least one sidebar
        setIsCommentsSidebarOpen(false);
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
      setIsCommentsSidebarOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    loadChatHistories();
  }, [selectedCollectionId]);

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

      if (!response.ok) {
        toast.error(`HTTP error! status: ${response.status}`);
        return;
      }

      if (!response.body) {
        toast.error('Response body is null');
        return;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
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
        const { error: updateError } = await supabase
          .from('chat_histories')
          .update({
            messages: updatedMessages,
            mode,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedChatId);

        if (updateError) {
          console.error('Error updating chat:', updateError);
          toast.error('Failed to update chat history');
          return;
        }

        // Wait a brief moment for the database to update
        await new Promise(resolve => setTimeout(resolve, 100));

        // Reload the specific chat instead of all chats
        const { data: refreshedChat, error: refreshError } = await supabase
          .from('chat_histories')
          .select('*')
          .eq('id', selectedChatId)
          .single();

        if (refreshError) {
          console.error('Error refreshing chat:', refreshError);
          toast.error('Failed to refresh chat');
          return;
        }

        setMessages(refreshedChat.messages as Message[]);
        await loadChatHistories(); // Refresh the chat list
      } else {
        const title = newMessage.content.slice(0, 50) + (newMessage.content.length > 50 ? '...' : '');
        const { data, error: insertError } = await supabase
          .from('chat_histories')
          .insert([
            {
              title,
              messages: updatedMessages,
              mode,
              collection_id: selectedCollectionId,
              comments: comments,
            },
          ])
          .select()
          .single();

        if (insertError) {
          console.error('Error creating chat:', insertError);
          toast.error('Failed to create chat history');
        } else {
          setSelectedChatId(data.id);
          await loadChatHistories();
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev.slice(0, -1), {
        role: 'assistant',
        content: 'Sorry, there was an error processing your request. Please try again.'
      }]);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  const updateChatMode = async (newMode: ChatMode) => {
    setMode(newMode);

    if (!selectedChatId) {
      return;
    }

    console.log('updating chat mode to', newMode);

    const { error } = await supabase
      .from('chat_histories')
      .update({
        mode: newMode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedChatId);

    if (error) {
      console.error('Error updating chat mode:', error);
      toast.error('Failed to update chat mode');
      setMode(mode);
      return;
    }

    await loadChatHistories();
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Error signing out');
      return;
    }
    router.push('/auth');
  };

  // const handleTextSelection = () => {
  //   const selection = window.getSelection();
  //   if (!selection || selection.isCollapsed) {
  //     setActiveComment(null);
  //     return;
  //   }

  //   const range = selection.getRangeAt(0);
  //   const container = range.commonAncestorContainer;

  //   // Find the message element and its index
  //   const messageEl = container.parentElement?.closest('[data-message-index]');
  //   if (!messageEl) {
  //     setActiveComment(null);
  //     return;
  //   }

  //   const messageIndex = parseInt(messageEl.getAttribute('data-message-index') || '0');
  //   const message = messages[messageIndex];
  //   if (!message) {
  //     setActiveComment(null);
  //     return;
  //   }

  //   const selectedText = selection.toString();

  //   // Get all text nodes in the message
  //   const walker = document.createTreeWalker(
  //     messageEl,
  //     NodeFilter.SHOW_TEXT,
  //     null
  //   );

  //   let currentPos = 0;
  //   let startPos = -1;
  //   let node = walker.nextNode();

  //   // Find the start position by walking through text nodes
  //   while (node) {
  //     if (node === range.startContainer) {
  //       startPos = currentPos + range.startOffset;
  //       break;
  //     }
  //     currentPos += node.textContent?.length || 0;
  //     node = walker.nextNode();
  //   }

  //   if (startPos === -1) {
  //     setActiveComment(null);
  //     return;
  //   }

  //   const endPos = startPos + selectedText.length;

  //   // Verify the selection matches
  //   if (message.content.slice(startPos, endPos) !== selectedText) {
  //     setActiveComment(null);
  //     return;
  //   }

  //   setActiveComment({
  //     messageIndex,
  //     selectionStart: startPos,
  //     selectionEnd: endPos,
  //     highlightedText: selectedText
  //   });
  // };

  const saveComment = async (text: string) => {
    // If text is empty or only whitespace, just clear the active comment
    if (!text.trim() || !activeComment) {
      setActiveComment(null);
      return;
    }

    const newComment: Comment = {
      id: crypto.randomUUID(),
      text: text.trim(),
      highlightedText: activeComment.highlightedText,
      messageIndex: activeComment.messageIndex,
      selectionStart: activeComment.selectionStart,
      selectionEnd: activeComment.selectionEnd,
      createdAt: new Date().toISOString()
    };

    // Add comment to local state
    setComments(prev => [...prev, newComment]);
    setActiveComment(null);

    // If we have a selected chat, update the comments in Supabase
    if (selectedChatId) {
      const { error } = await supabase
        .from('chat_histories')
        .update({
          comments: [...comments, newComment],
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedChatId);

      if (error) {
        console.error('Error saving comment:', error);
        toast.error('Failed to save comment');
        // Rollback the comment if save failed
        setComments(prev => prev.filter(c => c.id !== newComment.id));
      }
    }
  };

  const addGeneralComment = async (text: string) => {
    // If text is empty or only whitespace, don't create the comment
    if (!text.trim()) {
      setIsAddingComment(false);
      return;
    }

    const newComment: Comment = {
      id: crypto.randomUUID(),
      text: text.trim(),
      createdAt: new Date().toISOString()
    };

    // Add comment to local state
    setComments(prev => [...prev, newComment]);
    setIsAddingComment(false);

    // If we have a selected chat, update the comments in Supabase
    if (selectedChatId) {
      const { error } = await supabase
        .from('chat_histories')
        .update({
          comments: [...comments, newComment],
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedChatId);

      if (error) {
        console.error('Error saving comment:', error);
        toast.error('Failed to save comment');
        // Rollback the comment if save failed
        setComments(prev => prev.filter(c => c.id !== newComment.id));
      }
    }
  };

  const deleteComment = async (commentId: string) => {
    // Remove comment from local state
    setComments(prev => prev.filter(c => c.id !== commentId));

    // If we have a selected chat, update the comments in Supabase
    if (selectedChatId) {
      const { error } = await supabase
        .from('chat_histories')
        .update({
          comments: comments.filter(c => c.id !== commentId),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedChatId);

      if (error) {
        console.error('Error deleting comment:', error);
        toast.error('Failed to delete comment');
        // Restore the comment if delete failed
        setComments(prev => [...prev, comments.find(c => c.id === commentId)!]);
      }
    }
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <MobileTopBar
        selectedCollectionId={selectedCollectionId}
        setSelectedCollectionId={setSelectedCollectionId}
        collections={collections}
        chatHistories={chatHistories}
        selectedChatId={selectedChatId}
        loadChat={loadChat}
        deleteChat={deleteChat}
      />

      {/* Left Sidebar */}
      <div className={`hidden sm:block ${isSidebarOpen ? 'sm:w-64' : 'sm:w-10'} border-r bg-muted/50 transition-all duration-300 ease-in-out overflow-hidden sticky top-0 h-screen`}>
        {isSidebarOpen ? (
          <div className="flex flex-col h-full opacity-100 transition-opacity duration-300 ease-in-out">
            <div className="p-2 border-b bg-background">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/20"
                  onClick={() => {
                    setSelectedChatId(null);
                    setMessages([]);
                    setMode('general');
                  }}
                >
                  <FileEdit className="mr-1 h-3 w-3" />
                  New Chat
                </Button>
                <Dialog open={isNewCollectionDialogOpen} onOpenChange={setIsNewCollectionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/20"
                    >
                      <FolderPlus className="h-3 w-3" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[90%] max-w-[350px] p-4 gap-2 rounded-xl">
                    <DialogHeader className="pb-2">
                      <DialogTitle className="text-lg">New Collection</DialogTitle>
                    </DialogHeader>
                    <div className="flex gap-2">
                      <Input
                        value={newCollectionName}
                        onChange={(e) => setNewCollectionName(e.target.value)}
                        placeholder="Collection name"
                        className="flex-1"
                        autoFocus
                      />
                      <Button
                        onClick={createCollection}
                        disabled={!newCollectionName.trim()}
                      >
                        Create
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              <div className="space-y-1">
                <CollectionSelect
                  selectedCollectionId={selectedCollectionId}
                  setSelectedCollectionId={setSelectedCollectionId}
                  collections={collections}
                />
              </div>

              {chatHistories.length > 0 ? (
                <div className="opacity-100 transition-opacity duration-300 ease-in-out delay-150">
                  {chatHistories.map((chat) => (
                    <div
                      key={chat.id}
                      className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-blue-500/5 transition-colors ${selectedChatId === chat.id ? 'bg-blue-500/10' : ''
                        }`}
                      onClick={() => loadChat(chat.id)}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${getModeColor(chat.mode as ChatMode)}`} />
                      <div className="flex-1 truncate text-base">
                        {chat.title}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 transition-opacity duration-200"
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
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No chat history yet
                </div>
              )}
            </div>
            <UserProfile user={user} onLogout={handleLogout} />
          </div>
        ) : (
          <div className="w-10 flex flex-col items-center py-2 gap-2 opacity-100 transition-opacity duration-300 ease-in-out">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-blue-500/10 hover:text-blue-500"
                    onClick={() => setIsSidebarOpen(true)}
                  >
                    <div className="flex items-center text-[10px] text-muted-foreground/70 hover:text-blue-500 transition-colors">
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

              <Tooltip>
                <TooltipTrigger asChild>
                  <Dialog open={isNewCollectionDialogOpen} onOpenChange={setIsNewCollectionDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                      >
                        <FolderPlus className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[90%] max-w-[350px] p-4 gap-2 rounded-xl">
                      <DialogHeader className="pb-2">
                        <DialogTitle className="text-lg">New Collection</DialogTitle>
                      </DialogHeader>
                      <div className="flex gap-2">
                        <Input
                          value={newCollectionName}
                          onChange={(e) => setNewCollectionName(e.target.value)}
                          placeholder="Collection name"
                          className="flex-1"
                          autoFocus
                        />
                        <Button
                          onClick={createCollection}
                          disabled={!newCollectionName.trim()}
                        >
                          Create
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex items-center">
                  New Collection
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                      >
                        <History className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="right"
                      align="start"
                      alignOffset={-8}
                      className="p-0 w-auto ml-2 relative"
                      sideOffset={16}
                    >
                      <div className="absolute left-[-6px] top-[10px] w-3 h-3 rotate-45 bg-popover border-l border-t border-border" />
                      <div className="relative">
                        <ChatHistoriesPopover
                          chatHistories={chatHistories}
                          selectedChatId={selectedChatId}
                          loadChat={loadChat}
                          deleteChat={deleteChat}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex items-center">
                  View Chat History
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>

      {/* Center container for messages */}
      <div className="flex-1 flex justify-center overflow-hidden relative">
        {/* Messages container with fixed width */}
        <div className={`w-full ${isCommentsSidebarOpen ? 'sm:max-w-[calc(100%-21rem)]' : 'max-w-4xl'} flex-shrink-0 relative transition-all duration-300 mx-auto`}>
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
            comments={comments}
            handleQuickSubmit={handleQuickSubmit}
            setActiveComment={setActiveComment}
            isMobile={isMobile}
            isAddingComment={isAddingComment}
            setIsAddingComment={setIsAddingComment}
            addGeneralComment={addGeneralComment}
            activeComment={activeComment}
            saveComment={saveComment}
          />
        </div>

        {/* Comments sidebar - collapsible */}
        <div className={`hidden sm:block ${isCommentsSidebarOpen ? 'w-80' : 'w-10'} border-l bg-muted/5 transition-all duration-300 ease-in-out`}>
          {isCommentsSidebarOpen ? (
            <div className="w-full flex flex-col h-full opacity-100 transition-opacity duration-300 ease-in-out overflow-y-auto">
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-muted-foreground">Comments</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => setIsAddingComment(true)}
                    >
                      Add Comment
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setIsCommentsSidebarOpen(false)}
                    >
                      <Minimize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  {(isAddingComment || activeComment) && (
                    <Card className="p-3">
                      <form
                        className="space-y-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const formData = new FormData(e.currentTarget);
                          const text = formData.get('comment') as string;

                          if (activeComment) {
                            saveComment(text);
                          } else {
                            addGeneralComment(text);
                          }

                          e.currentTarget.reset();
                        }}
                      >
                        {activeComment?.highlightedText && (
                          <div className="font-medium text-muted-foreground mb-2">
                            &ldquo;{activeComment.highlightedText}&rdquo;
                          </div>
                        )}
                        <Input
                          name="comment"
                          placeholder="Type your comment..."
                          autoFocus
                          className="text-sm"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (activeComment) {
                                saveComment('');
                              } else {
                                setIsAddingComment(false);
                              }
                            }}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" size="sm">
                            Save
                          </Button>
                        </div>
                      </form>
                    </Card>
                  )}

                  {comments.length === 0 && !isAddingComment && !activeComment ? (
                    <p className="text-sm text-muted-foreground">
                      No comments yet. Add a comment or select text to comment on specific content.
                    </p>
                  ) : (
                    comments.map(comment => (
                      <Card key={comment.id} className="p-3 text-sm group relative">
                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => deleteComment(comment.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {comment.highlightedText && (
                          <div className="font-medium text-muted-foreground mb-1">
                            &ldquo;{comment.highlightedText}&rdquo;
                          </div>
                        )}
                        <div className="pr-6">{comment.text}</div>
                        <div className="text-xs text-muted-foreground mt-2">
                          {new Date(comment.createdAt).toLocaleString()}
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center py-2 gap-2">
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setIsCommentsSidebarOpen(true)}
                    >
                      <FileEdit className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="flex items-center">
                    Show Comments
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>

      {isSidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 sm:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="fixed bottom-0.5 inset-x-0 z-40 sm:hidden bg-background/95 backdrop-blur-md px-4 border-none h-[48px] flex items-center">
        <div className="max-w-4xl mx-auto w-full">
          <div className="bg-background border rounded-lg flex items-center justify-between gap-2 shadow-lg p-1 mb-1">
            {/* <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button> */}

            <Button
              variant="outline"
              className="flex-1 h-8 text-xs hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/20"
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
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsNewCollectionDialogOpen(true)}
            >
              <FolderPlus className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${mode === 'software' ? 'bg-blue-500' :
                      mode === 'notetaking' ? 'bg-green-500' :
                        mode === 'research' ? 'bg-purple-500' :
                          'bg-gray-400'
                      }`} />
                    <span className="text-xs">
                      {mode === 'software' ? 'Tech' :
                        mode === 'notetaking' ? 'Notes' :
                          mode === 'research' ? 'Research' :
                            'General'}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[200px] animate-in fade-in-0 zoom-in-95"
              >
                <DropdownMenuItem onClick={() => updateChatMode('general')}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                    General Chat
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateChatMode('software')}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    Technical Interview
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateChatMode('notetaking')}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    Note Taking
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateChatMode('research')}>
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
  );
}
