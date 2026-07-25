interface ErrorMessageProps {
  message: string;
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className="p-4 text-center text-[length:var(--text-sm)] font-medium text-[var(--color-danger)]"
    >
      {message}
    </div>
  );
}
