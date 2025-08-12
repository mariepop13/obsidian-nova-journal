export function formatDate(date: Date, format: string): string {
  const yyyy = date.getFullYear().toString();
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  const HH = date.getHours().toString().padStart(2, '0');
  const Min = date.getMinutes().toString().padStart(2, '0');
  return format
    .replace(/YYYY/g, yyyy)
    .replace(/MM/g, mm)
    .replace(/DD/g, dd)
    .replace(/HH/g, HH)
    .replace(/mm/g, Min);
}


