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
// Realtime: Phase 1 polls every 2.5s; Phase 2 replaces the poll with a
// Supabase Realtime subscription (same UI, instant delivery).
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

  // Initial load + polling (Phase 2: Supabase Realtime replaces this interval)
  useEffect(() => {
    let active = true;
    const tick = async () => {
      if (!active) return;
      await loadMessages();
    };
    tick();
    const timer = setInterval(tick, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [loadMessages]);

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
    <div className="card flex h-[calc(100vh-11rem)] min-h-[420px] flex-col">
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b border-gray-200 p-4">
        <Link to="/messages" className="mr-1 md:hidden" aria-label="Back to conversations">
          &larr;
        </Link>
        <Avatar name={conversation.other_name} size="md" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{conversation.other_name}</p>
          <p className="text-xs text-gray-500">
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
            className="btn-secondary ml-auto shrink-0 !px-3 !py-1.5 !text-xs"
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
          <p className="py-10 text-center text-sm text-gray-400">
            No messages yet — say hello and share only what is needed for coordination.
          </p>
        )}
        {messages?.map((m) => {
          const mine = m.sender_id === user.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  mine
                    ? 'rounded-br-sm bg-red-600 text-white'
                    : 'rounded-bl-sm border border-gray-200 bg-white text-gray-800'
                }`}
              >
                <p>{m.content}</p>
                <p className={`mt-1 text-[10px] ${mine ? 'text-red-100' : 'text-gray-400'}`}>
                  {formatDateTime(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form onSubmit={handleSend} className="flex gap-2 border-t border-gray-200 p-3">
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message…"
          maxLength={2000}
          aria-label="Message"
        />
        <button type="submit" className="btn-primary shrink-0" disabled={sending || !text.trim()}>
          Send
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
      <h1 className="text-2xl font-bold text-gray-900">Messages</h1>

      {conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          message="Conversations start from a request page — open a request and message the requester, or (if you created it) message one of your matched donors."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          {/* Conversation list */}
          <div className={`card divide-y divide-gray-100 overflow-hidden ${conversationId ? 'hidden md:block' : ''}`}>
            <p className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Conversations
            </p>
            {conversations.map((c) => (
              <Link
                key={c.id}
                to={`/messages/${c.id}`}
                className={`block px-4 py-3 transition-colors hover:bg-gray-50 ${
                  c.id === conversationId ? 'bg-red-50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={c.other_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900">{c.other_name}</p>
                      {c.other_blood_type && <BloodTypeBadge type={c.other_blood_type} />}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {c.last_message || 'No messages yet'}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Chat pane */}
          <div className={conversationId ? '' : 'hidden md:block'}>
            {active ? <ChatWindow conversation={active} /> : (
              <div className="card flex h-[calc(100vh-11rem)] min-h-[420px] flex-col items-center justify-center gap-2 text-center">
                <p className="font-semibold text-gray-900">Select a conversation</p>
                <p className="max-w-xs text-sm text-gray-500">
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
