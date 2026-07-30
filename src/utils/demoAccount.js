export const demoAccountConfigured = Boolean(
  String(import.meta.env.VITE_DEMO_ACCOUNT_EMAIL || "").trim()
  && String(import.meta.env.VITE_DEMO_ACCOUNT_PASSWORD || "").trim(),
);

export function getDemoCredentials() {
  return {
    email: String(import.meta.env.VITE_DEMO_ACCOUNT_EMAIL || "").trim(),
    password: String(import.meta.env.VITE_DEMO_ACCOUNT_PASSWORD || "").trim(),
  };
}

export function isDemoUser(user) {
  const email = String(user?.email || "").trim().toLowerCase();
  const demoEmail = String(import.meta.env.VITE_DEMO_ACCOUNT_EMAIL || "").trim().toLowerCase();
  return Boolean(email && demoEmail && email === demoEmail);
}
