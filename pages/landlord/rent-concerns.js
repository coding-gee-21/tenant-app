import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock3,
  MessageSquare,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import PrivateMessageThread from '../../components/PrivateMessageThread';

function formatDate(value) {
  if (!value) return 'Not recorded';

  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function LandlordRentConcernsPage() {
  const router = useRouter();

  const [concerns, setConcerns] = useState([]);
  const [filter, setFilter] = useState('open');
  const [openThreadId, setOpenThreadId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const loadConcerns = useCallback(async () => {
    setLoading(true);
    setPageError('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/auth');
        return;
      }

      const landlordId = session.user.id;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', landlordId)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!['landlord', 'admin'].includes(profile?.role)) {
        router.replace('/landlord');
        return;
      }

      const { data: noticeRows, error: noticeError } =
        await supabase
          .from('rent_change_notices')
          .select('id, property_id, effective_semester')
          .eq('landlord_id', landlordId);

      if (noticeError) throw noticeError;

      const notices = noticeRows || [];
      const noticeIds = notices.map((notice) => notice.id);

      if (noticeIds.length === 0) {
        setConcerns([]);
        return;
      }

      const { data: concernRows, error: concernError } =
        await supabase
          .from('rent_notice_concerns')
          .select('*')
          .in('notice_id', noticeIds)
          .order('submitted_at', { ascending: false });

      if (concernError) throw concernError;

      const rows = concernRows || [];

      const propertyIds = [
        ...new Set(
          notices.map((notice) => notice.property_id).filter(Boolean)
        ),
      ];

      const studentIds = [
        ...new Set(rows.map((concern) => concern.student_id)),
      ];

      const [propertyResult, studentResult] = await Promise.all([
        propertyIds.length
          ? supabase
              .from('properties')
              .select('id, title, landmark')
              .in('id', propertyIds)
          : Promise.resolve({ data: [], error: null }),

        studentIds.length
          ? supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', studentIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (propertyResult.error) throw propertyResult.error;
      if (studentResult.error) throw studentResult.error;

      const noticeMap = Object.fromEntries(
        notices.map((notice) => [notice.id, notice])
      );

      const propertyMap = Object.fromEntries(
        (propertyResult.data || []).map((property) => [
          property.id,
          property,
        ])
      );

      const studentMap = Object.fromEntries(
        (studentResult.data || []).map((student) => [
          student.id,
          student,
        ])
      );

      setConcerns(
        rows.map((concern) => {
          const notice = noticeMap[concern.notice_id];

          return {
            ...concern,
            notice,
            property: propertyMap[notice?.property_id] || null,
            student: studentMap[concern.student_id] || null,
          };
        })
      );
    } catch (error) {
      console.error('Unable to load rent concerns:', error);

      setPageError(
        error.message || 'Unable to load student concerns.'
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(loadConcerns, 0);
    return () => window.clearTimeout(timer);
  }, [loadConcerns]);

  const filteredConcerns = useMemo(() => {
    if (filter === 'all') return concerns;

    if (filter === 'open') {
      return concerns.filter(
        (concern) => concern.status !== 'resolved'
      );
    }

    return concerns.filter(
      (concern) => concern.status === filter
    );
  }, [concerns, filter]);

  return (
    <>
      <Head>
        <title>Student Rent Concerns | Chuka Rentals</title>
      </Head>

      <main className="min-h-screen bg-[#111214] text-white">
        <section className="mx-auto max-w-6xl px-5 py-10">
          <Link
            href="/landlord/dashboard"
            className="mb-7 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
          >
            <ArrowLeft size={17} />
            Back to landlord dashboard
          </Link>

          <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-400">
                Rent communication
              </p>

              <h1 className="text-3xl font-bold">
                Student Rent Concerns
              </h1>

              <p className="mt-2 max-w-2xl text-slate-400">
                Review and respond to questions submitted by confirmed
                tenants about semester rent notices.
              </p>
            </div>

            <button
              type="button"
              onClick={loadConcerns}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={loading ? 'animate-spin' : ''}
              />
              Refresh
            </button>
          </div>

          {pageError && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-300">
              {pageError}
            </div>
          )}

          <div className="mb-7 flex flex-wrap gap-2">
            {['open', 'resolved', 'all'].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold capitalize ${
                  filter === item
                    ? 'border-blue-500 bg-blue-600 text-white'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-[#17181c] p-12 text-center text-slate-400">
              Loading student concerns...
            </div>
          ) : filteredConcerns.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#17181c] p-12 text-center">
              <MessageSquare
                size={40}
                className="mx-auto mb-4 text-slate-600"
              />

              <h2 className="text-xl font-bold">
                No concerns found
              </h2>

              <p className="mt-2 text-slate-400">
                Student concerns about your published rent notices
                will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredConcerns.map((concern) => (
                <article
                  key={concern.id}
                  className="rounded-2xl border border-white/10 bg-[#17181c] p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold">
                        {concern.student?.full_name ||
                          'Student account'}
                      </h2>

                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-400">
                        <span className="inline-flex items-center gap-2">
                          <Building2 size={15} />
                          {concern.property?.title || 'Property'}
                        </span>

                        <span className="inline-flex items-center gap-2">
                          <Clock3 size={15} />
                          {formatDate(concern.submitted_at)}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
                        concern.status === 'resolved'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : concern.status === 'responded'
                            ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                      }`}
                    >
                      {concern.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="mt-5 rounded-xl bg-black/20 p-4">
                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                      <UserRound size={15} />
                      Student concern
                    </p>

                    <p className="leading-6 text-slate-300">
                      {concern.concern}
                    </p>
                  </div>

                  {concern.landlord_response && (
                    <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <p className="mb-2 flex items-center gap-2 font-semibold text-emerald-300">
                        <CheckCircle2 size={17} />
                        Your response
                      </p>

                      <p className="leading-6 text-slate-300">
                        {concern.landlord_response}
                      </p>

                      <p className="mt-3 text-xs text-slate-500">
                        Responded {formatDate(concern.responded_at)}
                      </p>
                    </div>
                  )}

                  {concern.status === 'submitted' && (
                    <div className="mt-4 flex items-start gap-2 text-xs text-amber-300">
                      <AlertCircle size={15} className="shrink-0" />
                      This concern is awaiting your response.
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setOpenThreadId((current) =>
                        current === concern.id ? null : concern.id
                      )
                    }
                    className="mt-5 inline-flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-bold text-blue-300 transition hover:bg-blue-500/20"
                  >
                    <MessageSquare size={16} />
                    {openThreadId === concern.id
                      ? 'Close conversation'
                      : 'Open conversation'}
                    {openThreadId === concern.id ? (
                      <ChevronUp size={16} />
                    ) : (
                      <ChevronDown size={16} />
                    )}
                  </button>

                  {openThreadId === concern.id && (
                    <>
                      <PrivateMessageThread
                        kind="concern"
                        threadId={concern.id}
                        viewerRole="landlord"
                        disabled={concern.status === 'resolved'}
                        title="Private conversation with this student"
                        emptyText="No follow-up messages yet. Send the first response to this concern."
                        onMessageSent={() =>
                          setConcerns((current) =>
                            current.map((item) =>
                              item.id === concern.id
                                ? {
                                    ...item,
                                    status: 'in_discussion',
                                    last_message_at:
                                      new Date().toISOString(),
                                  }
                                : item
                            )
                          )
                        }
                      />

                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        The student who raised the concern controls its
                        final resolution. A resolved discussion becomes
                        read-only unless the student reopens it.
                      </p>
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
