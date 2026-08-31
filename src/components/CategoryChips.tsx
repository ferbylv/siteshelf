import { CATEGORIES, UNCATEGORIZED, type Category } from '../lib/types';

export function CategoryChips({
  value,
  onChange,
  includeAll,
  includeUncategorized = true,
}: {
  value: string;
  onChange: (next: string) => void;
  includeAll?: boolean;
  includeUncategorized?: boolean;
}) {
  const options: string[] = [
    ...(includeAll ? ['全部'] : []),
    ...CATEGORIES,
    ...(includeUncategorized ? [UNCATEGORIZED] : []),
  ];

  return (
    <div className="chips" role="listbox" aria-label="分类">
      {options.map((item) => (
        <button
          key={item}
          type="button"
          className={`chip ${value === item ? 'chip-active' : ''}`}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

export function CategoryBadge({ category }: { category: Category }) {
  return <span className="chip chip-plain">{category}</span>;
}
