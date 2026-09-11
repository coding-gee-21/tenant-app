import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  Send,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const THREAD_CONFIG = {
  concern: {
    table: 'rent_concern_messages',
    parentColumn: 'concern_id',
    sendRpc: 'send_rent_concern_message',
    sendIdParameter: 'target_concern_id',
    readRpc: 'mark_rent_concern_messages_read',
    readIdParameter: 'target_concern_id',
  },
  review: {
    table: 'review_messages',
    parentColumn: 'review_id',
    sendRpc: 'send_review_message',
    sendIdParameter: 'target_review_id',
    readRpc: 'mark_review_messages_read',
    readIdParameter: 'target_review_id',
  },
};

function formatDate(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function readableError(error) {
  const message = error?.message || '';

  if (message.includes('resolved and is read-only')) {
    return 'This discussion has been resolved. Reopen it before sending another message.';
  }

  if (
    message.includes('not a participant') ||
    error?.code === '42501'
  ) {
    return 'You do not have permission to access this private discussion.';
  }

  if (
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    error?.code === 'PGRST202'
  ) {
    return 'The messaging database setup is incomplete. Run the supplied messaging SQL in Supabase, then refresh this page.';
  }

  return message || 'The discussion could not be updated. Please try again.';
}

export default function PrivateMessageThread({
  kind,
  threadId,
  viewerRole,
  disabled = false,
  title = 'Private discussion',
  emptyText = 'No follow-up messages yet.',
  onMessageSent,
}) {
  const config = THREAD_CONFIG[kind];
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const messageListRef = useRef(null);

  const loadMessages = useCallback(
    async ({ silent = false } = {}) => {
      if (!config || !threadId || !viewerRole) return;

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const { error: readError } = await supabase.rpc(
          config.readRpc,
          { [config.readIdParameter]: threadId }
        );

        if (readError) throw readError;

        const { data, error } = await supabase
          .from(config.table)
          .select(
            `id, ${config.parentColumn}, sender_role, message, created_at, read_at`
          )
          .eq(config.parentColumn, threadId)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true });

        if (error) throw error;

        setMessages(data || []);
        setErrorMessage('');
      } catch (error) {
        console.error(`Unable to load ${kind} messages:`, error);
        setErrorMessage(readableError(error));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [config, kind, threadId, viewerRole]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => loadMessages(), 0);
    const poller = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadMessages({ silent: true });
      }
    }, 12000);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poller);
    };
  }, [loadMessages]);

  useEffect(() => {
    if (!loading && messageListRef.current) {
      messageListRef.current.scrollTop =
        messageListRef.current.scrollHeight;
    }
  }, [loading, messages.length]);

  async function sendMessage(event) {
    event.preventDefault();

    const cleanedMessage = draft.trim();

    if (!cleanedMessage) {
      setErrorMessage('Write a message before pressing send.');
      return;
    }

    if (cleanedMessage.length > 2000) {
      setErrorMessage('Messages cannot exceed 2,000 characters.');
      return;
    }

    if (disabled) {
      setErrorMessage(
        'This discussion is currently read-only.'
      );
      return;
    }

    setSending(true);
    setErrorMessage('');

    try {
      const { error } = await supabase.rpc(config.sendRpc, {
        [config.sendIdParameter]: threadId,
        message_body: cleanedMessage,
      });

      if (error) throw error;

      setDraft('');
      await loadMessages({ silent: true });
      onMessageSent?.();
    } catch (error) {
      console.error(`Unable to send ${kind} message:`, error);
      setErrorMessage(readableError(error));
    } finally {
      setSending(false);
    }
  }

  if (!config || !threadId || !viewerRole) return null;

  return (
    <section className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-[#101114]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-bold text-white">
            <MessageCircle size={16} className="text-blue-400" />
            {title}
          </h4>

          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <LockKeyhole size={12} />
            Visible only to the student and property manager
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadMessages({ silent: true })}
          disabled={refreshing}
          aria-label="Refresh discussion"
          className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
        >
          <RefreshCw
            size={15}
            className={refreshing ? 'animate-spin' : ''}
          />
        </button>
      </div>

      <div
        ref={messageListRef}
        className="max-h-80 space-y-3 overflow-y-auto p-4"
        aria-live="polite"
      >
        {loading ? (
          <p className="py-5 text-center text-sm text-slate-500">
            Loading discussion...
          </p>
        ) : messages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-500">
            {emptyText}
          </p>
        ) : (
          messages.map((message) => {
            const isMine = message.sender_role === viewerRole;

            return (
              <div
                key={message.id}
                className={`flex ${
                  isMine ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm md:max-w-[75%] ${
                    isMine
                      ? 'rounded-br-md bg-blue-600 text-white'
                      : 'rounded-bl-md border border-white/10 bg-white/5 text-slate-200'
                  }`}
                >
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide opacity-75">
                    {isMine
                      ? 'You'
                      : message.sender_role === 'landlord'
                        ? 'Property manager'
                        : 'Student'}
                  </p>

                  <p className="whitespace-pre-wrap break-words leading-6">
                    {message.message}
                  </p>

                  <p className="mt-1.5 text-[10px] opacity-65">
                    {formatDate(message.created_at)}
                    {isMine && (message.read_at ? ' · Read' : ' · Sent')}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mx-4 mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          {errorMessage}
        </div>
      )}

      {disabled ? (
        <div className="border-t border-white/10 px-4 py-3 text-center text-xs text-slate-500">
          This discussion is resolved and currently read-only.
        </div>
      ) : (
        <form
          onSubmit={sendMessage}
          className="border-t border-white/10 p-4"
        >
          <label
            htmlFor={`${kind}-message-${threadId}`}
            className="sr-only"
          >
            Write a message
          </label>

          <textarea
            id={`${kind}-message-${threadId}`}
            rows={3}
            required
            maxLength={2000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a respectful message..."
            className="w-full resize-y rounded-xl border border-white/10 bg-[#17181c] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
          />

          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {draft.length}/2000
            </span>

            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={15} />
              {sending ? 'Sending...' : 'Send message'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
