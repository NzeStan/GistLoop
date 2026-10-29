import { type ReactNode, useRef } from "react";

import { IMAGE_ACCEPT, checkImage } from "@/api/upload";

import { Button } from "./Button";
import { useToast } from "./Toast";

interface FilePickerProps {
  /** Called with each picked file that passes the type and size checks. */
  onPick: (files: File[]) => void;
  children: ReactNode;
  multiple?: boolean;
  maxMb?: number;
  accept?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  leading?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  /** Accessible name when the visible label is only an icon. */
  label?: string;
}

/** A button that opens the file chooser. Images are checked before anything is uploaded. */
export function FilePicker({
  onPick,
  children,
  multiple,
  maxMb = 5,
  accept = IMAGE_ACCEPT,
  variant = "secondary",
  size,
  leading,
  loading,
  disabled,
  label,
}: FilePickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const onChange = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (input.current) input.current.value = ""; // Picking the same file again still fires.
    const ok: File[] = [];
    for (const file of picked) {
      const problem = accept === IMAGE_ACCEPT ? checkImage(file, maxMb) : null;
      if (problem) toast.error(`${file.name}: ${problem}`);
      else ok.push(file);
    }
    if (ok.length) onPick(ok);
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        tabIndex={-1}
        onChange={(event) => onChange(event.target.files)}
      />
      <Button
        type="button"
        variant={variant}
        size={size}
        leading={leading}
        loading={loading}
        disabled={disabled}
        aria-label={label}
        onClick={() => input.current?.click()}
      >
        {children}
      </Button>
    </>
  );
}
