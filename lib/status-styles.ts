// Centralized status-pill colors so every tab reads the same visual language.
// Semantic red/green are kept for danger/success; blue (primary) and gold mark the
// brand's "in progress" and "elevated/owner" states respectively.

export const EVENT_STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  PLANNING: "bg-primary-100 text-primary-700",
  ACTIVE: "bg-gold-100 text-gold-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export const TASK_STATUS_STYLES: Record<string, string> = {
  TODO: "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-primary-100 text-primary-700",
  BLOCKED: "bg-red-100 text-red-700",
  DONE: "bg-green-100 text-green-700",
};

export const PAYMENT_STATUS_STYLES: Record<string, string> = {
  UNPAID: "bg-gray-100 text-gray-600",
  PENDING: "bg-gold-100 text-gold-700",
  PAID: "bg-green-100 text-green-700",
  REFUNDED: "bg-red-100 text-red-700",
};

export const TEAM_ROLE_STYLES: Record<string, string> = {
  ADMIN: "bg-gold-100 text-gold-700",
  ORGANIZER: "bg-primary-100 text-primary-700",
  STAFF: "bg-gray-100 text-gray-600",
};
