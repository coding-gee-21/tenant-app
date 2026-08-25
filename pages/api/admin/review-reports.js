import { supabaseAdmin } from "../../../lib/supabaseServer";

async function getAdminUser(req) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;

  if (!token) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  const allowedEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (allowedEmails.includes(user.email?.toLowerCase())) {
    return user;
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.role === "admin" ? user : null;
}

export default async function handler(req, res) {
  const admin = await getAdminUser(req);

  if (!admin) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const status = String(req.query.status || "pending");

    let query = supabaseAdmin
      .from("review_reports")
      .select(`
        id,
        review_id,
        reporter_id,
        reason,
        status,
        created_at,
        reviewed_at,
        reviewed_by,
        reviews (
          id,
          property_id,
          user_id,
          title,
          comment,
          rating,
          image_url,
          status,
          moderation_reason,
          moderated_at,
          created_at,
          properties (
            id,
            title,
            landmark
          ),
          profiles (
            full_name,
            phone_verified,
            student_verified
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Review report loading error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ reports: data || [] });
  }

  if (req.method === "PATCH") {
    const { reportId, reviewId, action, reason } = req.body || {};

    if (!reportId || !reviewId || !action) {
      return res.status(400).json({
        error: "reportId, reviewId and action are required.",
      });
    }

    const allowedActions = ["dismiss", "hide", "restore", "delete"];

    if (!allowedActions.includes(action)) {
      return res.status(400).json({ error: "Invalid moderation action." });
    }

    if (action === "hide" && (!reason || reason.trim().length < 5)) {
      return res.status(400).json({
        error: "Enter a short reason explaining why the review is being hidden.",
      });
    }

    if (action === "delete") {
      const { error } = await supabaseAdmin
        .from("reviews")
        .delete()
        .eq("id", reviewId);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true });
    }

    if (action === "hide") {
      const { error: reviewError } = await supabaseAdmin
        .from("reviews")
        .update({
          status: "rejected",
          moderation_reason: reason.trim(),
          moderated_at: new Date().toISOString(),
          moderated_by: admin.id,
        })
        .eq("id", reviewId);

      if (reviewError) {
        return res.status(500).json({ error: reviewError.message });
      }
    }

    if (action === "restore") {
      const { error: reviewError } = await supabaseAdmin
        .from("reviews")
        .update({
          status: "approved",
          moderation_reason: null,
          moderated_at: new Date().toISOString(),
          moderated_by: admin.id,
        })
        .eq("id", reviewId);

      if (reviewError) {
        return res.status(500).json({ error: reviewError.message });
      }
    }

    const reportStatus =
      action === "dismiss" ? "dismissed" : "actioned";

    const { error: reportError } = await supabaseAdmin
      .from("review_reports")
      .update({
        status: reportStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: admin.id,
      })
      .eq("id", reportId);

    if (reportError) {
      return res.status(500).json({ error: reportError.message });
    }

    return res.status(200).json({ success: true });
  }

  res.setHeader("Allow", ["GET", "PATCH"]);
  return res.status(405).json({ error: "Method not allowed" });
}
