import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Trash2, Headset } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useParentChat } from '@/hooks/useParentChat';

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [showContactForm, setShowContactForm] = useState(false);
  const [contact, setContact] = useState('');
  const [contactError, setContactError] = useState<string | null>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  const {
    messages,
    isLoading,
    sendMessage,
    clearChat,
    requestOperator,
    operatorRequested,
    operatorActive,
  } = useParentChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input);
      setInput('');
    }
  };

  useEffect(() => {
    if (showContactForm) contactRef.current?.focus();
  }, [showContactForm]);

  const isValidContact = (value: string) => {
    const v = value.trim();
    if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) return true;
    const digits = v.replace(/[^\d]/g, '');
    return /^[\d\s+().-]+$/.test(v) && digits.length >= 8 && digits.length <= 15;
  };

  const handleOperatorRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const value = contact.trim();
    if (!isValidContact(value)) {
      setContactError('Inserisci una email valida o un numero di telefono (almeno 8 cifre).');
      return;
    }
    setContactError(null);
    setShowContactForm(false);
    requestOperator(value);
    setContact('');
  };

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105 hover:shadow-xl ${isOpen ? 'hidden' : ''}`}
        aria-label="Apri chat assistenza"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[500px] w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-border bg-background shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/20">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Assistenza TECHLAND</h3>
                <p className="text-xs opacity-80">
                  {operatorActive
                    ? 'Un operatore è in chat con te'
                    : operatorRequested
                      ? 'Operatore richiesto, attendi…'
                      : 'Siamo qui per aiutarti'}
                </p>
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setShowContactForm(false);
                  setContact('');
                  setContactError(null);
                  clearChat();
                }}
                className="rounded-lg p-2 transition-colors hover:bg-primary-foreground/20"
                aria-label="Nuova chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-2 transition-colors hover:bg-primary-foreground/20"
                aria-label="Chiudi chat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : msg.role === 'operator'
                        ? 'bg-accent text-accent-foreground rounded-bl-md border border-primary/30'
                        : 'bg-muted text-foreground rounded-bl-md'
                  }`}
                >
                  {msg.role === 'operator' && (
                    <span className="mb-1 block text-xs font-semibold opacity-70">Operatore TECHLAND</span>
                  )}
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm text-foreground">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce">●</span>
                    <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>●</span>
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Richiesta operatore */}
          {!operatorRequested && (
            <div className="border-t border-border px-3 pt-2">
              {showContactForm ? (
                <form onSubmit={handleOperatorRequest} className="space-y-2 pb-1">
                  <label htmlFor="chat-contact" className="block text-xs text-muted-foreground">
                    Lasciaci una email o un numero di telefono: se nessun operatore è disponibile ti ricontattiamo al più presto.
                  </label>
                  <input
                    id="chat-contact"
                    ref={contactRef}
                    type="text"
                    value={contact}
                    onChange={(e) => {
                      setContact(e.target.value);
                      setContactError(null);
                    }}
                    placeholder="email@esempio.it oppure 333 1234567"
                    maxLength={120}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {contactError && (
                    <p role="alert" className="text-xs text-destructive">
                      {contactError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" className="flex-1 rounded-xl text-xs">
                      <Headset className="mr-2 h-4 w-4" /> Invia richiesta
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-xs"
                      onClick={() => {
                        setShowContactForm(false);
                        setContactError(null);
                      }}
                    >
                      Annulla
                    </Button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowContactForm(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <Headset className="h-4 w-4" /> Parla con un operatore
                </button>
              )}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t border-border p-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Scrivi un messaggio..."
                className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                className="h-10 w-10 rounded-xl"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
