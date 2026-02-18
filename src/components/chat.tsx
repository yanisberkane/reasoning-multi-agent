"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { Message } from "./message";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

function getUserId(): string {
  if (typeof window === "undefined") return "default-user";
  let userId = localStorage.getItem("agentique-user-id");
  if (!userId) {
    userId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem("agentique-user-id", userId);
  }
  return userId;
}

const SUGGESTIONS = [
  "Montre-moi les leads en phase de négociation",
  "Rédige un email de premier contact pour un lead dans la fintech",
  "Quels sont les deals avec la plus grande valeur ?",
  "Écris une relance pour Claire Lefebvre de GreenCommerce",
];

export function Chat() {
  const [userId, setUserId] = useState("default-user");
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setUserId(getUserId());
  }, []);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { userId },
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");
    await sendMessage({ text });
  };

  const handleSuggestion = async (suggestion: string) => {
    setInput("");
    await sendMessage({ text: suggestion });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm px-6 py-4 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Agentique AI</h1>
              <p className="text-xs text-muted-foreground">Assistant commercial multi-agent</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isLoading ? "bg-amber-400 animate-pulse" : "bg-green-400"}`} />
            <span className="text-xs text-muted-foreground">
              {isLoading ? "En cours..." : "Connecté"}
            </span>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-6" ref={scrollRef}>
        <div className="max-w-4xl mx-auto py-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-purple-500/20 to-blue-600/20 flex items-center justify-center mb-6 border border-purple-500/20">
                <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Bienvenue sur Agentique AI
              </h2>
              <p className="text-muted-foreground text-sm max-w-md mb-8">
                Je suis votre assistant commercial intelligent. Je peux rechercher des leads,
                rédiger des emails personnalisés et m&apos;adapter à votre style au fil du temps.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                {SUGGESTIONS.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestion(suggestion)}
                    className="text-left text-sm p-3 rounded-xl border border-border bg-card hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message: UIMessage) => (
              <Message
                key={message.id}
                message={message}
                isStreaming={isLoading && message.id === messages[messages.length - 1]?.id && message.role === "assistant"}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-border bg-card/50 backdrop-blur-sm px-6 py-4 shrink-0">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez une question sur vos leads, demandez un email..."
            className="flex-1 bg-background border border-border focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:outline-none rounded-xl px-4 py-3 text-sm resize-none min-h-[48px] max-h-[120px]"
            disabled={isLoading}
            rows={1}
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-linear-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white rounded-xl h-12 px-6 self-end"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </Button>
        </form>
        <p className="text-center text-[10px] text-muted-foreground mt-2 max-w-4xl mx-auto">
          Agentique AI apprend de vos interactions pour personnaliser ses réponses au fil du temps.
        </p>
      </div>
    </div>
  );
}
