import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { type ThemeChoice, useTheme } from "@/lib/theme";

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<ThemeChoice, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };
const ICON = { system: Monitor, light: Sun, dark: Moon };

export function ThemeToggle() {
  const { choice, setChoice } = useTheme();
  const Icon = ICON[choice];
  return (
    <Button
      variant="ghost"
      icon
      onClick={() => setChoice(NEXT[choice])}
      aria-label={`${LABEL[choice]} (switch to ${LABEL[NEXT[choice]].toLowerCase()})`}
      title={LABEL[choice]}
    >
      <Icon size={18} />
    </Button>
  );
}
