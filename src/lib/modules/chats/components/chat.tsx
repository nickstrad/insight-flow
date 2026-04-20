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
import { useUid } from "@/lib/uid";

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
          className="break-all text-blue-500 underline hover:text-blue-600"
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

export const useChatHelpers = ({ uid }: { uid: string }) => {
  const [currentChat, setCurrentChat] = useState<Chat | undefined>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Get chats for user and channel
  const { data: chats, error: getAllChatsError } = useQuery(
    trpc.chats.getByUid.queryOptions({
      uid,
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
          trpc.chats.getByUid.queryOptions({
            uid,
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
          trpc.chats.getByUid.queryOptions({
            uid,
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
        toast.success("Chat title updated!");
        queryClient.invalidateQueries(
          trpc.chats.getByUid.queryOptions({
            uid,
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
        toast.success("Chat deleted!");
        queryClient.invalidateQueries(
          trpc.chats.getByUid.queryOptions({
            uid,
          })
        );
        setCurrentChat(undefined);
      },
    })
  );

  const createChat = useCallback(
    async (title: string) => {
      return await createChatHandler.mutateAsync({
        uid,
        title,
      });
    },
    [createChatHandler, uid]
  );

  const createChatWithFirstMessage = useCallback(
    async (firstMessage: string) => {
      return await createChatWithFirstMessageHandler.mutateAsync({
        uid,
        firstMessage,
      });
    },
    [createChatWithFirstMessageHandler, uid]
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
  uid,
  chatId,
  isNewChatMode,
  setCurrentChat,
}: {
  chatId?: string;
  uid: string;
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
  } = useSuspenseQuery(trpc.videos.getAllChannelsForUser.queryOptions());
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
          trpc.chats.getByUid.queryOptions({
            uid,
          })
        );
        setCurrentChat(newChat);
      },
    })
  );

  const sendMessage = async (message: string): Promise<boolean> => {
    try {
      // If no chat is selected or we're in new chat mode, create a new chat first
      if (!chatId || isNewChatMode) {
        const newChat = await createChatWithFirstMessageHandler.mutateAsync({
          uid,
          firstMessage: message,
        });

        // Now send the message to the newly created chat
        await sendMessageHandler.mutateAsync({
          query: message,
          chatId: newChat.id,
        });
        return true;
      } else {
        // Normal message sending to existing chat
        await sendMessageHandler.mutateAsync({
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

const useChatHandlers = ({ uid }: { uid: string }) => {
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
  } = useChatHelpers({ uid });

  const {
    messages,
    sendMessage,
    error: messageError,
    isLoading: messageIsLoading,
  } = useMessageHelpers({
    chatId: currentChat?.id,
    uid,
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
    const success = await sendMessage(newMessage);
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

  const handleContextUpdate = () => {
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

export default function Chat() {
  const uid = useUid();
  if (uid === "") {
    return <div>Loading...</div>;
  }
  return <ChatInner uid={uid} />;
}

function ChatInner({ uid }: { uid: string }) {
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
  } = useChatHandlers({ uid });
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
    <div className="bg-background flex h-screen">
      {/* Chat Sidebar - Fixed/Sticky */}
      <div className="flex h-full w-1/4 flex-col">
        <Card className="flex-shrink-0 rounded-none border-r">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
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
        <Card className="flex-1 overflow-hidden rounded-none border-t-0 border-r">
          <CardContent className="h-full p-0">
            <ScrollArea className="h-full">
              <div className="space-y-1 p-2">
                {(chats || []).map((chat) => (
                  <Button
                    key={chat.id}
                    variant={
                      currentChat?.id === chat.id ? "secondary" : "ghost"
                    }
                    className="h-auto w-full justify-start p-3 text-left"
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
      <div className="flex h-full flex-1 flex-col">
        {/* Chat Header - Fixed */}
        <Card className="flex-shrink-0 rounded-none border-t-0 border-r-0 border-b border-l-0">
          <CardHeader className="px-4 py-1">
            <div className="flex items-center justify-between">
              <CardTitle className="font-medium">
                {isNewChatMode ? "New Chat" : (currentChat?.title ?? "")}
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
                      <div className="text-sm break-words whitespace-pre-line">
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
                            <div className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full" />
                            <div className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full delay-100" />
                            <div className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full delay-200" />
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
        <Card className="flex-shrink-0 rounded-none border-t border-r-0 border-b-0 border-l-0">
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
                className="max-h-32 min-h-[2.5rem] resize-none"
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
      <Dialog
        open={isSettingsOpen}
        onOpenChange={(open) => {
          if (!open) closeSettings();
        }}
      >
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Chat Settings</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto">
            {currentChat && (
              <ChannelsAndPlaylistForm
                chatId={currentChat.id}
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
