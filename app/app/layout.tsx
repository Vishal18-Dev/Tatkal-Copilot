import { AppShell } from "@/components/app/app-shell";
import { JourneyProvider } from "@/lib/journey";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <JourneyProvider>
      <AppShell>{children}</AppShell>
    </JourneyProvider>
  );
}

