import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  Bell,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  RefreshCw,
  Users,
} from 'lucide-react';
import { supabase } from '../../../../lib/supabaseClient';

function formatDate(value) {
  if (!value) return 'Not recorded';

  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function RentNoticeDeliveryReport() {
  const router = useRouter();
  const { id } = router.query;

  const [notice, setNotice] = useState(null);
  const [property, setProperty] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const loadReport = useCallback(async () => {
    if (!id) return;

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

      /*
       * The landlord can only open reports for notices they created.
       */
      const { data: noticeRow, error: noticeError } = await supabase
        .from('rent_change_notices')
        .select('*')
        .eq('id', id)
        .eq('landlord_id', landlordId)
        .maybeSingle();

      if (noticeError) throw noticeError;

      if (!noticeRow) {
        throw new Error(
          'Rent notice not found or you do not have permission to view it.'
        );
      }

      setNotice(noticeRow);

      const [
        propertyResult,
        tenantResult,
        notificationResult,
        acknowledgementResult,
      ] = await Promise.all([
        supabase
          .from('properties')
          .select('id, title, landmark')
          .eq('id', noticeRow.property_id)
          .maybeSingle(),

        supabase
          .from('property_tenants')
          .select(
            `
              student_id,
              room_number,
              status,
              requested_at,
              decided_at,
              ended_at
            `
          )
          .eq('property_id', noticeRow.property_id)
          .eq('landlord_id', landlordId)
          .eq('status', 'confirmed')
          .is('ended_at', null),

        supabase
          .from('student_notifications')
          .select('id, student_id, read_at, created_at')
          .eq('notice_id', noticeRow.id),

        supabase
          .from('rent_notice_acknowledgements')
          .select('student_id, acknowledged_at')
          .eq('notice_id', noticeRow.id),
      ]);

      if (propertyResult.error) throw propertyResult.error;
      if (tenantResult.error) throw tenantResult.error;
      if (notificationResult.error) {
        throw notificationResult.error;
      }
      if (acknowledgementResult.error) {
        throw acknowledgementResult.error;
      }

      setProperty(propertyResult.data || null);

      const tenants = tenantResult.data || [];
      const notifications = notificationResult.data || [];
      const acknowledgements = acknowledgementResult.data || [];

      /*
       * Include current confirmed tenants and students who received
       * this specific notice. This preserves historical delivery data.
       */
      const recipientIds = [
        ...new Set([
          ...tenants.map((tenant) => tenant.student_id),
          ...notifications.map(
            (notification) => notification.student_id
          ),
        ]),
      ];

      let students = [];

      if (recipientIds.length > 0) {
        const { data: studentRows, error: studentError } =
          await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', recipientIds);

        if (studentError) throw studentError;

        students = studentRows || [];
      }

      const studentMap = Object.fromEntries(
        students.map((student) => [student.id, student])
      );

      const tenantMap = Object.fromEntries(
        tenants.map((tenant) => [tenant.student_id, tenant])
      );

      const notificationMap = Object.fromEntries(
        notifications.map((notification) => [
          notification.student_id,
          notification,
        ])
      );

      const acknowledgementMap = Object.fromEntries(
        acknowledgements.map((acknowledgement) => [
          acknowledgement.student_id,
          acknowledgement,
        ])
      );

      const combinedRecipients = recipientIds.map((studentId) => ({
        studentId,
        student: studentMap[studentId] || null,
        tenancy: tenantMap[studentId] || null,
        notification: notificationMap[studentId] || null,
        acknowledgement: acknowledgementMap[studentId] || null,
      }));

      setRecipients(combinedRecipients);
    } catch (error) {
      console.error('Unable to load delivery report:', error);

      setPageError(
        error.message || 'Unable to load delivery report.'
      );
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (!router.isReady) return undefined;

    const timer = window.setTimeout(loadReport, 0);
    return () => window.clearTimeout(timer);
  }, [router.isReady, loadReport]);

  const statistics = useMemo(() => {
    return {
      recipients: recipients.length,

      delivered: recipients.filter(
        (recipient) => recipient.notification
      ).length,

      read: recipients.filter(
        (recipient) => recipient.notification?.read_at
      ).length,

      acknowledged: recipients.filter(
        (recipient) => recipient.acknowledgement
      ).length,
    };
  }, [recipients]);

  return (
    <>
      <Head>
        <title>Notice Delivery Report | Chuka Rentals</title>
      </Head>

      <main className="min-h-screen bg-[#111214] text-white">
        <section className="mx-auto max-w-6xl px-5 py-10">
          <Link
            href="/landlord/rent-notices"
            className="mb-7 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={17} />
            Back to rent notices
          </Link>

          <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-400">
                Rent transparency
              </p>

              <h1 className="text-3xl font-bold">
                In-App Delivery Report
              </h1>

              <p className="mt-2 max-w-2xl text-slate-400">
                Review which confirmed tenants received, opened and
                acknowledged this semester rent notice.
              </p>
            </div>

            <button
              type="button"
              onClick={loadReport}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold transition hover:bg-white/10 disabled:opacity-50"
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

          {notice && (
            <section className="mb-7 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
              <div className="flex flex-col justify-between gap-5 md:flex-row">
                <div>
                  <div className="mb-3 flex items-center gap-2 text-amber-300">
                    <Building2 size={18} />

                    <span className="font-semibold">
                      {property?.title || 'Property'}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold">
                    Semester rent-change notice
                  </h2>

                  <p className="mt-2 text-slate-400">
                    Effective semester: {notice.effective_semester}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Published: {formatDate(notice.published_at)}
                  </p>
                </div>

                <div className="text-left md:text-right">
                  <p className="text-sm text-slate-400">
                    Previous semester rent
                  </p>

                  <p className="font-bold">
                    KSh{' '}
                    {Number(
                      notice.previous_semester_rent
                    ).toLocaleString('en-KE')}
                  </p>

                  <p className="mt-3 text-sm text-slate-400">
                    Proposed semester rent
                  </p>

                  <p className="text-xl font-bold text-amber-300">
                    KSh{' '}
                    {Number(
                      notice.proposed_semester_rent
                    ).toLocaleString('en-KE')}
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              icon={<Users size={21} />}
              label="Recipients"
              value={statistics.recipients}
            />

            <SummaryCard
              icon={<Bell size={21} />}
              label="Notices delivered"
              value={statistics.delivered}
            />

            <SummaryCard
              icon={<Eye size={21} />}
              label="Notices read"
              value={statistics.read}
            />

            <SummaryCard
              icon={<CheckCircle2 size={21} />}
              label="Acknowledged"
              value={statistics.acknowledged}
            />
          </section>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-[#17181c] p-12 text-center text-slate-400">
              Loading delivery report...
            </div>
          ) : recipients.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#17181c] p-12 text-center">
              <Users
                size={40}
                className="mx-auto mb-4 text-slate-600"
              />

              <h2 className="text-xl font-bold">
                No confirmed tenants found
              </h2>

              <p className="mt-2 text-slate-400">
                Confirmed tenants will appear here after being
                connected to this property.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recipients.map((recipient) => (
                <article
                  key={recipient.studentId}
                  className="rounded-2xl border border-white/10 bg-[#17181c] p-6"
                >
                  <div className="flex flex-col justify-between gap-6 lg:flex-row">
                    <div className="min-w-[210px]">
                      <h2 className="text-lg font-bold">
                        {recipient.student?.full_name ||
                          'Student account'}
                      </h2>

                      <p className="mt-1 text-sm text-slate-400">
                        Room:{' '}
                        {recipient.tenancy?.room_number ||
                          'Not specified'}
                      </p>
                    </div>

                    <div className="grid flex-1 gap-5 sm:grid-cols-3">
                      <ReportStatus
                        icon={<Bell size={17} />}
                        label="In-app delivery"
                        value={
                          recipient.notification
                            ? formatDate(
                                recipient.notification.created_at
                              )
                            : 'Not delivered'
                        }
                        success={Boolean(recipient.notification)}
                      />

                      <ReportStatus
                        icon={
                          recipient.notification?.read_at ? (
                            <Eye size={17} />
                          ) : (
                            <EyeOff size={17} />
                          )
                        }
                        label="Reading status"
                        value={
                          recipient.notification?.read_at
                            ? formatDate(
                                recipient.notification.read_at
                              )
                            : 'Unread'
                        }
                        success={Boolean(
                          recipient.notification?.read_at
                        )}
                      />

                      <ReportStatus
                        icon={<CheckCircle2 size={17} />}
                        label="Acknowledgement"
                        value={
                          recipient.acknowledgement
                            ? formatDate(
                                recipient.acknowledgement
                                  .acknowledged_at
                              )
                            : 'Not acknowledged'
                        }
                        success={Boolean(
                          recipient.acknowledgement
                        )}
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {notice && (
            <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5 text-sm leading-6 text-slate-400">
              An acknowledgement confirms that the student received
              the notice. It does not mean that the student agrees
              with the semester rent change.
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function SummaryCard({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#17181c] p-5">
      <div className="mb-4 text-blue-400">{icon}</div>

      <p className="text-sm text-slate-400">{label}</p>

      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}

function ReportStatus({ icon, label, value, success }) {
  return (
    <div>
      <div
        className={`mb-2 flex items-center gap-2 ${
          success ? 'text-emerald-300' : 'text-amber-300'
        }`}
      >
        {icon}

        <span className="text-xs font-semibold uppercase">
          {label}
        </span>
      </div>

      <p className="text-sm text-slate-300">{value}</p>
    </div>
  );
}
