import type { KpiIconKey } from "@/types/database";

export const KPI_ICONS: readonly { key: KpiIconKey; label: string; path: string; viewBox: string }[] = [
  {
    key: "dollar-sign",
    label: "Revenue",
    viewBox: "0 0 320 512",
    path: "M160 0c17.7 0 32 14.3 32 32l0 35.7c1.6 .2 3.1 .4 4.7 .7c.4 .1 .7 .1 1.1 .2l48 8.8c17.4 3.2 28.9 19.9 25.7 37.2s-19.9 28.9-37.2 25.7l-47.5-8.7c-31.3-4.6-58.9-1.5-78.3 6.2s-27.2 18.3-29 28.1c-2 10.7-.5 16.7 1.2 20.4c1.8 3.9 5.5 8.3 12.8 13.2c16.3 10.7 41.3 17.7 73.7 26.3l2.9 .8c28.6 7.6 63.6 16.8 89.6 33.8c14.2 9.3 27.6 21.9 35.9 39.5c8.5 17.9 10.3 37.9 6.4 59.2c-6.9 38-33.1 63.4-65.6 76.7c-13.7 5.6-28.6 9.2-44.4 11l0 33.4c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-34.9c-.4-.1-.9-.1-1.3-.2l-.2 0s0 0 0 0c-24.4-3.8-64.5-14.3-91.5-26.3c-16.2-7.2-23.4-26.1-16.2-42.2s26.1-23.4 42.2-16.2c20.9 9.3 55.3 18.5 75.2 21.6c31.9 4.7 58.2 2 76-5.3c16.9-6.9 24.6-16.9 26.8-28.9c1.9-10.6 .4-16.7-1.3-20.4c-1.9-4-5.6-8.4-13-13.3c-16.4-10.7-41.5-17.7-74-26.3l-2.8-.7c-28.5-7.6-63.5-16.8-89.4-33.9c-14.3-9.4-27.5-22.1-35.7-39.7c-8.4-18.1-10.2-38.1-6.2-59.6C20.4 96 47 70.2 79.9 57.2C93.3 51.8 107.9 48.2 123.1 46.3c.8-.1 1.6-.2 2.4-.3l2.6-.3L128 32c0-17.7 14.3-32 32-32z",
  },
  {
    key: "comment",
    label: "Engagement",
    viewBox: "0 0 512 512",
    path: "M512 240c0 114.9-114.6 208-256 208c-37.1 0-72.3-6.4-104.1-17.9c-11.9 8.7-31.3 20.6-54.3 30.6C73.6 471.1 44.7 480 16 480c-6.5 0-12.3-3.9-14.8-9.9c-2.5-6-1.1-12.8 3.4-17.4c0 0 0 0 0 0s0 0 0 0s0 0 0 0c0 0 0 0 0 0l.3-.3c.3-.3 .7-.7 1.3-1.4c1.1-1.2 2.8-3.1 4.9-5.7c4.1-5 9.6-12.4 15.2-21.6c10-16.6 19.5-38.4 21.4-62.9C17.7 326.8 0 285.1 0 240C0 125.1 114.6 32 256 32s256 93.1 256 208z",
  },
  {
    key: "envelope",
    label: "Email",
    viewBox: "0 0 512 512",
    path: "M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48L48 64zM0 176L0 384c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-208L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z",
  },
  {
    key: "rectangle-ad",
    label: "Ads",
    viewBox: "0 0 576 512",
    path: "M64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l448 0c35.3 0 64-28.7 64-64l0-320c0-35.3-28.7-64-64-64L64 32zM229.5 173.3l72 144c5.9 11.9 1.1 26.3-10.7 32.2s-26.3 1.1-32.2-10.7L253.2 328l-90.3 0-5.4 10.7c-5.9 11.9-20.3 16.7-32.2 10.7s-16.7-20.3-10.7-32.2l72-144c4.1-8.1 12.4-13.3 21.5-13.3s17.4 5.1 21.5 13.3zM208 245.1L187.8 288l40.4 0L208 245.1zM432 176c26.5 0 48 21.5 48 48l0 64c0 26.5-21.5 48-48 48l-48 0c-8.8 0-16-7.2-16-16l0-128c0-8.8 7.2-16 16-16l48 0zm0 48l-32 0 0 64 32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16z",
  },
] as const;

const healthColors: Record<string, string> = {
  green: "var(--color-semantic-green)",
  yellow: "var(--color-semantic-ochre)",
  red: "var(--color-semantic-brick)",
};

export function KpiIconBadge({
  iconKey,
  healthStatus,
}: {
  iconKey: string | null;
  healthStatus: "green" | "yellow" | "red";
}) {
  if (!iconKey) return null;

  const icon = KPI_ICONS.find((i) => i.key === iconKey);
  if (!icon) return null;

  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
      style={{
        backgroundColor: `color-mix(in srgb, ${healthColors[healthStatus]} 15%, transparent)`,
      }}
    >
      <svg
        className="w-3.5 h-3.5 text-subtle"
        viewBox={icon.viewBox}
        fill="currentColor"
        aria-hidden="true"
      >
        <path d={icon.path} />
      </svg>
    </div>
  );
}
