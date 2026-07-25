interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-10 text-center text-[length:var(--text-sm)] text-[var(--color-muted)]">
      {message}
    </div>
  );
}
