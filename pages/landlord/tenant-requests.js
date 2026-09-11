import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  Home,
  RefreshCw,
  UserRound,
  XCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const statusStyles = {
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  confirmed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  rejected: 'border-red-500/30 bg-red-500/10 text-red-300',
};

function formatDate(value) {
  if (!value) return 'Not available';

  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function TenantRequestsPage() {
  const router = useRouter();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('pending');
  const [pageError, setPageError] = useState('');
  const [message, setMessage] = useState('');

  const loadRequests = useCallback(async () => {
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

      // Get the landlord's properties first.
      const { data: properties, error: propertyError } = await supabase
        .from('properties')
        .select('id, title, landmark')
        .eq('user_id', landlordId);

      if (propertyError) throw propertyError;

      const propertyMap = Object.fromEntries(
        (properties || []).map((property) => [property.id, property])
      );

      // Get tenancy requests belonging to this landlord.
      const { data: tenancyRows, error: tenancyError } = await supabase
        .from('property_tenants')
        .select('*')
        .eq('landlord_id', landlordId)
        .order('updated_at', { ascending: false });

      if (tenancyError) throw tenancyError;

      const studentIds = [
        ...new Set(
          (tenancyRows || [])
            .map((request) => request.student_id)
            .filter(Boolean)
        ),
      ];

      let studentMap = {};

      if (studentIds.length > 0) {
        const { data: students, error: studentsError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', studentIds);

        // The page can still work if student profiles are restricted by RLS.
        if (!studentsError) {
          studentMap = Object.fromEntries(
            (students || []).map((student) => [student.id, student])
          );
        }
      }

      const combinedRequests = (tenancyRows || []).map((request) => ({
        ...request,
        property: propertyMap[request.property_id] || null,
        student: studentMap[request.student_id] || null,
      }));

      setRequests(combinedRequests);
    } catch (error) {
      console.error('Unable to load tenant requests:', error);
      setPageError(error.message || 'Unable to load tenant requests.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    Promise.resolve().then(loadRequests);
  }, [loadRequests]);

  const filteredRequests = useMemo(() => {
    if (activeFilter === 'all') return requests;

    return requests.filter(
      (request) => request.status === activeFilter
    );
  }, [activeFilter, requests]);

  async function decideRequest(request, decision) {
    const label = decision === 'confirmed' ? 'confirm' : 'reject';

    if (
      !window.confirm(
        `Are you sure you want to ${label} this tenancy request?`
      )
    ) {
      return;
    }

    setActionId(request.id);
    setPageError('');
    setMessage('');

    try {
      const { error } = await supabase.rpc(
        'decide_tenancy_connection',
        {
          connection_id: request.id,
          decision,
          decision_note: null,
        }
      );

      if (error) throw error;

      const now = new Date().toISOString();

      setRequests((current) =>
        current.map((item) =>
          item.id === request.id
            ? {
                ...item,
                status: decision,
                decided_at: now,
                updated_at: now,
              }
            : item
        )
      );

      setMessage(
        decision === 'confirmed'
          ? 'The student has been confirmed as a tenant.'
          : 'The tenancy request has been rejected.'
      );
    } catch (error) {
      console.error('Unable to update tenancy request:', error);
      setPageError(error.message || 'Unable to update the request.');
    } finally {
      setActionId(null);
    }
  }

  return (
    <>
      <Head>
        <title>Tenant Requests | Chuka Rentals</title>
      </Head>

      <main className="min-h-screen bg-[#111214] text-white">
        <section className="mx-auto max-w-6xl px-5 py-10">
          <Link
            href="/landlord/dashboard"
            className="mb-7 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={17} />
            Back to landlord dashboard
          </Link>

          <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-400">
                Tenant management
              </p>

              <h1 className="text-3xl font-bold">Tenant Requests</h1>

              <p className="mt-2 max-w-2xl text-slate-400">
                Confirm whether a student currently lives at one of your
                properties. Only confirmed tenants receive private housing
                notifications.
              </p>
            </div>

            <button
              type="button"
              onClick={loadRequests}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
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

          {message && (
            <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-emerald-300">
              {message}
            </div>
          )}

          <div className="mb-7 flex flex-wrap gap-2">
            {['pending', 'confirmed', 'rejected', 'all'].map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold capitalize transition ${
                  activeFilter === filter
                    ? 'border-blue-500 bg-blue-600 text-white'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-[#17181c] p-12 text-center text-slate-400">
              Loading tenant requests...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#17181c] p-12 text-center">
              <Home
                size={38}
                className="mx-auto mb-4 text-slate-600"
              />

              <h2 className="text-xl font-bold">No requests found</h2>

              <p className="mt-2 text-slate-400">
                There are currently no {activeFilter === 'all' ? '' : activeFilter}{' '}
                tenancy requests.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => {
                const studentName =
                  request.student?.full_name || 'Student account';

                return (
                  <article
                    key={request.id}
                    className="rounded-2xl border border-white/10 bg-[#17181c] p-6"
                  >
                    <div className="flex flex-col justify-between gap-6 lg:flex-row">
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <h2 className="text-xl font-bold">
                            {studentName}
                          </h2>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-bold capitalize ${
                              statusStyles[request.status] ||
                              statusStyles.pending
                            }`}
                          >
                            {request.status}
                          </span>
                        </div>

                        <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                          <div className="flex items-start gap-3">
                            <Building2
                              size={18}
                              className="mt-0.5 text-blue-400"
                            />

                            <div>
                              <p className="text-xs uppercase text-slate-500">
                                Property
                              </p>

                              <p className="font-semibold">
                                {request.property?.title ||
                                  'Unknown property'}
                              </p>

                              {request.property?.landmark && (
                                <p className="text-slate-400">
                                  {request.property.landmark}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-start gap-3">
                            <UserRound
                              size={18}
                              className="mt-0.5 text-blue-400"
                            />

                            <div>
                              <p className="text-xs uppercase text-slate-500">
                                Room
                              </p>

                              <p className="font-semibold">
                                {request.room_number ||
                                  'Not specified'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-3">
                            <Clock3
                              size={18}
                              className="mt-0.5 text-blue-400"
                            />

                            <div>
                              <p className="text-xs uppercase text-slate-500">
                                Requested
                              </p>

                              <p className="font-semibold">
                                {formatDate(
                                  request.requested_at ||
                                    request.updated_at
                                )}
                              </p>
                            </div>
                          </div>
                        </div>

                        {request.request_message && (
                          <div className="rounded-xl border border-white/5 bg-black/20 p-4">
                            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
                              Student message
                            </p>

                            <p className="text-sm leading-6 text-slate-300">
                              {request.request_message}
                            </p>
                          </div>
                        )}
                      </div>

                      {request.status === 'pending' && (
                        <div className="flex min-w-[220px] flex-col gap-3">
                          <button
                            type="button"
                            disabled={actionId === request.id}
                            onClick={() =>
                              decideRequest(request, 'confirmed')
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <CheckCircle2 size={18} />
                            Confirm tenant
                          </button>

                          <button
                            type="button"
                            disabled={actionId === request.id}
                            onClick={() =>
                              decideRequest(request, 'rejected')
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 font-bold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <XCircle size={18} />
                            Reject request
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
