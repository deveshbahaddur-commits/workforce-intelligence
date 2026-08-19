/**
 * Business Partners: fixed like the admin allowlist, but scoped rather than
 * all-or-nothing — a BP can build KRAs for anyone whose HRIS "Function"
 * (Employee.team) is in their list, regardless of reporting line.
 *
 * Function names here are the exact values in the live HRIS sheet's
 * "Function" column, confirmed against the actual data (some of the org's
 * own naming — e.g. "Finance & Legal", "Onboarding & Collection" — doesn't
 * match the sheet verbatim: "Finance and Legal", "Onboarding and
 * Collections"). "Anubhuti Welfare Foundation" isn't a Function value at
 * all — it's a business entity whose employees are split across the
 * project-named Functions "Mondelez Project", "ITC WOW", "JSW Project", so
 * it's expanded to those three here. "DRS-Goa" has no location split in the
 * Function column, so per the org's call, it's treated as all of plain
 * "DRS" (as opposed to the separate "Central DRS" Function).
 */
export const BP_FUNCTIONS: Record<string, string[]> = {
  "devesh.bahaddur@recykal.com": [
    "EPR",
    "AFR",
    "Mondelez Project",
    "ITC WOW",
    "JSW Project",
    "Operations",
    "Strategy",
    "Compliance",
    "Facility Management",
    "Finance and Legal",
    "Marketing",
    "People and Culture",
    "Central DRS",
  ],
  "ravalika.g@recykal.com": ["Recommerce", "Infra Business"],
  "shaminn.santiago@recykal.com": ["Retearn", "Technology"],
  "shreya.gupta@recykal.com": ["DRS"],
  "sravani.ravuru@recykal.com": ["Marketplace", "Onboarding and Collections"],
};

export function getBpFunctions(email: string): string[] {
  return BP_FUNCTIONS[email.toLowerCase()] ?? [];
}
