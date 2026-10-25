// Legacy dates are calendar dates stored as UTC midnight, so format in UTC to avoid off-by-one days.
const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}
