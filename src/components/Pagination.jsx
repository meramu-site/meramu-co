// Pagination.jsx — Meramu list pagination (React + Tailwind).
//
// Window rule (same logic as the server-rendered pager in api/index.js):
//   [Prev] 1 ... n-1 n n+1 ... last [Next]
//   - At most 6 page numbers on desktop, 5 on mobile (Tailwind sm breakpoint).
//   - First and last pages are always shown; ellipsis only where pages are skipped.
//   - Prev is disabled on page 1, Next on the last page; the active page is
//     bold with the brand accent background.
//   - UI only: this component never changes query logic, page size, or data.

export function getPageItems(current, total, maxVisible = 6) {
  if (total <= 1) return [1];
  if (total <= maxVisible) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  let start = Math.max(2, current - 1);
  let end = Math.min(total - 1, current + 1);
  // Fill the inner slots (first + last take 2 of maxVisible) by expanding
  // toward the nearer edge first.
  while (end - start + 1 < maxVisible - 2) {
    if (start > 2) start -= 1;
    else if (end < total - 1) end += 1;
    else break;
  }
  const items = [1];
  if (start > 2) items.push('…');
  for (let p = start; p <= end; p += 1) items.push(p);
  if (end < total - 1) items.push('…');
  items.push(total);
  return items;
}

function PrevNextButton({ label, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="px-3 py-2 rounded-full border border-neutral-200 text-xs font-semibold text-neutral-700 disabled:opacity-40 dark:border-white/10 dark:text-neutral-300"
    >
      {label}
    </button>
  );
}

function PageNumberButton({ page, current, onPage, accentColor }) {
  const active = page === current;
  return (
    <button
      type="button"
      key={page}
      onClick={() => onPage(page)}
      aria-current={active ? 'page' : undefined}
      style={active && accentColor ? { backgroundColor: accentColor } : undefined}
      className={`w-9 h-9 rounded-full text-xs font-bold ${
        active
          ? 'text-white'
          : 'border border-neutral-200 text-neutral-700 dark:border-white/10 dark:text-neutral-300'
      }`}
    >
      {page}
    </button>
  );
}

function PageRow({ items, current, onPage, prevLabel, nextLabel, accentColor }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <PrevNextButton
        label={prevLabel}
        disabled={current === 1}
        onClick={() => onPage(current - 1)}
      />
      {items.map((it, i) =>
        typeof it === 'number' ? (
          <PageNumberButton
            key={it}
            page={it}
            current={current}
            onPage={onPage}
            accentColor={accentColor}
          />
        ) : (
          <span
            key={`gap-${i}`}
            aria-hidden="true"
            className="w-9 h-9 inline-flex items-center justify-center text-xs text-neutral-400"
          >
            …
          </span>
        ),
      )}
      <PrevNextButton
        label={nextLabel}
        disabled={current >= items[items.length - 1]}
        onClick={() => onPage(current + 1)}
      />
    </div>
  );
}

export default function Pagination({
  current,
  total,
  onPage,
  prevLabel = 'Sebelumnya',
  nextLabel = 'Selanjutnya',
  accentColor,
}) {
  if (total <= 1) return null;
  const desktopItems = getPageItems(current, total, 6);
  const mobileItems = getPageItems(current, total, 5);
  return (
    <nav aria-label="Pagination" className="mt-8">
      {/* Desktop: up to 6 numbers. */}
      <div className="hidden sm:block">
        <PageRow
          items={desktopItems}
          current={current}
          onPage={onPage}
          prevLabel={prevLabel}
          nextLabel={nextLabel}
          accentColor={accentColor}
        />
      </div>
      {/* Mobile: 3–5 numbers. */}
      <div className="block sm:hidden">
        <PageRow
          items={mobileItems}
          current={current}
          onPage={onPage}
          prevLabel={prevLabel}
          nextLabel={nextLabel}
          accentColor={accentColor}
        />
      </div>
    </nav>
  );
}
