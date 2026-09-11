import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  RotateCcw,
  Send,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import PrivateMessageThread from './PrivateMessageThread';

function formatDate(value) {
  if (!value) return '';

  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function RentNoticeConcern({
  noticeId,
  studentId,
  onConcernChange,
}) {
  const [concern, setConcern] = useState(null);
  const [concernText, setConcernText] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingResolution, setUpdatingResolution] =
    useState(false);
  const [componentError, setComponentError] =
    useState('');
  const [successMessage, setSuccessMessage] =
    useState('');

  const loadConcern = useCallback(async () => {
    if (!noticeId || !studentId) return;

    setLoading(true);
    setComponentError('');

    try {
      const { data, error } = await supabase
        .from('rent_notice_concerns')
        .select('*')
        .eq('notice_id', noticeId)
        .eq('student_id', studentId)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      setConcern(data || null);
      onConcernChange?.(noticeId, data || null);
    } catch (error) {
      console.error(
        'Unable to load rent concern:',
        error
      );

      setComponentError(
        error.message ||
          'Unable to load your concern.'
      );
    } finally {
      setLoading(false);
    }
  }, [noticeId, onConcernChange, studentId]);

  useEffect(() => {
    const loadTimer = window.setTimeout(
      loadConcern,
      0
    );

    return () => window.clearTimeout(loadTimer);
  }, [loadConcern]);

  async function submitConcern(event) {
    event.preventDefault();

    const cleanedConcern = concernText.trim();

    if (cleanedConcern.length < 15) {
      setComponentError(
        'Please explain your concern using at least 15 characters.'
      );
      return;
    }

    if (cleanedConcern.length > 2000) {
      setComponentError(
        'Your concern cannot exceed 2,000 characters.'
      );
      return;
    }

    setSubmitting(true);
    setComponentError('');
    setSuccessMessage('');

    try {
      const { data, error } = await supabase
        .from('rent_notice_concerns')
        .insert({
          notice_id: noticeId,
          student_id: studentId,
          concern: cleanedConcern,
        })
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error(
            'You have already submitted a concern for this notice.'
          );
        }

        throw error;
      }

      setConcern(data);
      onConcernChange?.(noticeId, data);

      setConcernText('');
      setShowForm(false);

      setSuccessMessage(
        'Your concern has been submitted to the landlord.'
      );
    } catch (error) {
      console.error(
        'Unable to submit concern:',
        error
      );

      setComponentError(
        error.message ||
          'Unable to submit your concern.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function updateResolution(resolved) {
    if (!concern?.id) return;

    setUpdatingResolution(true);
    setComponentError('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.rpc(
        'set_rent_concern_resolved',
        {
          target_concern_id: concern.id,
          resolved,
        }
      );

      if (error) throw error;

      const nextConcern = {
        ...concern,
        status: resolved ? 'resolved' : 'in_discussion',
        resolved_at: resolved
          ? new Date().toISOString()
          : null,
        resolved_by: resolved ? studentId : null,
      };

      setConcern(nextConcern);
      onConcernChange?.(noticeId, nextConcern);
      setSuccessMessage(
        resolved
          ? 'The discussion has been marked as resolved.'
          : 'The discussion has been reopened. You can send another message.'
      );
    } catch (error) {
      console.error('Unable to update concern resolution:', error);
      setComponentError(
        error.message ||
          'Unable to update the discussion status.'
      );
    } finally {
      setUpdatingResolution(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-5 text-sm text-slate-500">
        Checking concern status...
      </div>
    );
  }

  return (
    <section className="mt-5 border-t border-white/10 pt-5">
      {componentError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {componentError}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {successMessage}
        </div>
      )}

      {concern ? (
        <div className="rounded-xl border border-white/10 bg-black/20 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-bold">
              <MessageSquare
                size={18}
                className="text-blue-400"
              />
              Your concern
            </h3>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
                concern.status === 'resolved'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : concern.status === 'responded' ||
                      concern.status ===
                        'in_discussion'
                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
              }`}
            >
              {concern.status.replace('_', ' ')}
            </span>
          </div>

          <p className="leading-6 text-slate-300">
            {concern.concern}
          </p>

          <p className="mt-3 text-xs text-slate-500">
            Submitted{' '}
            {formatDate(concern.submitted_at)}
          </p>

          {concern.landlord_response ? (
            <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="mb-2 flex items-center gap-2 font-semibold text-emerald-300">
                <CheckCircle2 size={17} />
                Landlord response
              </div>

              <p className="leading-6 text-slate-300">
                {concern.landlord_response}
              </p>

              <p className="mt-3 text-xs text-slate-500">
                Responded{' '}
                {formatDate(concern.responded_at)}
              </p>
            </div>
          ) : (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0"
              />

              <p>
                Waiting for the landlord’s response.
                Submission of a concern does not
                automatically cancel or change the rent
                notice.
              </p>
            </div>
          )}

          <PrivateMessageThread
            kind="concern"
            threadId={concern.id}
            viewerRole="student"
            disabled={concern.status === 'resolved'}
            title="Conversation with the property manager"
            emptyText="No follow-up messages yet. Send a message if you need clarification."
            onMessageSent={() => {
              const nextConcern = {
                ...concern,
                status: 'in_discussion',
                last_message_at: new Date().toISOString(),
              };

              setConcern(nextConcern);
              onConcernChange?.(noticeId, nextConcern);
            }}
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="max-w-xl text-xs leading-5 text-slate-400">
              Only you can confirm that your concern has been resolved.
              Resolving it makes the conversation read-only, but you can
              reopen it later.
            </p>

            <button
              type="button"
              disabled={updatingResolution}
              onClick={() =>
                updateResolution(concern.status !== 'resolved')
              }
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold transition disabled:opacity-50 ${
                concern.status === 'resolved'
                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
              }`}
            >
              {concern.status === 'resolved' ? (
                <RotateCcw size={16} />
              ) : (
                <CheckCircle2 size={16} />
              )}

              {updatingResolution
                ? 'Updating...'
                : concern.status === 'resolved'
                  ? 'Reopen discussion'
                  : 'Mark as resolved'}
            </button>
          </div>
        </div>
      ) : showForm ? (
        <form
          onSubmit={submitConcern}
          className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5"
        >
          <h3 className="font-bold">
            Raise a concern
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Explain what you believe requires clarification.
            Keep the message factual and respectful.
          </p>

          <textarea
            value={concernText}
            onChange={(event) =>
              setConcernText(event.target.value)
            }
            rows={5}
            maxLength={2000}
            placeholder="Explain your concern about this semester rent notice..."
            className="mt-4 w-full resize-y rounded-xl border border-white/10 bg-[#111214] px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
          />

          <div className="mt-2 text-right text-xs text-slate-500">
            {concernText.length}/2000
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold transition hover:bg-blue-500 disabled:opacity-50"
            >
              <Send size={16} />
              {submitting
                ? 'Submitting...'
                : 'Submit concern'}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setComponentError('');
              }}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20"
        >
          <MessageSquare size={16} />
          Raise a concern
        </button>
      )}
    </section>
  );
}
