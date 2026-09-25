// Centralized status-pill colors so every tab reads the same visual language.
// Semantic red/green are kept for danger/success; blue (primary) and gold mark the
// brand's "in progress" and "elevated/owner" states respectively.

export const TEAM_ROLE_STYLES: Record<string, string> = {
  ADMIN: "bg-gold-100 text-gold-700",
  ORGANIZER: "bg-primary-100 text-primary-700",
  STAFF: "bg-gray-100 text-gray-600",
};
