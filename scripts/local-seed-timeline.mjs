export function buildSeedTimeline(seedDate) {
  const now = seedDate.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const isoBefore = (duration) => new Date(now - duration).toISOString();

  return {
    now: new Date(now).toISOString(),
    workspaceCreated: isoBefore(30 * day),
    projectReceived: isoBefore(2 * hour),
    projectReply: isoBefore(hour),
    invoiceReceived: isoBefore(26 * hour),
    invoiceStarred: isoBefore(26 * hour - 5 * minute),
    salesReceived: isoBefore(50 * hour),
    salesRead: isoBefore(50 * hour - 5 * minute),
    salesArchived: isoBefore(50 * hour - 10 * minute),
    draftCreated: isoBefore(30 * minute),
    draftUpdated: isoBefore(10 * minute)
  };
}
