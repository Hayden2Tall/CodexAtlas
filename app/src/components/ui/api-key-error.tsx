import Link from "next/link";

interface Props {
  message: string;
  className?: string;
}

/**
 * Renders an AI error message. If the error indicates a missing API key,
 * shows a link to /settings where the user can configure it.
 */
export function ApiKeyError({ message, className = "text-xs text-red-600 dark:text-red-400" }: Props) {
  if (message.includes("No Anthropic API key")) {
    return (
      <span className={className}>
        No Anthropic API key configured.{" "}
        <Link href="/settings" className="underline hover:text-red-800 dark:hover:text-red-300">
          Set it up in Settings
        </Link>
        .
      </span>
    );
  }
  return <span className={className}>{message}</span>;
}
