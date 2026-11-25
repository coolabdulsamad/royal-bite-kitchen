import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Two-step destructive action: first click arms the button (turns into a
 * "Confirm?" prompt for 3 seconds), second click fires the action.
 */
export function ArmButton({
  children,
  confirmLabel = "Confirm?",
  onConfirm,
  className = "",
  armedClassName = "",
  title,
  disabled,
}: {
  children: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
  armedClassName?: string;
  title?: string;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <button
      type="button"
      title={armed ? undefined : title}
      disabled={disabled}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 3000);
          return;
        }
        if (timer.current) clearTimeout(timer.current);
        setArmed(false);
        onConfirm();
      }}
      className={armed ? `${armedClassName || className} whitespace-nowrap` : className}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
