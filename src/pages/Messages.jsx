import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useAsync from '../hooks/useAsync';
import dataService from '../lib/dataService';
import { useAuth } from '../context/AuthContext';
import { Avatar, BloodTypeBadge, EmptyState, InlineLoader, StatusBadge } from '../components/ui';
import { formatDateTime } from '../lib/utils';
import { REQUEST_STATUS } from '../lib/constants';
import { ArrowLeft, Building2, SendHorizontal, RotateCw } from 'lucide-react';

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
    <div className="card flex h-[calc(100dvh-15.5rem)] min-h-[420px] flex-col md:h-[calc(100vh-12rem)]">
      {/* Chat header — v4: hospital conversations show the HOSPITAL NAME
          (messages go to the admin); doctor chats show the doctor's
          hospital beside their name so threads are never confusing. */}
      <div className="flex items-center gap-2 border-b border-line p-3 md:p-4">
        <Link
          to="/messages"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-cream/70 transition-colors hover:bg-pale hover:text-cream md:hidden"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </Link>

        {conversation.hospital_id ? (
          // Hospital conversation: a hospital badge instead of an avatar,
          // with the hospital name as the title.
          <>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-blood text-cream" aria-hidden="true">
              <Building2 className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-cream">
                {conversation.hospital_name || 'Hospital'}
              </p>
              <p className="text-xs text-muted">
                Hospital · messages go to the administrator
              </p>
            </div>
            {conversation.hospital_id && (
              <Link
                to={`/hospitals/${conversation.hospital_id}`}
                className="btn-secondary ml-auto shrink-0 !min-h-9 !px-3 !py-1 !text-xs"
              >
                View hospital
              </Link>
            )}
          </>
        ) : (
          <>
            <Avatar name={conversation.other_name} src={conversation.other_avatar_url} size="md" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-cream">
                {conversation.other_name}
                {/* A doctor's hospital appears beside their name (client rule) */}
                {conversation.other_is_doctor && conversation.other_hospital_name && (
                  <span className="ml-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 align-middle text-xs font-semibold text-sky-700">
                    {conversation.other_hospital_name}
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-muted">
                {conversation.other_is_doctor
                  ? `Doctor${conversation.other_specialization ? ` · ${conversation.other_specialization}` : ''}`
                  : conversation.request_blood_type
                    ? `About a ${conversation.request_blood_type} request`
                    : 'Direct conversation'}
                {conversation.request_status && <StatusBadge status={conversation.request_status} />}
              </p>
            </div>
          </>
        )}

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
        {error && <p className="text-center text-sm font-medium text-red-600">{error}</p>}
        {!messages && !error && <InlineLoader label="Loading conversation…" />}
        {messages?.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">
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
                    ? 'rounded-br-sm bg-gold text-white'
                    : 'rounded-bl-sm border border-line bg-pale text-cream'
                }`}
              >
                <p>{m.content}</p>
                <p className={`mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-muted'}`}>
                  {formatDateTime(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form onSubmit={handleSend} className="flex gap-2 border-t border-line p-3 pb-safe">
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
          <SendHorizontal className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
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
          <RotateCw className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          message="Conversations start from a request page (message the requester or a matched donor), or from a hospital page — messaging a hospital goes straight to its administrator."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-[320px_minmax(0,1fr)]">
          {/* Conversation list (hidden on phones while a thread is open) */}
          <div className={`card divide-y divide-cream/10 overflow-hidden ${conversationId ? 'hidden md:block' : ''}`}>
            <p className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
              Conversations
            </p>
            {conversations.map((c) => (
              <Link
                key={c.id}
                to={`/messages/${c.id}`}
                className={`block px-4 py-3.5 transition-colors hover:bg-pale ${
                  c.id === conversationId ? 'bg-gold/15' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  {c.hospital_id ? (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-blood text-cream" aria-hidden="true">
                      <Building2 className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
                    </span>
                  ) : (
                    <Avatar name={c.other_name} src={c.other_avatar_url} size="sm" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-cream">
                        {c.hospital_id ? c.hospital_name || 'Hospital' : c.other_name}
                      </p>
                      {c.other_blood_type && !c.hospital_id && <BloodTypeBadge type={c.other_blood_type} />}
                    </div>
                    {/* Doctor threads carry their hospital; hospital threads
                        are labelled so the list stays organized. */}
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {c.hospital_id
                        ? 'Hospital · goes to the admin'
                        : c.other_is_doctor && c.other_hospital_name
                          ? `${c.other_hospital_name} · ${c.last_message || 'No messages yet'}`
                          : c.last_message || 'No messages yet'}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Chat pane */}
          <div className={`min-w-0 ${conversationId ? '' : 'hidden md:block'}`}>
            {active ? (
              <ChatWindow conversation={active} />
            ) : (
              <div className="card flex h-[calc(100dvh-14rem)] min-h-[420px] flex-col items-center justify-center gap-2 p-6 text-center md:h-[calc(100vh-12rem)]">
                <p className="font-semibold text-cream">Select a conversation</p>
                <p className="max-w-xs text-sm text-muted">
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
