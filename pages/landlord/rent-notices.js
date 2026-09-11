import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Pencil,
  Trash2,
  TrendingDown,
  TrendingUp,
  X
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const money = (value) =>
  Number(value || 0).toLocaleString('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const todayInputValue = () => toDateInputValue(new Date());

const daysBetween = (startValue, endValue) => {
  if (!startValue || !endValue) return null;

  const start = new Date(`${startValue}T00:00:00`);
  const end = new Date(`${endValue}T00:00:00`);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return null;
  }

  return Math.round((end - start) / 86400000);
};

const formatDate = (value) => {
  if (!value) return 'Not provided';

  return new Date(`${value}T00:00:00`).toLocaleDateString(
    'en-KE',
    {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }
  );
};

const emptyChecklist = {
  amountsConfirmed: false,
  dateConfirmed: false,
  explanationConfirmed: false,
  notificationConfirmed: false
};

export default function RentNotices() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [properties, setProperties] = useState([]);
  const [notices, setNotices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingDraftId, setEditingDraftId] =
    useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [publishChecklist, setPublishChecklist] =
    useState(emptyChecklist);

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [form, setForm] = useState({
    propertyId: '',
    proposedRent: '',
    effectiveSemester: '',
    effectiveDate: '',
    responseDeadline: '',
    reason: '',
    supportingDocumentUrl: ''
  });

  useEffect(() => {
    async function loadPage() {
      setLoading(true);
      setErrorMessage('');

      try {
        const {
          data: { session }
        } = await supabase.auth.getSession();

        if (!session) {
          router.replace(
            '/auth?returnTo=/landlord/rent-notices'
          );
          return;
        }

        const currentUser = session.user;
        setUser(currentUser);

        const { data: profile, error: profileError } =
          await supabase
            .from('profiles')
            .select('role')
            .eq('id', currentUser.id)
            .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (
          profile?.role !== 'landlord' &&
          profile?.role !== 'admin'
        ) {
          router.replace('/landlord');
          return;
        }

        const {
          data: propertyData,
          error: propertyError
        } = await supabase
          .from('properties')
          .select(
            'id, title, landmark, semester_rent'
          )
          .or(
            `user_id.eq.${currentUser.id},landlord_id.eq.${currentUser.id}`
          )
          .order('title', { ascending: true });

        if (propertyError) {
          throw propertyError;
        }

        setProperties(propertyData || []);

        const {
          data: noticeData,
          error: noticeError
        } = await supabase
          .from('rent_change_notices')
          .select(`
            *,
            properties (
              title,
              landmark
            )
          `)
          .eq('landlord_id', currentUser.id)
          .order('created_at', { ascending: false });

        if (noticeError) {
          throw noticeError;
        }

        setNotices(noticeData || []);
      } catch (error) {
        console.error('Rent notice loading error:', error);

        setErrorMessage(
          error.message ||
            'Unable to load semester rent notices.'
        );
      } finally {
        setLoading(false);
      }
    }

    loadPage();
  }, [router]);

  const selectedProperty = useMemo(() => {
    return properties.find(
      (property) => property.id === form.propertyId
    );
  }, [properties, form.propertyId]);

  const currentSemesterRent = useMemo(() => {
    if (!selectedProperty) return 0;

    return Number(
      selectedProperty.semester_rent || 0
    );
  }, [selectedProperty]);

  const proposedSemesterRent =
    Number(form.proposedRent || 0);

  const rentDifference =
    proposedSemesterRent - currentSemesterRent;

  const percentageChange =
    currentSemesterRent > 0 && proposedSemesterRent > 0
      ? (rentDifference / currentSemesterRent) * 100
      : 0;

  const advanceNoticeDays = daysBetween(
    todayInputValue(),
    form.effectiveDate
  );

  const responseWindowDays = daysBetween(
    todayInputValue(),
    form.responseDeadline
  );

  const significantIncrease = percentageChange >= 15;

  const checklistComplete = Object.values(
    publishChecklist
  ).every(Boolean);

  const resetForm = () => {
    setForm({
      propertyId: '',
      proposedRent: '',
      effectiveSemester: '',
      effectiveDate: '',
      responseDeadline: '',
      reason: '',
      supportingDocumentUrl: ''
    });

    setPublishChecklist(emptyChecklist);
    setEditingDraftId(null);
    setShowPreview(false);
  };

  const validateNotice = (status) => {
    if (!user) return 'Please sign in again.';
    if (!selectedProperty) return 'Select a property.';

    if (currentSemesterRent <= 0) {
      return 'The selected property does not have a valid current semester rent.';
    }

    if (proposedSemesterRent <= 0) {
      return 'Enter a valid proposed semester rent.';
    }

    if (proposedSemesterRent === currentSemesterRent) {
      return 'The proposed rent must be different from the current semester rent.';
    }

    if (!form.effectiveSemester.trim()) {
      return 'Enter the semester when the new rent will take effect.';
    }

    if (!form.effectiveDate) {
      return 'Select the exact date when the new semester rent will take effect.';
    }

    if (advanceNoticeDays === null || advanceNoticeDays < 0) {
      return 'The effective date cannot be in the past.';
    }

    if (status === 'published' && advanceNoticeDays === 0) {
      return 'A published rent notice must take effect on a future date.';
    }

    if (!form.responseDeadline) {
      return 'Select the deadline for students to raise concerns.';
    }

    if (responseWindowDays === null || responseWindowDays < 0) {
      return 'The student response deadline cannot be in the past.';
    }

    if (form.responseDeadline > form.effectiveDate) {
      return 'The student response deadline must be on or before the effective date.';
    }

    if (form.reason.trim().length < 30) {
      return 'Provide a clear justification of at least 30 characters.';
    }

    return '';
  };

  const openPublishPreview = () => {
    setErrorMessage('');
    setMessage('');

    const validationError = validateNotice('published');

    if (validationError) {
      setErrorMessage(validationError);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setPublishChecklist(emptyChecklist);
    setShowPreview(true);
  };

  const createNotice = async (status) => {
    setErrorMessage('');
    setMessage('');

    const validationError = validateNotice(status);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    if (status === 'published' && !checklistComplete) {
      setErrorMessage(
        'Complete every confirmation in the publishing checklist.'
      );
      return;
    }

    setSubmitting(true);

    try {
      const publishedTimestamp =
        status === 'published'
          ? new Date().toISOString()
          : null;

      const payload = {
        property_id: selectedProperty.id,
        landlord_id: user.id,
        previous_semester_rent: currentSemesterRent,
        proposed_semester_rent: proposedSemesterRent,
        effective_semester:
          form.effectiveSemester.trim(),
        effective_date: form.effectiveDate,
        response_deadline: form.responseDeadline,
        reason: form.reason.trim(),
        supporting_document_url:
          form.supportingDocumentUrl.trim() || null,
        status,
        updated_at: new Date().toISOString(),
        published_at: publishedTimestamp,
        locked_at: publishedTimestamp
      };

      let noticeQuery = supabase.from(
        'rent_change_notices'
      );

      noticeQuery = editingDraftId
        ? noticeQuery
            .update(payload)
            .eq('id', editingDraftId)
            .eq('landlord_id', user.id)
            .eq('status', 'draft')
        : noticeQuery.insert(payload);

      const { data, error } = await noticeQuery
        .select(`
          *,
          properties (
            title,
            landmark
          )
        `)
        .single();

      if (error) {
        throw error;
      }

      setNotices((current) =>
        editingDraftId
          ? current.map((notice) =>
              notice.id === editingDraftId
                ? data
                : notice
            )
          : [data, ...current]
      );

      setMessage(
        editingDraftId
          ? status === 'published'
            ? 'Draft published successfully.'
            : 'Draft changes saved successfully.'
          : status === 'published'
            ? 'Semester rent notice published successfully.'
            : 'Semester rent notice saved as a draft.'
      );

      resetForm();
    } catch (error) {
      console.error('Rent notice saving error:', error);

      setErrorMessage(
        error.message ||
          'Unable to save the semester rent notice.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const editDraft = (notice) => {
    if (notice.status !== 'draft') return;

    setEditingDraftId(notice.id);

    setForm({
      propertyId: notice.property_id || '',
      proposedRent: String(
        notice.proposed_semester_rent || ''
      ),
      effectiveSemester:
        notice.effective_semester || '',
      effectiveDate:
        notice.effective_date?.slice(0, 10) || '',
      responseDeadline:
        notice.response_deadline?.slice(0, 10) || '',
      reason: notice.reason || '',
      supportingDocumentUrl:
        notice.supporting_document_url || ''
    });

    setPublishChecklist(emptyChecklist);
    setShowPreview(false);
    setMessage('');
    setErrorMessage('');

    window.requestAnimationFrame(() => {
      document
        .getElementById('rent-notice-form')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
    });
  };

  const deleteDraft = async (noticeId) => {
    const confirmed = window.confirm(
      'Delete this draft rent notice?'
    );

    if (!confirmed) return;

    setDeletingId(noticeId);
    setErrorMessage('');

    try {
      const { error } = await supabase
        .from('rent_change_notices')
        .delete()
        .eq('id', noticeId)
        .eq('status', 'draft');

      if (error) {
        throw error;
      }

      setNotices((current) =>
        current.filter((notice) => notice.id !== noticeId)
      );

      if (editingDraftId === noticeId) {
        resetForm();
      }

      setMessage('Draft notice deleted.');
    } catch (error) {
      setErrorMessage(
        error.message || 'Unable to delete the draft.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-400">
        Loading semester rent notices...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 text-white">
      <header>
        <Link
          href="/landlord/dashboard"
          className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
        >
          <ArrowLeft size={16} />
          Landlord dashboard
        </Link>

        <div className="mt-4">
          <p className="text-sm font-semibold text-blue-400">
            Fair pricing and transparency
          </p>

          <h1 className="mt-1 text-3xl font-bold">
            Semester Rent Notices
          </h1>

          <p className="mt-2 max-w-3xl text-gray-400">
            Give students a dated explanation before changing a
            property&apos;s semester rent. Published notices become
            part of the property&apos;s pricing history.
          </p>
        </div>
      </header>

      {errorMessage && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {errorMessage}
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          {message}
        </div>
      )}

      <section
        id="rent-notice-form"
        className="scroll-mt-6 rounded-2xl border border-white/10 bg-[#18181B] p-6"
      >
        <div className="mb-6">
          <h2 className="text-xl font-bold">
            {editingDraftId
              ? 'Edit saved draft'
              : 'Create a rent-change notice'}
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            Saving or publishing this notice will not immediately
            change the property&apos;s advertised semester rent.
          </p>
        </div>

        {editingDraftId && (
          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-blue-200">
                Draft editing mode
              </p>

              <p className="mt-1 text-sm text-blue-100/70">
                Your changes will update the existing draft rather
                than create another one.
              </p>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={resetForm}
              className="rounded-lg border border-blue-400/30 px-4 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-500/10 disabled:opacity-50"
            >
              Cancel editing
            </button>
          </div>
        )}

        {properties.length === 0 ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-5 text-amber-200">
            You must have at least one property before creating a
            rent notice.
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Property *
              </label>

              <select
                value={form.propertyId}
                onChange={(event) =>
                  setForm({
                    ...form,
                    propertyId: event.target.value
                  })
                }
                className="w-full rounded-xl border border-white/10 bg-[#101013] p-3 outline-none focus:border-blue-500"
              >
                <option value="">Select a property</option>

                {properties.map((property) => (
                  <option
                    key={property.id}
                    value={property.id}
                  >
                    {property.title} —{' '}
                    {property.landmark || 'No landmark'}
                  </option>
                ))}
              </select>
            </div>

            {selectedProperty && (
              <div className="grid gap-4 rounded-xl border border-white/10 bg-[#101013] p-5 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <span className="text-xs uppercase text-gray-500">
                    Current semester rent
                  </span>

                  <p className="mt-1 text-xl font-bold text-emerald-400">
                    KSh {money(currentSemesterRent)}
                  </p>
                </div>

                <div>
                  <span className="text-xs uppercase text-gray-500">
                    Proposed semester rent
                  </span>

                  <p className="mt-1 text-xl font-bold">
                    KSh {money(proposedSemesterRent)}
                  </p>
                </div>

                <div>
                  <span className="text-xs uppercase text-gray-500">
                    Rent difference
                  </span>

                  <p
                    className={`mt-1 text-xl font-bold ${
                      rentDifference > 0
                        ? 'text-amber-400'
                        : rentDifference < 0
                          ? 'text-emerald-400'
                          : 'text-gray-400'
                    }`}
                  >
                    {rentDifference > 0 ? '+' : ''}KSh{' '}
                    {money(rentDifference)}
                  </p>
                </div>

                <div>
                  <span className="text-xs uppercase text-gray-500">
                    Percentage change
                  </span>

                  <p
                    className={`mt-1 flex items-center gap-2 text-xl font-bold ${
                      percentageChange > 0
                        ? 'text-amber-400'
                        : percentageChange < 0
                          ? 'text-emerald-400'
                          : 'text-gray-400'
                    }`}
                  >
                    {percentageChange > 0 ? (
                      <TrendingUp size={20} />
                    ) : percentageChange < 0 ? (
                      <TrendingDown size={20} />
                    ) : null}

                    {percentageChange > 0 ? '+' : ''}
                    {percentageChange.toFixed(1)}%
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Proposed semester rent (KSh) *
                </label>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.proposedRent}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      proposedRent: event.target.value
                    })
                  }
                  placeholder="For example, 24000"
                  className="w-full rounded-xl border border-white/10 bg-[#101013] p-3 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Effective semester *
                </label>

                <input
                  type="text"
                  value={form.effectiveSemester}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      effectiveSemester:
                        event.target.value
                    })
                  }
                  placeholder="For example, January–April 2027"
                  maxLength={100}
                  className="w-full rounded-xl border border-white/10 bg-[#101013] p-3 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Exact effective date *
                </label>

                <input
                  type="date"
                  min={todayInputValue()}
                  value={form.effectiveDate}
                  onChange={(event) => {
                    const effectiveDate = event.target.value;
                    const responseDeadline =
                      form.responseDeadline > effectiveDate
                        ? ''
                        : form.responseDeadline;

                    setForm({
                      ...form,
                      effectiveDate,
                      responseDeadline
                    });
                  }}
                  className="w-full rounded-xl border border-white/10 bg-[#101013] p-3 outline-none focus:border-blue-500"
                />

                <p className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  <CalendarDays size={14} />
                  {advanceNoticeDays === null
                    ? 'Select the date the new rent begins.'
                    : `${advanceNoticeDays} day${
                        advanceNoticeDays === 1 ? '' : 's'
                      } of advance notice.`}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Student response deadline *
                </label>

                <input
                  type="date"
                  min={todayInputValue()}
                  max={form.effectiveDate || undefined}
                  value={form.responseDeadline}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      responseDeadline: event.target.value
                    })
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#101013] p-3 outline-none focus:border-blue-500"
                />

                <p className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  <Clock3 size={14} />
                  {responseWindowDays === null
                    ? 'Students may raise concerns until this date.'
                    : `${responseWindowDays} day${
                        responseWindowDays === 1 ? '' : 's'
                      } remaining to submit concerns.`}
                </p>
              </div>
            </div>

            {significantIncrease && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                <AlertTriangle
                  size={20}
                  className="mt-0.5 shrink-0"
                />

                <div>
                  <p className="font-semibold">
                    Significant rent adjustment
                  </p>

                  <p className="mt-1 leading-6 text-amber-100/80">
                    This change is {percentageChange.toFixed(1)}%.
                    Provide a detailed, factual explanation before
                    publishing. This warning does not prevent a valid
                    notice from being issued.
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium">
                Reason and justification *
              </label>

              <textarea
                rows={5}
                value={form.reason}
                onChange={(event) =>
                  setForm({
                    ...form,
                    reason: event.target.value
                  })
                }
                placeholder="Explain the reason for the change, the costs involved and how students were informed."
                maxLength={1500}
                className="w-full rounded-xl border border-white/10 bg-[#101013] p-3 outline-none focus:border-blue-500"
              />

              <p className="mt-1 text-right text-xs text-gray-500">
                {form.reason.length}/1500 · minimum 30 characters
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Supporting document URL
              </label>

              <input
                type="url"
                value={form.supportingDocumentUrl}
                onChange={(event) =>
                  setForm({
                    ...form,
                    supportingDocumentUrl:
                      event.target.value
                  })
                }
                placeholder="Optional link to a supporting document"
                className="w-full rounded-xl border border-white/10 bg-[#101013] p-3 outline-none focus:border-blue-500"
              />

              <p className="mt-2 text-xs text-gray-500">
                Document uploading will be added later. Leave this
                empty unless you already have a valid document link.
              </p>
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={() => createNotice('draft')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold hover:bg-white/10 disabled:opacity-50"
              >
                <FileText size={18} />

                {editingDraftId
                  ? 'Save draft changes'
                  : 'Save as draft'}
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={openPublishPreview}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
              >
                <Eye size={18} />
                Review and publish
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">
            Your rent-notice history
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            Published notices remain visible as part of the
            property&apos;s pricing record.
          </p>
        </div>

        {notices.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#18181B] p-10 text-center text-gray-400">
            You have not created any semester rent notices.
          </div>
        ) : (
          <div className="grid gap-4">
            {notices.map((notice) => {
              const change =
                Number(notice.proposed_semester_rent) -
                Number(notice.previous_semester_rent);

              const percent =
                Number(notice.previous_semester_rent) > 0
                  ? (change /
                      Number(
                        notice.previous_semester_rent
                      )) *
                    100
                  : 0;

              const noticeStartDate =
                notice.published_at?.slice(0, 10) ||
                notice.notice_date;

              const recordedAdvanceDays = daysBetween(
                noticeStartDate,
                notice.effective_date
              );

              return (
                <article
                  key={notice.id}
                  className="rounded-2xl border border-white/10 bg-[#18181B] p-5"
                >
                  <div className="flex flex-col justify-between gap-4 md:flex-row">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold">
                          {notice.properties?.title ||
                            'Property'}
                        </h3>

                        <span
                          className={`rounded-full px-3 py-1 text-xs capitalize ${
                            notice.status === 'published'
                              ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                              : notice.status === 'draft'
                                ? 'border border-gray-500/20 bg-gray-500/10 text-gray-300'
                                : 'border border-amber-500/20 bg-amber-500/10 text-amber-300'
                          }`}
                        >
                          {notice.status.replace('_', ' ')}
                        </span>

                        <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
                          Version {notice.version_number || 1}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-1 text-sm text-gray-400">
                        <p>
                          Effective semester:{' '}
                          {notice.effective_semester}
                        </p>

                        <p>
                          Exact effective date:{' '}
                          {notice.effective_date
                            ? formatDate(notice.effective_date)
                            : 'Not recorded for this legacy notice'}
                        </p>

                        <p>
                          Student response deadline:{' '}
                          {notice.response_deadline
                            ? formatDate(
                                notice.response_deadline
                              )
                            : 'Not recorded'}
                        </p>

                        {recordedAdvanceDays !== null && (
                          <p>
                            Advance-notice period:{' '}
                            {recordedAdvanceDays} day
                            {recordedAdvanceDays === 1 ? '' : 's'}
                          </p>
                        )}

                        <p>
                          Notice date:{' '}
                          {new Date(
                            notice.notice_date
                          ).toLocaleDateString('en-KE')}
                        </p>
                      </div>
                    </div>

                    <div className="text-left md:text-right">
                      <p className="font-semibold">
                        KSh{' '}
                        {money(
                          notice.previous_semester_rent
                        )}
                        {' → '}
                        KSh{' '}
                        {money(
                          notice.proposed_semester_rent
                        )}
                      </p>

                      <p
                        className={`mt-1 text-sm ${
                          percent > 0
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {percent > 0 ? '+' : ''}
                        {percent.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-[#101013] p-4">
                    <p className="text-xs uppercase text-gray-500">
                      Justification
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-300">
                      {notice.reason}
                    </p>
                  </div>

                  {notice.status === 'published' && (
                    <div className="mt-4">
                      <Link
                        href={`/landlord/rent-notices/${notice.id}/report`}
                        className="inline-flex items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20"
                      >
                        View in-app delivery report
                      </Link>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs text-gray-500">
                      <CalendarDays size={14} />
                      Created{' '}
                      {new Date(
                        notice.created_at
                      ).toLocaleDateString('en-KE')}
                    </span>

                    {notice.status === 'draft' && (
                      <div className="flex flex-wrap items-center gap-4">
                        <button
                          type="button"
                          disabled={
                            submitting ||
                            deletingId === notice.id
                          }
                          onClick={() => editDraft(notice)}
                          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-50"
                        >
                          <Pencil size={16} />
                          Edit draft
                        </button>

                        <button
                          type="button"
                          disabled={deletingId === notice.id}
                          onClick={() =>
                            deleteDraft(notice.id)
                          }
                          className="inline-flex items-center gap-2 text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                        >
                          <Trash2 size={16} />
                          Delete draft
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

      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 px-4 py-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="publish-preview-title"
        >
          <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#18181B] shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/10 p-6">
              <div>
                <p className="text-sm font-semibold text-blue-400">
                  Final publishing check
                </p>

                <h2
                  id="publish-preview-title"
                  className="mt-1 text-2xl font-bold"
                >
                  Review semester rent notice
                </h2>

                <p className="mt-2 text-sm text-gray-400">
                  Published notices are locked. Correct a published
                  notice by issuing a clearly linked amendment.
                </p>
              </div>

              <button
                type="button"
                aria-label="Close publishing preview"
                disabled={submitting}
                onClick={() => setShowPreview(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 p-6">
              {errorMessage && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                  {errorMessage}
                </div>
              )}

              <div className="grid gap-4 rounded-xl border border-white/10 bg-[#101013] p-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-gray-500">
                    Property
                  </p>
                  <p className="mt-1 font-semibold">
                    {selectedProperty?.title}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase text-gray-500">
                    Effective semester
                  </p>
                  <p className="mt-1 font-semibold">
                    {form.effectiveSemester}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase text-gray-500">
                    Current semester rent
                  </p>
                  <p className="mt-1 font-semibold text-emerald-400">
                    KSh {money(currentSemesterRent)}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase text-gray-500">
                    Proposed semester rent
                  </p>
                  <p className="mt-1 font-semibold text-amber-400">
                    KSh {money(proposedSemesterRent)}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase text-gray-500">
                    Change
                  </p>
                  <p className="mt-1 font-semibold">
                    {rentDifference > 0 ? '+' : ''}KSh{' '}
                    {money(rentDifference)} ({percentageChange > 0
                      ? '+'
                      : ''}
                    {percentageChange.toFixed(1)}%)
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase text-gray-500">
                    Effective date
                  </p>
                  <p className="mt-1 font-semibold">
                    {formatDate(form.effectiveDate)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {advanceNoticeDays} day
                    {advanceNoticeDays === 1 ? '' : 's'} of advance
                    notice
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase text-gray-500">
                    Student response deadline
                  </p>
                  <p className="mt-1 font-semibold">
                    {formatDate(form.responseDeadline)}
                  </p>
                </div>
              </div>

              {significantIncrease && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                  <AlertTriangle
                    size={20}
                    className="mt-0.5 shrink-0"
                  />

                  <p>
                    This is a {percentageChange.toFixed(1)}% increase.
                    Recheck the figures and make sure the explanation
                    is specific and factual.
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs uppercase text-gray-500">
                  Landlord&apos;s explanation
                </p>

                <p className="mt-2 whitespace-pre-wrap rounded-xl border border-white/10 bg-[#101013] p-4 text-sm leading-6 text-gray-300">
                  {form.reason}
                </p>
              </div>

              <fieldset>
                <legend className="font-semibold">
                  Confirm before publishing
                </legend>

                <div className="mt-3 grid gap-3">
                  {[
                    {
                      key: 'amountsConfirmed',
                      label:
                        'I checked the current rent, proposed rent and calculated change.'
                    },
                    {
                      key: 'dateConfirmed',
                      label:
                        'I checked the exact effective date and student response deadline.'
                    },
                    {
                      key: 'explanationConfirmed',
                      label:
                        'The explanation is accurate, clear and specific to this property.'
                    },
                    {
                      key: 'notificationConfirmed',
                      label:
                        'I understand publishing creates the in-app notices for the current recipient list.'
                    }
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-[#101013] p-4 text-sm text-gray-300"
                    >
                      <input
                        type="checkbox"
                        checked={publishChecklist[item.key]}
                        onChange={(event) =>
                          setPublishChecklist((current) => ({
                            ...current,
                            [item.key]: event.target.checked
                          }))
                        }
                        className="mt-0.5 h-4 w-4 accent-blue-600"
                      />

                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/10 p-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowPreview(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold hover:bg-white/10 disabled:opacity-50"
              >
                Return to editing
              </button>

              <button
                type="button"
                disabled={submitting || !checklistComplete}
                onClick={() => createNotice('published')}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  'Publishing...'
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    Publish notice
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}