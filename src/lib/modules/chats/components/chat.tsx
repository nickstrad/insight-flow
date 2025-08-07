"use client";
import { useRef, useState, useCallback, useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { toast } from "sonner";
import { type Chat, ChatMessage, MessageRole } from "@/generated/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Send, MessageSquarePlus, Settings } from "lucide-react";
import ChannelsAndPlaylistForm from "./ChannelsAndPlaylistForm";

const renderMessageWithLinks = (message: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const cleanedMessage = message
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/^["']|["']$/g, ""); // Remove quotes from beginning/end
  const parts = cleanedMessage.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-600 underline break-all"
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

interface ChatProps {
  userEmail: string;
}

export const useChatHelpers = ({ userEmail }: { userEmail: string }) => {
  const [currentChat, setCurrentChat] = useState<Chat | undefined>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Get chats for user and channel
  const { data: chats, error: getAllChatsError } = useQuery(
    trpc.chats.getByUserEmail.queryOptions({
      userEmail,
    })
  );

  useEffect(() => {
    if (getAllChatsError) {
      toast.error(getAllChatsError.message);
    }
  }, [getAllChatsError]);

  // Create chat mutation
  const createChatHandler = useMutation(
    trpc.chats.create.mutationOptions({
      onError: (error) => {
        toast.error(error.message);
      },
      onSuccess: (newChat) => {
        toast.success("Chat created successfully!");
        queryClient.invalidateQueries(
          trpc.chats.getByUserEmail.queryOptions({
            userEmail,
          })
        );
        setCurrentChat(newChat);
      },
    })
  );

  // Create chat with first message mutation
  const createChatWithFirstMessageHandler = useMutation(
    trpc.chats.createChatWithFirstMessage.mutationOptions({
      onError: (error) => {
        toast.error(error.message);
      },
      onSuccess: (newChat) => {
        toast.success("Chat created successfully!");
        queryClient.invalidateQueries(
          trpc.chats.getByUserEmail.queryOptions({
            userEmail,
          })
        );
        setCurrentChat(newChat);
      },
    })
  );

  const updateTitleHandler = useMutation(
    trpc.chats.updateTitle.mutationOptions({
      onError: (error) => {
        toast.error(error.message);
      },
      onSuccess: (newChat) => {
        toast.success("Chat created successfully!");
        queryClient.invalidateQueries(
          trpc.chats.getByUserEmail.queryOptions({
            userEmail,
          })
        );
        setCurrentChat(newChat);
      },
    })
  );

  const deleteChatHandler = useMutation(
    trpc.chats.delete.mutationOptions({
      onError: (error) => {
        toast.error(error.message);
      },
      onSuccess: () => {
        toast.success("Chat created successfully!");
        queryClient.invalidateQueries(
          trpc.chats.getByUserEmail.queryOptions({
            userEmail,
          })
        );
        setCurrentChat(undefined);
      },
    })
  );

  const createChat = useCallback(
    async (title: string) => {
      return await createChatHandler.mutateAsync({
        userEmail,
        title,
      });
    },
    [createChatHandler, userEmail]
  );

  const createChatWithFirstMessage = useCallback(
    async (firstMessage: string) => {
      return await createChatWithFirstMessageHandler.mutateAsync({
        userEmail,
        firstMessage,
      });
    },
    [createChatWithFirstMessageHandler, userEmail]
  );

  const editChatTitle = useCallback(
    async ({ chatId, title }: { chatId: string; title: string }) => {
      if (!chatId || !title.trim()) {
        return;
      }

      return await updateTitleHandler.mutateAsync({
        id: chatId,
        title,
      });
    },
    [updateTitleHandler, currentChat?.id]
  );

  const deleteChat = useCallback(
    async (chatId: string) => {
      if (!chatId) {
        return;
      }

      return await deleteChatHandler.mutateAsync({
        id: chatId,
      });
    },
    [deleteChatHandler]
  );

  // Don't auto-select first chat anymore - user must manually select

  const toggleChat = (chatId: string) => {
    const chat = chats?.find((chat) => chat.id === chatId);
    if (chat) {
      setCurrentChat(chat);
    }
  };

  return {
    chats: chats || [],
    deleteChat,
    createChat,
    createChatWithFirstMessage,
    currentChat,
    setCurrentChat,
    editChatTitle,
    error: getAllChatsError?.message || "",
    isLoading:
      createChatHandler.isPending ||
      createChatWithFirstMessageHandler.isPending,
    toggleChat,
  };
};

export const useMessageHelpers = ({
  userEmail,
  chatId,
  isNewChatMode,
  setCurrentChat,
}: {
  chatId?: string;
  userEmail: string;
  isNewChatMode: boolean;
  setCurrentChat: (chat: Chat) => void;
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Get chat with messages when chatId changes
  const { data: chat, error: getChatError } = useQuery({
    ...trpc.chats.getById.queryOptions({ id: chatId || "" }),
    enabled: !!chatId, // Only run query when chatId exists
  });

  const {
    data: getAllChannelsForUserResponse,
    error: getAllChannelsForUserError,
  } = useSuspenseQuery(
    trpc.videos.getAllChannelsForUser.queryOptions({
      userEmail,
    })
  );
  useEffect(() => {
    if (getAllChannelsForUserError) {
      toast.error(getAllChannelsForUserError.message);
    }
  }, [getAllChannelsForUserError]);

  // Update messages when chat data changes
  useEffect(() => {
    if (chat?.messages) {
      setMessages(chat.messages);
    } else {
      setMessages([]);
    }
  }, [chat]);

  // Send message mutation
  const sendMessageHandler = useMutation(
    trpc.messages.handleUserQuery.mutationOptions({
      onError: (error) => {
        toast.error(error.message);
      },
      onSuccess: (result) => {
        // Add both user and assistant messages to local state
        setMessages((prev) => [
          ...prev,
          result.userMessage,
          result.assistantMessage,
        ]);
        // Invalidate chat query to get updated messages
        queryClient.invalidateQueries(
          trpc.chats.getById.queryOptions({ id: chatId || "" })
        );
      },
    })
  );

  // Create chat with first message mutation
  const createChatWithFirstMessageHandler = useMutation(
    trpc.chats.createChatWithFirstMessage.mutationOptions({
      onError: (error) => {
        toast.error(error.message);
      },
      onSuccess: (newChat) => {
        toast.success("Chat created successfully!");
        queryClient.invalidateQueries(
          trpc.chats.getByUserEmail.queryOptions({
            userEmail,
          })
        );
        setCurrentChat(newChat);
      },
    })
  );

  const sendMessage = async (
    message: string,
    userEmail: string
  ): Promise<boolean> => {
    try {
      // If no chat is selected or we're in new chat mode, create a new chat first
      if (!chatId || isNewChatMode) {
        const newChat = await createChatWithFirstMessageHandler.mutateAsync({
          userEmail,
          firstMessage: message,
        });

        // Now send the message to the newly created chat
        await sendMessageHandler.mutateAsync({
          userEmail,
          query: message,
          chatId: newChat.id,
        });
        return true;
      } else {
        // Normal message sending to existing chat
        await sendMessageHandler.mutateAsync({
          userEmail,
          query: message,
          chatId,
        });
        return true;
      }
    } catch (error) {
      return false;
    }
  };

  return {
    allChannels: getAllChannelsForUserResponse,
    messages,
    sendMessage,
    error: getChatError?.message || "",
    isLoading:
      sendMessageHandler.isPending ||
      createChatWithFirstMessageHandler.isPending,
  };
};

const useChatHandlers = ({ userEmail }: { userEmail: string }) => {
  const [newMessage, setNewMessage] = useState("");
  const [isNewChatMode, setIsNewChatMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    chats,
    deleteChat,
    createChat,
    editChatTitle,
    currentChat,
    setCurrentChat,
    toggleChat,
    error: chatError,
    isLoading: chatIsLoading,
  } = useChatHelpers({ userEmail });

  const {
    messages,
    sendMessage,
    error: messageError,
    isLoading: messageIsLoading,
  } = useMessageHelpers({
    chatId: currentChat?.id,
    userEmail,
    isNewChatMode,
    setCurrentChat,
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || messageIsLoading || chatIsLoading) return;

    // sendMessage now handles creating new chats when needed
    const success = await sendMessage(newMessage, userEmail);
    if (success) {
      setNewMessage("");
      // If we were in new chat mode, exit it since we just created a chat
      if (isNewChatMode) {
        setIsNewChatMode(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const startNewChat = () => {
    setIsNewChatMode(true);
    setCurrentChat(undefined); // Clear current chat to hide old messages
    setNewMessage("");
    inputRef.current?.focus();
  };

  const openSettings = () => {
    setIsSettingsOpen(true);
  };

  const closeSettings = () => {
    setIsSettingsOpen(false);
  };

  const handleContextUpdate = (channelHandles: string[], playlistIds: string[]) => {
    // Optionally refresh chat data or handle context update
    closeSettings();
  };

  return {
    chat: {
      chats,
      currentChat,
      toggleChat,
      createChat,
      deleteChat,
      editChatTitle,
      startNewChat,
      openSettings,
      closeSettings,
      isNewChatMode,
      isSettingsOpen,
      handleContextUpdate,
    },
    message: {
      messages,
      handleSubmit,
      handleKeyDown,
      messagesEndRef,
      inputRef,
      newMessage,
      setNewMessage,
    },
    isLoading: chatIsLoading || messageIsLoading,
    error: chatError || messageError,
  };
};

export default function Chat({ userEmail }: ChatProps) {
  const {
    chat: {
      chats,
      currentChat,
      toggleChat,
      createChat,
      startNewChat,
      openSettings,
      closeSettings,
      isNewChatMode,
      isSettingsOpen,
      handleContextUpdate,
    },
    message: {
      messages,
      handleSubmit,
      handleKeyDown,
      messagesEndRef,
      inputRef,
      newMessage,
      setNewMessage,
    },
    isLoading,
    error,
  } = useChatHandlers({ userEmail });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleModalSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const titleInput = form.elements.namedItem("title") as HTMLInputElement;
    const title = titleInput.value;

    if (title) {
      const newChat = await createChat(title);
      if (newChat) {
        toggleChat(newChat.id);
        titleInput.value = "";
      }
      setIsModalOpen(false);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Chat Sidebar - Fixed/Sticky */}
      <div className="w-1/4 flex flex-col h-full">
        <Card className="rounded-none border-r flex-shrink-0">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Chats</CardTitle>
              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Chat</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleModalSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        name="title"
                        placeholder="Enter a title for your new chat"
                        required
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsModalOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isLoading}>
                        Create
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
        </Card>
        <Card className="rounded-none border-r border-t-0 flex-1 overflow-hidden">
          <CardContent className="p-0 h-full">
            <ScrollArea className="h-full">
              <div className="space-y-1 p-2">
                {(chats || []).map((chat) => (
                  <Button
                    key={chat.id}
                    variant={
                      currentChat?.id === chat.id ? "secondary" : "ghost"
                    }
                    className="w-full justify-start text-left h-auto p-3"
                    onClick={() => toggleChat(chat.id)}
                    disabled={isLoading}
                  >
                    <span className="truncate">{chat.title}</span>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 h-full">
        {/* Chat Header - Fixed */}
        <Card className="rounded-none border-b border-l-0 border-r-0 border-t-0 flex-shrink-0">
          <CardHeader className="py-1 px-4">
            <div className="flex justify-between items-center">
              <CardTitle className="font-medium">
                {isNewChatMode ? "New Chat" : currentChat?.title ?? ""}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={openSettings}
                  disabled={isNewChatMode || !currentChat}
                  className="h-8 w-8"
                  title="Chat Settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={startNewChat}
                  className="h-8 w-8"
                  title="New Chat"
                >
                  <MessageSquarePlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Messages Container - Scrollable */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === MessageRole.USER
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <Card
                    className={`max-w-[80%] ${
                      message.role === MessageRole.USER
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <CardContent className="p-3">
                      <div className="whitespace-pre-line break-words text-sm">
                        {renderMessageWithLinks(message.message)}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}

              {/* Loading and Error Indicator */}
              {(isLoading || error) && (
                <div className="flex justify-start">
                  <Card
                    className={`${
                      error
                        ? "bg-destructive/10 border-destructive/20 text-destructive"
                        : "bg-muted"
                    }`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center space-x-2">
                        {isLoading && (
                          <>
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-100" />
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-200" />
                          </>
                        )}
                        {error && (
                          <span className="text-sm font-medium">{error}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Input Form - Fixed */}
        <Card className="rounded-none border-t border-l-0 border-r-0 border-b-0 flex-shrink-0">
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="flex space-x-2">
              <Textarea
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isNewChatMode
                    ? "Type your first message to create a new chat..."
                    : currentChat
                    ? "Type your message..."
                    : "Type a message to start a new chat..."
                }
                className="min-h-[2.5rem] max-h-32 resize-none"
                disabled={isLoading}
              />
              <Button
                type="submit"
                disabled={!newMessage.trim() || isLoading}
                size="icon"
                className="shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Settings Modal */}
      <Dialog open={isSettingsOpen} onOpenChange={(open) => { if (!open) closeSettings(); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Chat Settings</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto">
            {currentChat && (
              <ChannelsAndPlaylistForm
                chatId={currentChat.id}
                userEmail={userEmail}
                initialChannelHandles={currentChat.channelHandles || []}
                initialPlaylistIds={currentChat.playlistIds || []}
                onUpdate={handleContextUpdate}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
