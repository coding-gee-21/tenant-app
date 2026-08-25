import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { CheckCircle2, ShieldCheck, XCircle, Clock3, AlertTriangle, RefreshCw, LogOut, Loader2, Flag } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const badge = {
  pending: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  approved: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-300 border-red-500/20',
  suspended: 'bg-red-500/10 text-red-300 border-red-500/20',
  cleared: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  reverification: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  dismissed: 'bg-gray-500/10 text-gray-300 border-gray-500/20',
  actioned: 'bg-blue-500/10 text-blue-300 border-blue-500/20'
};

export default function AdminDashboard() {
  const [requests, setRequests] = useState([]);
  const [properties, setProperties] = useState([]);
  const [reports, setReports] = useState([]);
  const [reviewReports, setReviewReports] = useState([]);
  const [reportFilter, setReportFilter] = useState('pending');
  const [reviewReportFilter, setReviewReportFilter] = useState('pending');
  const [reviewReasons, setReviewReasons] = useState({});
  const [propertyFilter, setPropertyFilter] = useState('pending');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const router = useRouter();

  const loadProperties = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch(`/api/admin/properties?status=${propertyFilter}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await response.json();
      if (response.ok) setProperties(data.properties || []);
    } catch (err) { console.error(err); }
  };

  const load = async () => {
    setLoading(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please log in with an admin account.');
      const response = await fetch(`/api/admin/verifications?status=${statusFilter}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load verification requests.');
      setRequests(data.requests || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const loadReports = async () => {
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch(`/api/admin/reports?status=${reportFilter}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load reports.');
      }

      setReports(data.reports || []);
    } catch (err) {
      setError(err.message);
    }
  };

  async function loadReviewReports() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Your admin session has expired.');
    }

    const response = await fetch(
      `/api/admin/review-reports?status=${reviewReportFilter}`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Unable to load flagged reviews.');
    }

    setReviewReports(result.reports || []);
  }

  useEffect(() => {
    let mounted = true;

    const authorize = async () => {
      setCheckingAccess(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/admin/login');
        return;
      }

      const response = await fetch('/api/admin/session', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (!response.ok) {
        router.replace('/admin/login');
        return;
      }

      if (mounted) {
        setAuthorized(true);
        setCheckingAccess(false);
      }
    };

    authorize();
    return () => { mounted = false; };
  }, [router]);

  useEffect(() => {
    if (!authorized) return;

    const loadAdminData = async () => {
      await Promise.all([
        load(),
        loadProperties(),
        loadReports(),
        loadReviewReports()
      ]);
    };

    loadAdminData();
  }, [authorized, statusFilter, propertyFilter, reportFilter, reviewReportFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError('');

    try {
      await Promise.all([
        load(),
        loadProperties(),
        loadReports(),
        loadReviewReports()
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleReportAction = async (report, action) => {
    setBusyId(report.id);
    setError('');

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      const response = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          reportId: report.id,
          propertyId: report.property_id,
          action
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to review report.');
      }

      await Promise.all([
        loadReports(),
        loadProperties()
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  async function handleReviewReportAction(report, action) {
    const reason = reviewReasons[report.id]?.trim() || '';

    if (action === 'hide' && reason.length < 5) {
      setError('Enter a moderation reason before hiding this review.');
      return;
    }

    if (
      action === 'delete' &&
      !window.confirm(
        'Permanently delete this review? This action cannot be undone.'
      )
    ) {
      return;
    }

    try {
      setBusyId(report.id);
      setError('');

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Your admin session has expired.');
      }

      const response = await fetch('/api/admin/review-reports', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          reportId: report.id,
          reviewId: report.review_id,
          action,
          reason,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Moderation action failed.');
      }

      setReviewReasons((current) => ({
        ...current,
        [report.id]: '',
      }));

      await loadReviewReports();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusyId(null);
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/admin/login');
  };

  const counts = useMemo(() => ({
    pending: requests.filter((r) => r.status === 'pending').length,
    landlords: requests.filter((r) => r.verification_type === 'landlord').length,
    properties: requests.filter((r) => r.verification_type === 'property').length
  }), [requests]);

  const decideProperty = async (property, decision) => {
    setBusyId(property.id); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/admin/properties', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ id: property.id, decision }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update listing.');
      await loadProperties();
    } catch (err) { setError(err.message); } finally { setBusyId(null); }
  };

  const decide = async (request, decision) => {
    let reason = '';
    if (decision === 'rejected' || decision === 'suspended') {
      reason = rejectionReason.trim();
      if (!reason) return setError('Enter a reason before rejecting or suspending a request.');
    }
    setBusyId(request.id); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/admin/verifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id: request.id, decision, rejection_reason: reason })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update verification.');
      setRejecting(null); setRejectionReason(''); await load();
    } catch (err) { setError(err.message); }
    finally { setBusyId(null); }
  };

  if (checkingAccess || !authorized) {
    return (
      <div className="min-h-screen bg-[#09090B] text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="animate-spin" size={20} />
          Verifying administrator access...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B] text-white p-5 md:p-8">
      <div className="max-w-7xl mx-auto space-y-7">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div><div className="flex items-center gap-3"><ShieldCheck className="text-blue-400" /><h1 className="text-3xl font-bold">Chuka Rentals Admin</h1></div><p className="text-gray-400 mt-1">Trust & verification control centre.</p></div>
          <div className="flex gap-3 items-center flex-wrap"><Link href="/" className="text-sm text-gray-400 hover:text-white">View site</Link><button onClick={handleRefresh} disabled={refreshing} className="text-sm px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 flex gap-2 items-center disabled:opacity-50 disabled:cursor-not-allowed"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'Refreshing...' : 'Refresh'}</button><button onClick={handleSignOut} className="text-sm px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 flex gap-2 items-center"><LogOut size={15} /> Sign out</button></div>
        </header>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl p-4 flex gap-2"><AlertTriangle size={18} />{error}</div>}

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-[#18181B] border border-white/10 rounded-2xl p-5"><p className="text-gray-400 text-sm">Pending in current view</p><p className="text-3xl font-bold mt-1">{counts.pending}</p></div>
          <div className="bg-[#18181B] border border-white/10 rounded-2xl p-5"><p className="text-gray-400 text-sm">Landlord requests</p><p className="text-3xl font-bold mt-1">{counts.landlords}</p></div>
          <div className="bg-[#18181B] border border-white/10 rounded-2xl p-5"><p className="text-gray-400 text-sm">Property requests</p><p className="text-3xl font-bold mt-1">{counts.properties}</p></div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {['pending', 'approved', 'rejected', 'suspended', 'all'].map((value) => <button key={value} onClick={() => setStatusFilter(value)} className={`px-4 py-2 rounded-xl text-sm border ${statusFilter === value ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-300'}`}>{value[0].toUpperCase() + value.slice(1)}</button>)}
        </div>

        <section className="bg-[#18181B] border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold">Listing approvals</h2><p className="text-sm text-gray-400">Publication approval is separate from verification.</p></div>
            <div className="flex gap-2">{['pending','approved','rejected','suspended','all'].map((v) => <button key={v} onClick={() => setPropertyFilter(v)} className={`px-3 py-1.5 rounded-lg text-xs border ${propertyFilter === v ? 'bg-blue-600 border-blue-500' : 'bg-white/5 border-white/10'}`}>{v}</button>)}</div>
          </div>
          {properties.length === 0 ? <div className="p-8 text-center text-gray-500">No {propertyFilter} listings.</div> : <div className="divide-y divide-white/10">{properties.map((property) => <div key={property.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><h3 className="font-semibold">{property.title || 'Untitled Hostel'}</h3><p className="text-sm text-gray-400">{property.landmark || '—'} • KES {Number(property.semester_rent || property.price || 0).toLocaleString()} / semester</p><p className="text-xs text-gray-500 mt-1">Verification: {property.verification_status || 'unverified'}</p></div><div className="flex gap-2">{property.listing_status !== 'approved' && <button disabled={busyId === property.id} onClick={() => decideProperty(property, 'approved')} className="px-3 py-2 rounded-lg bg-emerald-600 text-sm">Approve</button>}{property.listing_status !== 'rejected' && <button disabled={busyId === property.id} onClick={() => decideProperty(property, 'rejected')} className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">Reject</button>}</div></div>)}</div>}
        </section>

        <section className="bg-[#18181B] border border-red-500/20 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-red-500/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div><div className="flex items-center gap-2"><Flag className="text-red-400" size={18} /><h2 className="text-xl font-bold">Flagged Listings</h2></div><p className="text-sm text-gray-400">Review student reports before clearing, reverifying, or suspending listings.</p></div>
            <div className="flex gap-2 flex-wrap">{['pending','cleared','reverification','suspended','all'].map((v) => <button key={v} onClick={() => setReportFilter(v)} className={`px-3 py-1.5 rounded-lg text-xs border ${reportFilter === v ? 'bg-red-600 border-red-500 text-white' : 'bg-white/5 border-white/10 text-gray-300'}`}>{v}</button>)}</div>
          </div>
          {reports.length === 0 ? <div className="p-8 text-center text-gray-500">No {reportFilter === 'all' ? '' : reportFilter} reports.</div> : (
            <div className="divide-y divide-white/10">
              {reports.map((report) => {
                const reportedProperty = report.properties || {};

                return (
                  <div key={report.id} className="p-5 space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-bold">{reportedProperty.title || 'Unknown listing'}</h3>
                          <span className={`px-2.5 py-1 rounded-full text-xs border ${badge[report.admin_status] || badge.pending}`}>{report.admin_status || 'pending'}</span>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">{reportedProperty.landmark || 'No landmark'} - KES {Number(reportedProperty.semester_rent || 0).toLocaleString()} / semester</p>
                      </div>
                      <p className="text-xs text-gray-500">Property status: {reportedProperty.listing_status || 'unknown'}</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3 text-sm">
                      <div className="bg-[#101012] rounded-xl p-4">
                        <span className="text-gray-500 block text-xs mb-1">Issue type</span>
                        <span className="text-red-300 font-medium">{report.issue_type || 'Reported issue'}</span>
                      </div>

                      <div className="bg-[#101012] rounded-xl p-4">
                        <span className="text-gray-500 block text-xs mb-1">Reported</span>
                        {report.created_at ? new Date(report.created_at).toLocaleString() : '-'}
                      </div>
                    </div>

                    <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-4">
                      <span className="text-xs text-gray-500">Student&apos;s reason</span>
                      <p className="text-sm text-gray-200 mt-1">{report.description || 'No additional description supplied.'}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button disabled={busyId === report.id} onClick={() => handleReportAction(report, 'clear')} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm">Clear Flag</button>
                      <button disabled={busyId === report.id} onClick={() => handleReportAction(report, 'reverify')} className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 disabled:opacity-50 text-sm">Require Re-verification</button>
                      <button disabled={busyId === report.id} onClick={() => handleReportAction(report, 'suspend')} className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-sm">Suspend Listing</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-[#18181B] border border-red-500/20 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-red-500/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div><div className="flex items-center gap-2"><Flag className="text-red-400" size={18} /><h2 className="text-xl font-bold">Flagged Reviews</h2></div><p className="text-sm text-gray-400">Moderate reported student reviews and restore hidden reviews when appropriate.</p></div>
            <div className="flex gap-2 flex-wrap">{['pending','dismissed','actioned','all'].map((v) => <button key={v} onClick={() => setReviewReportFilter(v)} className={`px-3 py-1.5 rounded-lg text-xs border ${reviewReportFilter === v ? 'bg-red-600 border-red-500 text-white' : 'bg-white/5 border-white/10 text-gray-300'}`}>{v}</button>)}</div>
          </div>
          {reviewReports.length === 0 ? <div className="p-8 text-center text-gray-500">No {reviewReportFilter === 'all' ? '' : reviewReportFilter} review reports.</div> : (
            <div className="divide-y divide-white/10">
              {reviewReports.map((report) => {
                const review = report.reviews || {};
                const reviewedProperty = review.properties || {};
                const reviewer = review.profiles || {};
                const isBusy = busyId === report.id;

                return (
                  <article key={report.id} className="p-5 space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-bold">{review.title || 'Untitled review'}</h3>
                          <span className={`px-2.5 py-1 rounded-full text-xs border ${badge[report.status] || badge.pending}`}>{report.status || 'pending'}</span>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">{reviewedProperty.title || 'Unknown listing'} - {reviewedProperty.landmark || 'No landmark'}</p>
                      </div>
                      <p className="text-xs text-gray-500">Review status: {review.status || 'unknown'}</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-3 text-sm">
                      <div className="bg-[#101012] rounded-xl p-4">
                        <span className="text-gray-500 block text-xs mb-1">Rating</span>
                        <span className="text-amber-300 font-medium">{review.rating ? `${review.rating}/5` : 'Not rated'}</span>
                      </div>

                      <div className="bg-[#101012] rounded-xl p-4">
                        <span className="text-gray-500 block text-xs mb-1">Reviewer</span>
                        {reviewer.full_name || 'Anonymous student'}
                      </div>

                      <div className="bg-[#101012] rounded-xl p-4">
                        <span className="text-gray-500 block text-xs mb-1">Reported</span>
                        {report.created_at ? new Date(report.created_at).toLocaleString() : '-'}
                      </div>
                    </div>

                    <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-4">
                      <span className="text-xs text-gray-500">Report reason</span>
                      <p className="text-sm text-gray-200 mt-1">{report.reason || 'No additional reason supplied.'}</p>
                    </div>

                    <div className="bg-[#101012] border border-white/10 rounded-xl p-4">
                      <span className="text-xs text-gray-500">Review content</span>
                      <p className="text-sm text-gray-200 mt-1">{review.comment || 'No review comment available.'}</p>
                      {review.moderation_reason && (
                        <p className="text-xs text-red-300 mt-3">Moderation reason: {review.moderation_reason}</p>
                      )}
                    </div>

                    {report.status === 'pending' && (
                      <>
                        <label className="block text-sm text-gray-300">
                          Moderation note
                          <textarea
                            rows={2}
                            value={reviewReasons[report.id] || ''}
                            onChange={(event) =>
                              setReviewReasons((current) => ({
                                ...current,
                                [report.id]: event.target.value,
                              }))
                            }
                            placeholder="Required when hiding a review"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-[#101012] p-3 text-sm text-white outline-none focus:border-red-500"
                          />
                        </label>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              handleReviewReportAction(report, 'dismiss')
                            }
                            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm"
                          >
                            Dismiss report
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              handleReviewReportAction(report, 'hide')
                            }
                            className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 disabled:opacity-50 text-sm"
                          >
                            Hide review
                          </button>

                          {review?.status === 'rejected' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleReviewReportAction(report, 'restore')
                              }
                              className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 disabled:opacity-50 text-sm"
                            >
                              Restore review
                            </button>
                          )}

                          <button
                            type="button"
                            className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-sm"
                            disabled={isBusy}
                            onClick={() =>
                              handleReviewReportAction(report, 'delete')
                            }
                          >
                            Delete permanently
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-[#18181B] border border-white/10 rounded-2xl overflow-hidden">
          {loading ? <div className="p-12 text-center text-gray-400"><Clock3 className="mx-auto mb-3 animate-pulse" />Loading verification requests...</div> : requests.length === 0 ? <div className="p-12 text-center text-gray-400">No {statusFilter === 'all' ? '' : statusFilter} verification requests.</div> : (
            <div className="divide-y divide-white/10">
              {requests.map((request) => {
                const landlord = request.landlords || {};
                const property = request.properties || {};
                return <div key={request.id} className="p-5 space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap"><h2 className="text-lg font-bold">{request.verification_type === 'landlord' ? 'Landlord Verification' : `Property Verification — ${property.title || 'Unknown property'}`}</h2><span className={`px-2.5 py-1 rounded-full text-xs border ${badge[request.status]}`}>{request.status}</span></div>
                      <p className="text-sm text-gray-400 mt-1">Submitted {new Date(request.submitted_at).toLocaleString()}</p>
                    </div>
                    {request.status === 'pending' && <div className="flex gap-2"><button disabled={busyId === request.id} onClick={() => decide(request, 'approved')} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm flex items-center gap-1"><CheckCircle2 size={15}/>Approve</button><button disabled={busyId === request.id} onClick={() => { setRejecting(request.id); setRejectionReason(''); }} className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 disabled:opacity-50 text-sm flex items-center gap-1"><XCircle size={15}/>Reject</button></div>}
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                    <div className="bg-[#101012] rounded-xl p-3"><span className="text-gray-500 block text-xs">Name</span>{request.full_name || landlord.full_name || '—'}</div>
                    <div className="bg-[#101012] rounded-xl p-3"><span className="text-gray-500 block text-xs">Phone</span>{request.phone_number || landlord.whatsapp_number || '—'}</div>
                    <div className="bg-[#101012] rounded-xl p-3"><span className="text-gray-500 block text-xs">Role</span>{request.role || '—'}</div>
                    <div className="bg-[#101012] rounded-xl p-3"><span className="text-gray-500 block text-xs">Location</span>{property.landmark || '—'}</div>
                  </div>
                  {request.notes && <div className="text-sm text-gray-300 bg-blue-500/5 border border-blue-500/10 rounded-xl p-3"><span className="font-semibold">Notes:</span> {request.notes}</div>}
                  {property.images?.length > 0 && <div className="grid grid-cols-3 md:grid-cols-6 gap-2">{property.images.slice(0, 6).map((image, index) => <img key={`${image}-${index}`} src={image.startsWith('http') ? image : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/property-images/${image}`} alt={`Property ${index + 1}`} className="h-20 w-full object-cover rounded-lg border border-white/10" />)}</div>}
                  {rejecting === request.id && <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4"><label className="text-sm text-gray-300">Reason<input value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Explain what needs to be corrected or why verification failed." className="mt-2 w-full bg-[#101012] border border-white/10 rounded-lg px-3 py-2" /></label><div className="flex gap-2 mt-3"><button onClick={() => decide(request, 'rejected')} disabled={busyId === request.id} className="px-4 py-2 rounded-lg bg-red-600 text-sm">Confirm rejection</button><button onClick={() => setRejecting(null)} className="px-4 py-2 rounded-lg bg-white/5 text-sm">Cancel</button></div></div>}
                </div>;
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
