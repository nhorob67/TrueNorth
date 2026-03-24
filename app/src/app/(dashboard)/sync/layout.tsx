import { MeetingModeHub } from "./meeting-mode-hub";

export default function SyncLayout({ children }: { children: React.ReactNode }) {
  return <MeetingModeHub>{children}</MeetingModeHub>;
}
