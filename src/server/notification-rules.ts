/** Pure notification rules (no database access), shared by the service and tests. */
export const notificationCategories = {
  ACCOUNT: { label: "Account and security", required: true },
  ORGANISATION: { label: "Organisation invitations and membership", required: false },
  PROPOSAL: { label: "Invitations, proposals, and counteroffers", required: false },
  AGREEMENT: { label: "Agreements and change requests", required: false },
  MESSAGE: { label: "Project messages", required: false },
  TASK: { label: "Task assignments and deadlines", required: false },
  MILESTONE: { label: "Milestone submissions, reviews, and settlements", required: false },
  DISPUTE: { label: "Disputes", required: true },
  PAYMENT: { label: "Payment and compensation status", required: true },
  CAMPAIGN: { label: "Campaign invitations, content, and performance", required: false },
  TRUST: { label: "Verification, assessments, and appeals", required: false },
  GENERAL: { label: "Other platform updates", required: false },
} as const;

export type NotificationCategory = keyof typeof notificationCategories;
export type PreferenceRow = { category: string; inApp: boolean; email: boolean };

/**
 * Decides whether a channel is enabled. Required categories always stay in-app so
 * security, dispute, and payment records cannot be silenced; email is opt-in.
 */
export function channelEnabled(preferences: PreferenceRow[], category: NotificationCategory, channel: "inApp" | "email") {
  const row = preferences.find((item) => item.category === category);
  if (channel === "inApp") return notificationCategories[category].required || (row?.inApp ?? true);
  return row?.email ?? false;
}

/** Payment emails based on simulated records must say so. */
export function labelSimulated(title: string, simulated: boolean) {
  return simulated && !/simulated/i.test(title) ? `[Simulated] ${title}` : title;
}
