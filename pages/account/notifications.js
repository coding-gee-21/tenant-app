import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  Home,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import RentNoticeConcern from '../../components/RentNoticeConcern';

function formatDate(value) {
  if (!value) return 'Date unavailable';

  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function NotificationIcon({ type }) {
  if (type === 'tenancy_confirmed') {
    return <CheckCircle2 className="text-emerald-400" size={22} />;
  }

  if (type === 'tenancy_rejected') {
    return <XCircle className="text-red-400" size={22} />;
  }

  if (type === 'rent_change') {
    return <Bell className="text-amber-400" size={22} />;
  }

  return <Bell className="text-blue-400" size={22} />;
}

export default function StudentNotificationsPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [properties, setProperties] = useState({});
  const [notices, setNotices] = useState({});
  const [acknowledgements, setAcknowledgements] = useState([]);
  const [concerns, setConcerns] = useState({});
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState(null);
  const [pageError, setPageError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadNotifications = useCallback(async () => {
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

      const currentUser = session.user;
      setUser(currentUser);

      const { data: notificationRows, error: notificationError } =
        await supabase
          .from('student_notifications')
          .select('*')
          .eq('student_id', currentUser.id)
          .order('created_at', { ascending: false });

      if (notificationError) throw notificationError;

      const rows = notificationRows || [];
      setNotifications(rows);

      const propertyIds = [
        ...new Set(rows.map((row) => row.property_id).filter(Boolean)),
      ];

      const noticeIds = [
        ...new Set(rows.map((row) => row.notice_id).filter(Boolean)),
      ];

      if (propertyIds.length > 0) {
        const { data: propertyRows, error: propertyError } =
          await supabase
            .from('properties')
            .select('id, title, landmark')
            .in('id', propertyIds);

        if (propertyError) throw propertyError;

        setProperties(
          Object.fromEntries(
            (propertyRows || []).map((property) => [
              property.id,
              property,
            ])
          )
        );
      } else {
        setProperties({});
      }

      if (noticeIds.length > 0) {
        const { data: noticeRows, error: noticeError } =
          await supabase
            .from('rent_change_notices')
            .select(
              `
                id,
                property_id,
                previous_semester_rent,
                proposed_semester_rent,
                effective_semester,
                effective_date,
                response_deadline,
                reason,
                notice_date,
                published_at,
                supporting_document_url,
                status,
                version_number,
                supersedes_notice_id,
                amendment_reason
              `
            )
            .in('id', noticeIds)
            .eq('status', 'published');

        if (noticeError) throw noticeError;

        setNotices(
          Object.fromEntries(
            (noticeRows || []).map((notice) => [notice.id, notice])
          )
        );

        const [acknowledgementResult, concernResult] =
          await Promise.all([
            supabase
              .from('rent_notice_acknowledgements')
              .select('notice_id, acknowledged_at')
              .eq('student_id', currentUser.id)
              .in('notice_id', noticeIds),
            supabase
              .from('rent_notice_concerns')
              .select(
                `
                  id,
                  notice_id,
                  status,
                  submitted_at,
                  responded_at,
                  last_message_at,
                  resolved_at
                `
              )
              .eq('student_id', currentUser.id)
              .in('notice_id', noticeIds),
          ]);

        const {
          data: acknowledgementRows,
          error: acknowledgementError,
        } = acknowledgementResult;

        const { data: concernRows, error: concernError } =
          concernResult;

        if (acknowledgementError) throw acknowledgementError;
        if (concernError) throw concernError;

        setAcknowledgements(acknowledgementRows || []);

        setConcerns(
          Object.fromEntries(
            (concernRows || []).map((concern) => [
              concern.notice_id,
              concern,
            ])
          )
        );
      } else {
        setNotices({});
        setAcknowledgements([]);
        setConcerns({});
      }
    } catch (error) {
      console.error('Unable to load notifications:', error);

      setPageError(
        error.message || 'Unable to load notifications.'
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const loadTimer = window.setTimeout(
      loadNotifications,
      0
    );

    return () => window.clearTimeout(loadTimer);
  }, [loadNotifications]);

  const acknowledgementByNoticeId = useMemo(
    () =>
      Object.fromEntries(
        acknowledgements.map((acknowledgement) => [
          acknowledgement.notice_id,
          acknowledgement,
        ])
      ),
    [acknowledgements]
  );

  const handleConcernChange = useCallback(
    (noticeId, concern) => {
      if (!noticeId) return;

      setConcerns((current) => {
        if (!concern) {
          const next = { ...current };
          delete next[noticeId];
          return next;
        }

        return {
          ...current,
          [noticeId]: concern,
        };
      });
    },
    []
  );

  const unreadCount = notifications.filter(
    (notification) => !notification.read_at
  ).length;

  async function markAsRead(notification) {
    if (notification.read_at) return;

    setWorkingId(notification.id);
    setPageError('');

    try {
      const { error } = await supabase.rpc(
        'mark_student_notification_read',
        {
          notification_id: notification.id,
        }
      );

      if (error) throw error;

      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, read_at: new Date().toISOString() }
            : item
        )
      );
    } catch (error) {
      setPageError(
        error.message || 'Unable to mark notification as read.'
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function acknowledgeNotice(notification) {
    if (!user || !notification.notice_id) return;

    setWorkingId(notification.id);
    setPageError('');
    setSuccessMessage('');

    try {
      const { data, error } = await supabase
        .from('rent_notice_acknowledgements')
        .insert({
          notice_id: notification.notice_id,
          student_id: user.id,
        })
        .select('notice_id, acknowledged_at')
        .single();

      if (error) {
        if (error.code === '23505') {
          setSuccessMessage(
            'You already acknowledged this notice.'
          );

          await loadNotifications();
          return;
        }

        throw error;
      }

      setAcknowledgements((current) => [...current, data]);

      if (!notification.read_at) {
        await markAsRead(notification);
      }

      setSuccessMessage(
        'Receipt acknowledged successfully. This confirms that you received the notice; it does not mean that you agree with the rent change.'
      );
    } catch (error) {
      setPageError(
        error.message || 'Unable to acknowledge the notice.'
      );
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <>
      <Head>
        <title>Notifications | Chuka Rentals</title>
      </Head>

      <main className="min-h-screen bg-[#111214] text-white">
        <section className="mx-auto max-w-5xl px-5 py-10">
          <Link
            href="/account"
            className="mb-7 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
          >
            <ArrowLeft size={17} />
            Back to account
          </Link>

          <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-400">
                Student account
              </p>

              <h1 className="text-3xl font-bold">
                Notifications
              </h1>

              <p className="mt-2 text-slate-400">
                You have {unreadCount} unread{' '}
                {unreadCount === 1
                  ? 'notification'
                  : 'notifications'}
                .
              </p>
            </div>

            <button
              type="button"
              onClick={loadNotifications}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold hover:bg-white/10 disabled:opacity-50"
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

          {successMessage && (
            <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-emerald-300">
              {successMessage}
            </div>
          )}

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-[#17181c] p-12 text-center text-slate-400">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#17181c] p-12 text-center">
              <Bell
                size={40}
                className="mx-auto mb-4 text-slate-600"
              />

              <h2 className="text-xl font-bold">
                No notifications yet
              </h2>

              <p className="mt-2 text-slate-400">
                Important housing notices will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => {
                const property =
                  properties[notification.property_id];

                const notice =
                  notices[notification.notice_id];

                const acknowledgement = notification.notice_id
                  ? acknowledgementByNoticeId[
                      notification.notice_id
                    ]
                  : null;

                const acknowledged = Boolean(acknowledgement);

                const concern = notification.notice_id
                  ? concerns[notification.notice_id]
                  : null;

                const responseDeadlineDays = daysFromToday(
                  notice?.response_deadline
                );

                const effectiveDateDays = daysFromToday(
                  notice?.effective_date
                );

                return (
                  <article
                    key={notification.id}
                    className={`rounded-2xl border p-6 ${
                      notification.read_at
                        ? 'border-white/10 bg-[#17181c]'
                        : 'border-blue-500/40 bg-blue-500/5'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="rounded-xl bg-black/30 p-3">
                        <NotificationIcon
                          type={
                            notification.notification_type
                          }
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h2 className="text-lg font-bold">
                            {notification.title}
                          </h2>

                          {!notification.read_at && (
                            <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold">
                              New
                            </span>
                          )}
                        </div>

                        <p className="mt-2 leading-6 text-slate-300">
                          {notification.message}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-400">
                          {property && (
                            <span className="inline-flex items-center gap-2">
                              <Building2 size={15} />
                              {property.title}
                            </span>
                          )}

                          <span className="inline-flex items-center gap-2">
                            <Clock3 size={15} />
                            {formatDate(
                              notification.created_at
                            )}
                          </span>
                        </div>

                        {notice && (
                          <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
                            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="font-bold text-amber-100">
                                  Semester rent-change notice
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  Published notice · permanent
                                  pricing record
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
                                  Version{' '}
                                  {notice.version_number || 1}
                                </span>

                                {notice.supersedes_notice_id && (
                                  <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300">
                                    Amended notice
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <p className="text-xs uppercase text-slate-500">
                                  Previous semester rent
                                </p>

                                <p className="mt-1 font-bold">
                                  KSh{' '}
                                  {Number(
                                    notice.previous_semester_rent
                                  ).toLocaleString('en-KE')}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs uppercase text-slate-500">
                                  Proposed semester rent
                                </p>

                                <p className="mt-1 font-bold text-amber-300">
                                  KSh{' '}
                                  {Number(
                                    notice.proposed_semester_rent
                                  ).toLocaleString('en-KE')}
                                </p>
                              </div>
                            </div>

                            <div className="mt-5 grid gap-4 md:grid-cols-2">
                              <div
                                className={`rounded-xl border p-4 ${
                                  responseDeadlineDays !== null &&
                                  responseDeadlineDays < 0
                                    ? 'border-slate-700 bg-slate-900/40'
                                    : 'border-blue-500/20 bg-blue-500/5'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <CalendarDays
                                    size={18}
                                    className="mt-0.5 shrink-0 text-blue-400"
                                  />

                                  <div>
                                    <p className="text-xs uppercase text-slate-500">
                                      Concern response deadline
                                    </p>

                                    <p className="mt-1 font-semibold">
                                      {formatDateOnly(
                                        notice.response_deadline
                                      )}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-400">
                                      {notice.response_deadline
                                        ? responseDeadlineDays >= 0
                                          ? `${describeDateDistance(
                                              notice.response_deadline
                                            )} · response window open`
                                          : `${describeDateDistance(
                                              notice.response_deadline
                                            )} · deadline passed`
                                        : 'Legacy notice without a recorded deadline'}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div
                                className={`rounded-xl border p-4 ${
                                  effectiveDateDays !== null &&
                                  effectiveDateDays <= 0
                                    ? 'border-emerald-500/20 bg-emerald-500/5'
                                    : 'border-amber-500/20 bg-amber-500/5'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <Clock3
                                    size={18}
                                    className="mt-0.5 shrink-0 text-amber-400"
                                  />

                                  <div>
                                    <p className="text-xs uppercase text-slate-500">
                                      New rent effective date
                                    </p>

                                    <p className="mt-1 font-semibold">
                                      {formatDateOnly(
                                        notice.effective_date
                                      )}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-400">
                                      {notice.effective_date
                                        ? effectiveDateDays <= 0
                                          ? `${describeDateDistance(
                                              notice.effective_date
                                            )} · rent change effective`
                                          : `${describeDateDistance(
                                              notice.effective_date
                                            )} · upcoming change`
                                        : 'Legacy notice without an exact effective date'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-4">
                              <p className="text-xs uppercase text-slate-500">
                                Effective semester
                              </p>

                              <p className="mt-1 font-semibold">
                                {notice.effective_semester}
                              </p>
                            </div>

                            <div className="mt-4">
                              <p className="text-xs uppercase text-slate-500">
                                Landlord’s explanation
                              </p>

                              <p className="mt-1 leading-6 text-slate-300">
                                {notice.reason}
                              </p>
                            </div>

                            {notice.amendment_reason && (
                              <div className="mt-4 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                                <p className="text-xs uppercase text-purple-300">
                                  Reason for amendment
                                </p>

                                <p className="mt-1 text-sm leading-6 text-slate-300">
                                  {notice.amendment_reason}
                                </p>
                              </div>
                            )}

                            {notice.supporting_document_url && (
                              <a
                                href={
                                  notice.supporting_document_url
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="mt-4 inline-flex text-sm font-semibold text-blue-400 hover:text-blue-300"
                              >
                                View supporting document
                              </a>
                            )}

                            <NoticeActivityTimeline
                              notification={notification}
                              notice={notice}
                              acknowledgement={acknowledgement}
                              concern={concern}
                            />

                            <p className="mt-4 text-xs leading-5 text-slate-500">
                              Acknowledgement confirms receipt only.
                              It does not represent agreement with
                              the rent change.
                            </p>

                            <RentNoticeConcern
                              noticeId={notice.id}
                              studentId={user?.id}
                              onConcernChange={
                                handleConcernChange
                              }
                            />
                          </div>
                        )}

                        <div className="mt-5 flex flex-wrap gap-3">
                          {!notification.read_at && (
                            <button
                              type="button"
                              disabled={
                                workingId === notification.id
                              }
                              onClick={() =>
                                markAsRead(notification)
                              }
                              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
                            >
                              <Check size={16} />
                              Mark as read
                            </button>
                          )}

                          {notice && !acknowledged && (
                            <button
                              type="button"
                              disabled={
                                workingId === notification.id
                              }
                              onClick={() =>
                                acknowledgeNotice(notification)
                              }
                              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold hover:bg-blue-500 disabled:opacity-50"
                            >
                              <CheckCircle2 size={16} />
                              Acknowledge receipt
                            </button>
                          )}

                          {acknowledged && (
                            <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300">
                              <CheckCircle2 size={16} />
                              Receipt acknowledged
                            </span>
                          )}

                          {notification.property_id && (
                            <Link
                              href={`/properties/${notification.property_id}`}
                              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/5"
                            >
                              <Home size={16} />
                              View property
                            </Link>
                          )}
                        </div>
                      </div>
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

function formatDateOnly(value) {
  if (!value) return 'Not recorded';

  return new Intl.DateTimeFormat('en-KE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

function daysFromToday(value) {
  if (!value) return null;

  const today = new Date();

  const currentDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const targetDate = new Date(`${value}T00:00:00`);

  if (Number.isNaN(targetDate.getTime())) return null;

  return Math.round(
    (targetDate - currentDate) / 86400000
  );
}

function describeDateDistance(value) {
  const days = daysFromToday(value);

  if (days === null) return 'Date not recorded';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 1) return `${days} days away`;
  if (days === -1) return 'Yesterday';

  return `${Math.abs(days)} days ago`;
}

function NoticeActivityTimeline({
  notification,
  notice,
  acknowledgement,
  concern,
}) {
  const receiptActivity = [
    {
      label: 'Notice published',
      value: notice.published_at
        ? formatDate(notice.published_at)
        : formatDateOnly(notice.notice_date),
      complete: Boolean(
        notice.published_at || notice.notice_date
      ),
    },
    {
      label: 'Delivered in the app',
      value: formatDate(notification.created_at),
      complete: true,
    },
    {
      label: 'Notice read',
      value: notification.read_at
        ? formatDate(notification.read_at)
        : 'Not read yet',
      complete: Boolean(notification.read_at),
    },
    {
      label: 'Receipt acknowledged',
      value: acknowledgement?.acknowledged_at
        ? formatDate(acknowledgement.acknowledged_at)
        : 'Not acknowledged yet',
      complete: Boolean(
        acknowledgement?.acknowledged_at
      ),
    },
  ];

  const responseDeadlineDays = daysFromToday(
    notice.response_deadline
  );

  const responseDeadlinePassed =
    responseDeadlineDays !== null &&
    responseDeadlineDays < 0;

  const landlordHasReplied = Boolean(
    concern?.responded_at ||
      ['responded', 'in_discussion', 'resolved'].includes(
        concern?.status
      )
  );

  const discussionStarted = Boolean(
    concern &&
      ['in_discussion', 'resolved'].includes(
        concern.status
      )
  );

  const concernResolved = Boolean(
    concern?.resolved_at ||
      concern?.status === 'resolved'
  );

  const concernActivity = [
    {
      label: 'Concern submitted',
      value: concern?.submitted_at
        ? formatDate(concern.submitted_at)
        : responseDeadlinePassed
          ? 'No concern submitted before the deadline'
          : notice.response_deadline
            ? `Optional · available until ${formatDateOnly(
                notice.response_deadline
              )}`
            : 'Optional · no deadline recorded',
      state: concern
        ? 'complete'
        : responseDeadlinePassed
          ? 'neutral'
          : 'available',
    },
    {
      label: 'Landlord replied',
      value: landlordHasReplied
        ? formatDate(
            concern.responded_at ||
              concern.last_message_at
          )
        : concern
          ? 'Waiting for the landlord'
          : 'Available after you submit a concern',
      state: landlordHasReplied
        ? 'complete'
        : concern
          ? 'pending'
          : 'neutral',
    },
    {
      label: 'Discussion opened',
      value: discussionStarted
        ? concern.last_message_at
          ? `Latest activity ${formatDate(
              concern.last_message_at
            )}`
          : 'Conversation is active'
        : concern
          ? 'Opens when the conversation continues'
          : 'Available after a concern is submitted',
      state: discussionStarted
        ? concernResolved
          ? 'complete'
          : 'active'
        : 'neutral',
    },
    {
      label: 'Resolved by you',
      value: concernResolved
        ? concern.resolved_at
          ? formatDate(concern.resolved_at)
          : 'Resolved'
        : concern
          ? 'You can confirm resolution when satisfied'
          : 'Available after a concern is submitted',
      state: concernResolved
        ? 'complete'
        : 'neutral',
    },
  ];

  const verifiedReceiptSteps = receiptActivity.filter(
    (item) => item.complete
  ).length;

  return (
    <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <Eye size={17} className="text-blue-400" />
            Your verified notice timeline
          </h3>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Completed steps are backed by timestamps stored
            in the system.
          </p>
        </div>

        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
          {verifiedReceiptSteps} of{' '}
          {receiptActivity.length} receipt steps verified
        </span>
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <TimelineSection
          title="Verified receipt record"
          description="Proof that the notice reached your account and what you did with it."
          items={receiptActivity.map((item) => ({
            ...item,
            state: item.complete
              ? 'complete'
              : 'pending',
          }))}
        />

        <TimelineSection
          title="Concern journey"
          description="Optional. Raising a concern is not required to acknowledge the notice."
          items={concernActivity}
        />
      </div>
    </div>
  );
}

function TimelineSection({
  title,
  description,
  items,
}) {
  return (
    <section>
      <h4 className="text-sm font-bold text-slate-200">
        {title}
      </h4>

      <p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">
        {description}
      </p>

      <div className="mt-4">
        {items.map((item, index) => {
          const complete =
            item.state === 'complete';

          const active =
            item.state === 'active';

          const available =
            item.state === 'available';

          const pending =
            item.state === 'pending';

          return (
            <div
              key={item.label}
              className="relative flex gap-3 pb-5 last:pb-0"
            >
              {index < items.length - 1 && (
                <span
                  className={`absolute left-[9px] top-5 h-full w-px ${
                    complete
                      ? 'bg-emerald-500/40'
                      : active || available
                        ? 'bg-blue-500/30'
                        : 'bg-white/10'
                  }`}
                />
              )}

              <span
                className={`relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  complete
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                    : active
                      ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                      : available
                        ? 'border-blue-500/60 bg-blue-500/10 text-blue-300'
                        : pending
                          ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                          : 'border-slate-700 bg-[#17181c] text-slate-600'
                }`}
              >
                {complete ? (
                  <Check size={12} />
                ) : (
                  <Clock3 size={11} />
                )}
              </span>

              <div>
                <p
                  className={`text-sm font-semibold ${
                    complete
                      ? 'text-slate-200'
                      : active || available
                        ? 'text-blue-300'
                        : pending
                          ? 'text-amber-200'
                          : 'text-slate-500'
                  }`}
                >
                  {item.label}
                </p>

                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  {item.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}