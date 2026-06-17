interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, hasNextPage, onPageChange }: PaginationProps) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-white">
      <p className="text-sm text-gray-600">
        {total === 0 ? 'No results' : `${start}–${end} of ${total}`}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNextPage}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
