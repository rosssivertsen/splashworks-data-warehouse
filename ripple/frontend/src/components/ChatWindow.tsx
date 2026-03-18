import { useState, useRef, useEffect } from "react";
import { useChat } from "../hooks/useChat";
import Message from "./Message";

export default function ChatWindow() {
  const { messages, isLoading, sendMessage, clearMessages } = useChat();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-ripple-600 flex items-center justify-center text-white font-bold text-sm">
            R
          </div>
          <div>
            <h1 className="text-sm font-semibold text-zinc-100">Ripple</h1>
            <p className="text-xs text-zinc-500">Splashworks Knowledge Agent</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-800"
          >
            New chat
          </button>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-ripple-600/20 flex items-center justify-center mb-4">
              <div className="w-10 h-10 rounded-full bg-ripple-600 flex items-center justify-center text-white font-bold text-lg">
                R
              </div>
            </div>
            <h2 className="text-lg font-semibold text-zinc-200 mb-1">
              Ask Ripple anything
            </h2>
            <p className="text-sm text-zinc-500 max-w-md">
              I know about Splashworks data models, business definitions,
              customer lifecycle rules, and more.
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
              {[
                "What is the active customer filter?",
                "How is profit calculated?",
                "What tables are in the warehouse?",
                "Explain the customer lifecycle",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-left text-xs px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <Message key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-3 border-t border-zinc-800"
      >
        <div className="flex items-end gap-2 bg-zinc-800/50 rounded-xl border border-zinc-700/50 px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about Splashworks data..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none max-h-32"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-3 py-1.5 bg-ripple-600 text-white text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-ripple-700 transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
