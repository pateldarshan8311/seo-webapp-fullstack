const PAGE_REVIEW_STATUSES = ["critical", "warning", "healthy"];
const PAGE_REVIEW_STATUS_ALIASES = {
  needs_attention: "warning",
  normal: "healthy",
};

function sanitizePageUpdate(payload = {}) {
  const update = {};
  const rawStatus = String(payload.reviewStatus || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const normalizedStatus = PAGE_REVIEW_STATUS_ALIASES[rawStatus] || rawStatus;

  if (PAGE_REVIEW_STATUSES.includes(normalizedStatus)) {
    update.reviewStatus = normalizedStatus;
  }

  return update;
}

module.exports = {
  PAGE_REVIEW_STATUSES,
  sanitizePageUpdate,
};
