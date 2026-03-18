import type { ChatMessage } from "../hooks/useChat";
import Sources from "./Sources";

interface MessageProps {
  message: ChatMessage;
}

export default function Message({ message }: MessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-ripple-600 text-white"
            : "bg-zinc-800 text-zinc-100"
        }`}
      >
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
          {message.isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-zinc-400 ml-0.5 animate-pulse" />
          )}
        </div>
        {!isUser && message.sources && <Sources sources={message.sources} />}
      </div>
    </div>
  );
}
