import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export default function PageHeader({ title, back, right }: { title: ReactNode; back?: string; right?: ReactNode }) {
  return (
    <header className="flex items-center gap-2 mb-4">
      {back && (
        <Link to={back} className="-ml-1 grid h-9 w-9 place-items-center rounded-full text-zinc-300 hover:bg-night-800" aria-label="Back">
          ‹
        </Link>
      )}
      <h1 className="text-2xl font-extrabold tracking-tight flex-1 min-w-0 truncate">{title}</h1>
      {right}
    </header>
  );
}
