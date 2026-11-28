import { useToast } from "./Toast";

/** Copy text to the clipboard with a toast. */
export function useCopy() {
  const toast = useToast();
  return async (text: string, done = "Copied") => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(done);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it yourself.");
    }
  };
}
