"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import {
  Send,
  RotateCcw,
  Brain,
  Cpu,
  Gauge,
  AlertTriangle,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Paperclip,
  X,
  Image as ImageIcon,
  FileText,
} from "lucide-react"
import type { UIMessage } from "ai"

const TASK_ICONS: Record<string, typeof Brain> = {
  reasoning: Brain,
  code: Cpu,
  fast: Gauge,
  contrarian: AlertTriangle,
}

function getUIMessageText(msg: UIMessage): string {
  if (!msg.parts || !Array.isArray(msg.parts)) return ""
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

interface Attachment {
  id: string
  type: "image" | "file"
  name: string
  url: string
  mimeType: string
}

export function ChatPanel({
  currentSessionId,
  onSessionCreated,
}: {
  currentSessionId: string | null
  onSessionCreated: (id: string) => void
}) {
  const [input, setInput] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ id, messages }) => ({
        body: {
          messages,
          sessionId: currentSessionId,
          attachments: attachments.map(a => ({
            type: a.type,
            mimeType: a.mimeType,
            url: a.url,
            name: a.name,
          })),
          id,
        },
      }),
    }),
  })

  const isStreaming = status === "streaming" || status === "submitted"

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Voice output for assistant messages
  useEffect(() => {
    if (!voiceEnabled) return
    const lastMsg = messages[messages.length - 1]
    if (lastMsg?.role === "assistant" && status === "ready") {
      const text = getUIMessageText(lastMsg)
      if (text && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.rate = 1.0
        utterance.pitch = 1.0
        utterance.onstart = () => setIsSpeaking(true)
        utterance.onend = () => setIsSpeaking(false)
        speechSynthesis.speak(utterance)
      }
    }
  }, [messages, status, voiceEnabled])

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true
      
      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let transcript = ""
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript
        }
        setInput(prev => {
          // Only append final results
          if (event.results[event.results.length - 1].isFinal) {
            return prev + transcript + " "
          }
          return prev
        })
      }
      
      recognitionRef.current.onerror = () => {
        setIsListening(false)
      }
      
      recognitionRef.current.onend = () => {
        setIsListening(false)
      }
    }
  }, [])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px"
    }
  }, [input])

  const toggleVoiceInput = useCallback(() => {
    if (!recognitionRef.current) return
    
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }, [isListening])

  const stopSpeaking = useCallback(() => {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }, [])

  const processFile = useCallback((file: File) => {
    const id = Math.random().toString(36).slice(2)
    const isImage = file.type.startsWith("image/")
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const url = e.target?.result as string
      setAttachments(prev => [...prev, {
        id,
        type: isImage ? "image" : "file",
        name: file.name,
        url,
        mimeType: file.type,
      }])
    }
    reader.readAsDataURL(file)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach(processFile)
    e.target.value = ""
  }, [processFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      Array.from(files).forEach(processFile)
    }
  }, [processFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    
    for (const item of items) {
      if (item.type.startsWith("image/") || item.kind === "file") {
        const file = item.getAsFile()
        if (file) {
          processFile(file)
        }
      }
    }
  }, [processFile])

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if ((!input.trim() && attachments.length === 0) || isStreaming) return
    
    // Build message with attachments
    let messageText = input.trim()
    if (attachments.length > 0) {
      const attachmentInfo = attachments.map(a => `[${a.type}: ${a.name}]`).join(" ")
      if (messageText) {
        messageText = `${messageText}\n\nAttachments: ${attachmentInfo}`
      } else {
        messageText = `Analyze these attachments: ${attachmentInfo}`
      }
    }
    
    sendMessage({ text: messageText })
    setInput("")
    setAttachments([])
  }

  const handleNewChat = () => {
    setMessages([])
    setAttachments([])
    onSessionCreated("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div 
      className="flex flex-col h-full"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 border-2 border-dashed border-primary rounded-lg">
          <div className="text-center">
            <Paperclip className="h-12 w-12 mx-auto text-primary mb-2" />
            <p className="text-sm font-medium text-foreground">Drop files here</p>
            <p className="text-xs text-muted-foreground">Images, PDFs, and documents</p>
          </div>
        </div>
      )}

      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-mono text-muted-foreground">
            {currentSessionId ? `Session: ${currentSessionId.slice(0, 8)}...` : "New Session"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Voice output toggle */}
          <button
            onClick={() => {
              if (isSpeaking) stopSpeaking()
              setVoiceEnabled(!voiceEnabled)
            }}
            className={`flex items-center justify-center h-7 w-7 rounded-md transition-colors ${
              voiceEnabled 
                ? "bg-primary/20 text-primary" 
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
            title={voiceEnabled ? "Disable voice output" : "Enable voice output"}
          >
            {isSpeaking ? <Volume2 className="h-3.5 w-3.5 animate-pulse" /> : voiceEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>
          
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            New
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 gap-4 flex flex-col">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="flex items-center justify-center h-16 w-16 mx-auto rounded-xl bg-primary/10 border border-primary/20 mb-4">
                <Brain className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">
                SAL Supreme Ready
              </h3>
              <p className="text-xs text-muted-foreground max-w-[280px] leading-relaxed mb-4">
                Full spectrum AI orchestration. Finance, tech, operations, legal, healthcare — all domains active.
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 px-2 py-1 rounded bg-secondary">
                  <Mic className="h-3 w-3" /> Voice
                </span>
                <span className="flex items-center gap-1 px-2 py-1 rounded bg-secondary">
                  <ImageIcon className="h-3 w-3" /> Images
                </span>
                <span className="flex items-center gap-1 px-2 py-1 rounded bg-secondary">
                  <FileText className="h-3 w-3" /> Files
                </span>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const text = getUIMessageText(msg)
          if (!text) return null

          return (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{text}</div>
              </div>
            </div>
          )
        })}

        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-secondary rounded-lg px-3.5 py-2.5">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2 p-2 rounded-lg bg-secondary/50 border border-border">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="relative group flex items-center gap-2 px-2 py-1.5 rounded bg-background border border-border"
              >
                {attachment.type === "image" ? (
                  <img
                    src={attachment.url}
                    alt={attachment.name}
                    className="h-8 w-8 rounded object-cover"
                  />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-xs text-foreground max-w-[100px] truncate">
                  {attachment.name}
                </span>
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-border px-4 py-3"
      >
        <div className={`flex items-end gap-2 rounded-lg border bg-secondary/30 px-3 py-2 transition-colors ${
          isDragging ? "border-primary" : "border-border focus-within:border-primary/50"
        }`}>
          {/* File upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Attach files"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt,.md,.json,.csv,.xlsx"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Text input */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Message SAL... (paste or drop files)"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none min-h-[28px] max-h-[200px] py-0.5"
            disabled={isStreaming}
            rows={1}
          />

          {/* Voice input button */}
          {typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) && (
            <button
              type="button"
              onClick={toggleVoiceInput}
              className={`flex items-center justify-center h-7 w-7 rounded-md transition-colors ${
                isListening 
                  ? "bg-destructive text-destructive-foreground animate-pulse" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              title={isListening ? "Stop listening" : "Start voice input"}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}

          {/* Send button */}
          <button
            type="submit"
            disabled={isStreaming || (!input.trim() && attachments.length === 0)}
            className="flex items-center justify-center h-7 w-7 rounded-md bg-primary text-primary-foreground disabled:opacity-30 hover:opacity-90 transition-opacity"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Shift+Enter for new line | Drag & drop or paste images/files
        </p>
      </form>
    </div>
  )
}
