import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useAsync from '../hooks/useAsync';
import dataService from '../lib/dataService';
import { useAuth } from '../context/AuthContext';
import { Avatar, BloodTypeBadge, EmptyState, InlineLoader, StatusBadge } from '../components/ui';
import { formatDateTime } from '../lib/utils';
import { REQUEST_STATUS } from '../lib/constants';

// Private 1:1 messaging.
// Privacy: only conversation participants can read/send — enforced by the
// backend for every operation, mirrored by RLS policies in Phase 2.
// Realtime: Phase 2 (Supabase) streams INSERTs via a channel subscription;
// mock mode notifies same-tab listeners. A light safety poll (4s) keeps
// every mode eventually-consistent.
function ChatWindow({ conversation }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const loadMessages = useCallback(async () => {
    try {
      const rows = await dataService.getMessages(conversation.id);
      setMessages(rows);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Could not load messages.');
    }
  }, [conversation.id]);

  // Initial load + realtime subscription + light safety poll
  useEffect(() => {
    let active = true;
    let unsubscribe = null;
    const tick = async () => {
      if (!active) return;
      await loadMessages();
    };
    tick();

    if (typeof dataService.subscribeMessages === 'function') {
      unsubscribe = dataService.subscribeMessages(conversation.id, (msg) => {
        if (msg.conversation_id !== conversation.id) return;
        setMessages((prev) => {
          if (!prev || prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        });
      });
    }
    const timer = setInterval(tick, 4000);
    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
      clearInterval(timer);
    };
  }, [conversation.id, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages?.length]);

  const handleSend = async (e) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || sending) return;
    setSending(true);
    try {
      await dataService.sendMessage(conversation.id, clean);
      setText('');
      await loadMessages();
    } catch (err) {
      setError(err?.message || 'Could not send the message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card flex h-[calc(100dvh-14rem)] min-h-[420px] flex-col md:h-[calc(100vh-12rem)]">
      {/* Chat header */}
      <div className="flex items-center gap-2 border-b border-cream/10 p-3 md:p-4">
        <Link
          to="/messages"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-cream/70 transition-colors hover:bg-cream/10 hover:text-cream md:hidden"
          aria-label="Back to conversations"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12l7.5-7.5M21 12H3.5" />
          </svg>
        </Link>
        <Avatar name={conversation.other_name} size="md" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-cream">{conversation.other_name}</p>
          <p className="text-xs text-cream/55">
            {conversation.request_blood_type ? (
              <>
                About a {conversation.request_blood_type} request{' '}
                {conversation.request_status && (
                  <StatusBadge status={conversation.request_status} />
                )}
              </>
            ) : (
              'Direct conversation'
            )}
          </p>
        </div>
        {conversation.request_id && (
          <Link
            to={`/requests/${conversation.request_id}`}
            className="btn-secondary ml-auto shrink-0 !min-h-9 !px-3 !py-1 !text-xs"
          >
            View request
          </Link>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {error && <p className="text-center text-sm font-medium text-red-400">{error}</p>}
        {!messages && !error && <InlineLoader label="Loading conversation…" />}
        {messages?.length === 0 && (
          <p className="py-10 text-center text-sm text-cream/45">
            No messages yet — say hello and share only what is needed for coordination.
          </p>
        )}
        {messages?.map((m) => {
          const mine = m.sender_id === user.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed md:max-w-[75%] ${
                  mine
                    ? 'rounded-br-sm bg-gold text-night'
                    : 'rounded-bl-sm border border-cream/15 bg-ink text-cream'
                }`}
              >
                <p>{m.content}</p>
                <p className={`mt-1 text-[10px] ${mine ? 'text-night/60' : 'text-cream/40'}`}>
                  {formatDateTime(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form onSubmit={handleSend} className="flex gap-2 border-t border-cream/10 p-3 pb-safe">
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message…"
          maxLength={2000}
          aria-label="Message"
        />
        <button
          type="submit"
          className="btn-primary shrink-0 !px-4"
          disabled={sending || !text.trim()}
          aria-label="Send message"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 12L3.3 3.7a.5.5 0 01.65-.6l16.8 8.4a.5.5 0 010 .9L3.95 20.9a.5.5 0 01-.65-.6L6 12zm0 0h7.5"
            />
          </svg>
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
}

export default function Messages() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { data: conversations, loading, error, reload } = useAsync(() => dataService.listConversations());

  const active = conversations?.find((c) => c.id === conversationId) || null;

  useEffect(() => {
    if (conversations && conversationId && !active) navigate('/messages', { replace: true });
  }, [conversations, conversationId, active, navigate]);

  if (loading) return <InlineLoader label="Loading conversations…" />;
  if (error) return <EmptyState title="Could not load messages" message={error} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-cream">Messages</h1>
        <button
          type="button"
          className="btn-ghost !min-h-9 !px-3 !text-sm"
          onClick={reload}
          aria-label="Refresh conversations"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20 11.5A8.5 8.5 0 1 0 18.3 17M20 4v4.5h-4.5"
            />
          </svg>
          Refresh
        </button>
      </div>

      {conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          message="Conversations start from a request page — open a request and message the requester, or (if you created it) message one of your matched donors."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          {/* Conversation list (hidden on phones while a thread is open) */}
          <div className={`card divide-y divide-cream/10 overflow-hidden ${conversationId ? 'hidden md:block' : ''}`}>
            <p className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-cream/45">
              Conversations
            </p>
            {conversations.map((c) => (
              <Link
                key={c.id}
                to={`/messages/${c.id}`}
                className={`block px-4 py-3.5 transition-colors hover:bg-cream/5 ${
                  c.id === conversationId ? 'bg-gold/15' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={c.other_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-cream">{c.other_name}</p>
                      {c.other_blood_type && <BloodTypeBadge type={c.other_blood_type} />}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-cream/60">
                      {c.last_message || 'No messages yet'}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Chat pane */}
          <div className={conversationId ? '' : 'hidden md:block'}>
            {active ? (
              <ChatWindow conversation={active} />
            ) : (
              <div className="card flex h-[calc(100dvh-14rem)] min-h-[420px] flex-col items-center justify-center gap-2 p-6 text-center md:h-[calc(100vh-12rem)]">
                <p className="font-semibold text-cream">Select a conversation</p>
                <p className="max-w-xs text-sm text-cream/60">
                  Choose someone on the left to view your private chat history.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
