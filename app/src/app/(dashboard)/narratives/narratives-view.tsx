"use client";

import { useState, useCallback, useMemo } from "react";
import DOMPurify from "dompurify";
import { NarrativeType } from "@/types/database";

interface NarrativeTemplate {
  type: NarrativeType;
  label: string;
  description: string;
  defaultWindowDays: number;
}

interface NarrativeHistoryItem {
  id: string;
  narrative_type: string;
  title: string;
  confidence: string;
  generated_by: string;
  created_at: string;
  time_window_start: string;
  time_window_end: string;
}

interface VentureOption {
  id: string;
  name: string;
}

interface NarrativesViewProps {
  history: NarrativeHistoryItem[];
  templates: NarrativeTemplate[];
  ventureId: string;
  ventures: VentureOption[];
  isSingleVenture: boolean;
}

type DatePreset = "7" | "30" | "90" | "custom";

interface ParsedSection {
  title: string;
  html: string;
}

const confidenceColors: Record<string, string> = {
  high: "text-semantic-green bg-semantic-green/10",
  medium: "text-semantic-ochre bg-semantic-ochre/10",
  low: "text-semantic-brick bg-semantic-brick/10",
};

const templateIcons: Record<string, string> = {
  weekly_team_update: "\u{1F4E8}",
  monthly_board_memo: "\u{1F4CB}",
  investor_update: "\u{1F4C8}",
  all_hands_talking_points: "\u{1F399}",
  quarterly_retrospective: "\u{1F50D}",
};

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ["h1", "h2", "h3", "h4", "p", "ul", "ol", "li", "strong", "em", "br", "table", "thead", "tbody", "tr", "th", "td", "a", "span", "div"],
  ALLOWED_ATTR: ["href", "class", "target", "rel"],
};

function formatDateForInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

function parseSections(html: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const parts = html.split(/(?=<h2[\s>])/i);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const titleMatch = trimmed.match(/<h2[^>]*>(.*?)<\/h2>/i);
    if (titleMatch) {
      sections.push({
        title: titleMatch[1].replace(/<[^>]*>/g, "").trim(),
        html: trimmed,
      });
    } else {
      // Content before the first h2 (preamble)
      sections.push({
        title: "__preamble__",
        html: trimmed,
      });
    }
  }

  return sections;
}

export function NarrativesView({
  history,
  templates,
  ventureId,
  ventures,
  isSingleVenture,
}: NarrativesViewProps) {
  const [selectedType, setSelectedType] = useState<NarrativeType | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [generatedTitle, setGeneratedTitle] = useState<string | null>(null);
  const [generatedConfidence, setGeneratedConfidence] = useState<string | null>(null);
  const [additionalContext, setAdditionalContext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [narrativeHistory, setNarrativeHistory] = useState(history);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  // Date range state
  const [datePreset, setDatePreset] = useState<DatePreset>("30");
  const [customStartDate, setCustomStartDate] = useState(
    formatDateForInput(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
  );
  const [customEndDate, setCustomEndDate] = useState(
    formatDateForInput(new Date())
  );

  // Venture scope state
  const [selectedVentureId, setSelectedVentureId] = useState<string | null>(ventureId);

  // Per-section regeneration state
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [sectionGuidance, setSectionGuidance] = useState<Record<string, string>>({});
  const [expandedGuidance, setExpandedGuidance] = useState<string | null>(null);

  // Save as content piece state
  const [savingAsContent, setSavingAsContent] = useState(false);
  const [savedContentId, setSavedContentId] = useState<string | null>(null);

  const computedDates = useMemo(() => {
    if (datePreset === "custom") {
      return {
        startDate: new Date(customStartDate).toISOString(),
        endDate: new Date(customEndDate).toISOString(),
      };
    }
    const days = parseInt(datePreset, 10);
    return {
      startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString(),
    };
  }, [datePreset, customStartDate, customEndDate]);

  const sanitizedHtml = useMemo(() => {
    if (!generatedHtml) return "";
    return sanitize(generatedHtml);
  }, [generatedHtml]);

  const parsedSections = useMemo(() => {
    if (!sanitizedHtml) return [];
    return parseSections(sanitizedHtml);
  }, [sanitizedHtml]);

  const handleGenerate = useCallback(async (type: NarrativeType) => {
    setGenerating(true);
    setError(null);
    setGeneratedHtml(null);
    setSelectedType(type);
    setSavedContentId(null);

    try {
      const res = await fetch("/api/narratives/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          narrativeType: type,
          startDate: computedDates.startDate,
          endDate: computedDates.endDate,
          ventureId: selectedVentureId ?? undefined,
          additionalContext: additionalContext.trim() || undefined,
          save: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Generation failed");
      }

      const data = await res.json();
      setGeneratedHtml(data.html);
      setGeneratedTitle(data.title);
      setGeneratedConfidence(data.confidence);

      // Refresh history
      const histRes = await fetch("/api/narratives/history");
      if (histRes.ok) {
        const histData = await histRes.json();
        setNarrativeHistory(histData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate narrative");
    } finally {
      setGenerating(false);
    }
  }, [computedDates, selectedVentureId, additionalContext]);

  const handleRegenerateSection = useCallback(async (sectionTitle: string) => {
    if (!selectedType || !generatedHtml) return;

    setRegeneratingSection(sectionTitle);
    const guidance = sectionGuidance[sectionTitle] || "";

    try {
      const res = await fetch("/api/narratives/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          narrativeType: selectedType,
          startDate: computedDates.startDate,
          endDate: computedDates.endDate,
          ventureId: selectedVentureId ?? undefined,
          additionalContext: `Please regenerate only the section titled '${sectionTitle}'. ${guidance}`.trim(),
          save: false,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Regeneration failed");
      }

      const data = await res.json();
      const newSections = parseSections(sanitize(data.html));

      // Find the matching section in the new output
      const replacementSection = newSections.find(
        (s) => s.title.toLowerCase() === sectionTitle.toLowerCase()
      );

      if (replacementSection) {
        // Replace that section in the current HTML
        const currentSections = parseSections(sanitizedHtml);
        const updatedSections = currentSections.map((s) =>
          s.title.toLowerCase() === sectionTitle.toLowerCase()
            ? replacementSection
            : s
        );
        const updatedHtml = updatedSections.map((s) => s.html).join("\n");
        setGeneratedHtml(updatedHtml);
      }

      setExpandedGuidance(null);
      setSectionGuidance((prev) => ({ ...prev, [sectionTitle]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate section");
    } finally {
      setRegeneratingSection(null);
    }
  }, [selectedType, generatedHtml, sanitizedHtml, computedDates, selectedVentureId, sectionGuidance]);

  const handleSaveAsContent = useCallback(async () => {
    if (!sanitizedHtml || !generatedTitle || !selectedType) return;

    setSavingAsContent(true);
    setError(null);

    try {
      const res = await fetch("/api/narratives/save-as-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: generatedTitle,
          bodyHtml: sanitizedHtml,
          narrativeType: selectedType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save as content piece");
      }

      const data = await res.json();
      setSavedContentId(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save as content piece");
    } finally {
      setSavingAsContent(false);
    }
  }, [sanitizedHtml, generatedTitle, selectedType]);

  const copyToClipboard = useCallback(async (format: "html" | "text") => {
    if (!generatedHtml) return;
    try {
      if (format === "html") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([sanitizedHtml], { type: "text/html" }),
            "text/plain": new Blob([sanitizedHtml.replace(/<[^>]*>/g, "")], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(sanitizedHtml.replace(/<[^>]*>/g, ""));
      }
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch {
      const text = format === "html" ? sanitizedHtml : sanitizedHtml.replace(/<[^>]*>/g, "");
      await navigator.clipboard.writeText(text);
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 2000);
    }
  }, [generatedHtml, sanitizedHtml]);

  // Renders sanitized HTML in a section card; content is sanitized via DOMPurify above
  const renderSectionContent = (sectionHtml: string) => (
    <div
      className="px-8 py-6 prose prose-sm max-w-none text-ink
        [&_h2]:text-accent [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-3
        [&_h3]:text-ink [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2
        [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-ink [&_p]:mb-3
        [&_ul]:text-sm [&_li]:text-ink [&_li]:mb-1
        [&_strong]:text-ink [&_strong]:font-semibold
        [&_table]:text-xs [&_th]:bg-canvas [&_th]:p-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-ink [&_th]:border-b [&_th]:border-line
        [&_td]:p-2 [&_td]:border-b [&_td]:border-line/50"
      dangerouslySetInnerHTML={{ __html: sectionHtml }}
    />
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] text-ink">Narrative Studio</h1>
        <p className="text-sm text-subtle mt-1">
          Auto-generate polished updates from your operational data.
        </p>
      </div>

      {/* Date Range & Venture Scope */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Date Range Picker */}
        <div className="bg-surface border border-line rounded-xl p-5">
          <label className="block text-sm font-medium text-ink mb-3">
            Date Range
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {(
              [
                { value: "7", label: "Last 7 days" },
                { value: "30", label: "Last 30 days" },
                { value: "90", label: "Last 90 days" },
                { value: "custom", label: "Custom" },
              ] as { value: DatePreset; label: string }[]
            ).map((preset) => (
              <button
                key={preset.value}
                onClick={() => setDatePreset(preset.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  datePreset === preset.value
                    ? "bg-cta text-white"
                    : "bg-canvas border border-line text-ink hover:bg-line/30"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {datePreset === "custom" && (
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1">
                <label className="block text-xs text-subtle mb-1">Start</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent-glow/30 focus:border-accent"
                />
              </div>
              <span className="text-subtle mt-5">to</span>
              <div className="flex-1">
                <label className="block text-xs text-subtle mb-1">End</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent-glow/30 focus:border-accent"
                />
              </div>
            </div>
          )}
        </div>

        {/* Venture Scope Selector */}
        {!isSingleVenture && ventures.length > 1 && (
          <div className="bg-surface border border-line rounded-xl p-5">
            <label className="block text-sm font-medium text-ink mb-3">
              Venture Scope
            </label>
            <select
              value={selectedVentureId ?? "__all__"}
              onChange={(e) =>
                setSelectedVentureId(
                  e.target.value === "__all__" ? null : e.target.value
                )
              }
              className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent-glow/30 focus:border-accent"
            >
              <option value="__all__">All ventures</option>
              {ventures.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-subtle mt-2">
              Choose which venture data to include in the narrative.
            </p>
          </div>
        )}
      </div>

      {/* Template Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <button
            key={template.type}
            onClick={() => handleGenerate(template.type)}
            disabled={generating}
            className={`text-left bg-surface border rounded-xl p-5 transition-all hover:shadow-md disabled:opacity-50 ${
              selectedType === template.type && generating
                ? "border-accent ring-2 ring-accent/20"
                : "border-line hover:border-accent/50"
            }`}
          >
            <div className="flex items-start justify-between">
              <span className="text-2xl">{templateIcons[template.type] ?? "\u{1F4DD}"}</span>
              {selectedType === template.type && generating && (
                <span className="w-5 h-5 border-2 border-accent/30 border-t-clay rounded-full animate-spin" />
              )}
            </div>
            <h3 className="text-sm font-semibold text-ink mt-3">{template.label}</h3>
            <p className="text-xs text-subtle mt-1 leading-relaxed">{template.description}</p>
            <p className="text-xs text-subtle mt-2 font-mono">
              Default: {template.defaultWindowDays} days
            </p>
          </button>
        ))}
      </div>

      {/* Additional Context Input */}
      <div className="bg-surface border border-line rounded-xl p-5">
        <label className="block text-sm font-medium text-ink mb-2">
          Additional Context (optional)
        </label>
        <textarea
          value={additionalContext}
          onChange={(e) => setAdditionalContext(e.target.value)}
          placeholder="Add context the AI should know — e.g., 'We launched a new product this week' or 'Focus on the content machine performance'"
          className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-sm text-ink placeholder:text-subtle/60 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-accent-glow/30 focus:border-accent"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-semantic-brick/10 border border-semantic-brick/20 rounded-xl p-4">
          <p className="text-sm text-semantic-brick">{error}</p>
        </div>
      )}

      {/* Generated Narrative — Per-Section View */}
      {sanitizedHtml && parsedSections.length > 0 && (
        <div className="space-y-4">
          {/* Header bar */}
          <div className="bg-surface border border-line rounded-xl px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-ink">{generatedTitle}</h2>
                {generatedConfidence && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${confidenceColors[generatedConfidence] ?? ""}`}>
                    {generatedConfidence} confidence
                  </span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                <button
                  onClick={() => copyToClipboard("html")}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-canvas border border-line text-ink hover:bg-line/30 transition-colors"
                >
                  {copiedFormat === "html" ? "Copied!" : "Copy HTML"}
                </button>
                <button
                  onClick={() => copyToClipboard("text")}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-canvas border border-line text-ink hover:bg-line/30 transition-colors"
                >
                  {copiedFormat === "text" ? "Copied!" : "Copy Text"}
                </button>
                <button
                  onClick={handleSaveAsContent}
                  disabled={savingAsContent || !!savedContentId}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-cta text-white hover:bg-cta-hover transition-colors disabled:opacity-50"
                >
                  {savedContentId
                    ? "Saved!"
                    : savingAsContent
                    ? "Saving..."
                    : "Save as Content Piece"}
                </button>
              </div>
            </div>
            {savedContentId && (
              <div className="mt-3 text-sm text-semantic-green">
                Content piece created.{" "}
                <a
                  href={`/content/${savedContentId}`}
                  className="underline font-medium hover:text-semantic-green/80"
                >
                  Open in editor
                </a>
              </div>
            )}
          </div>

          {/* Per-Section Cards */}
          {parsedSections.map((section) => (
            <div
              key={section.title}
              className="bg-surface border border-line rounded-xl overflow-hidden"
            >
              {section.title !== "__preamble__" && (
                <div className="flex items-center justify-between px-6 py-3 border-b border-line bg-canvas/50">
                  <h3 className="text-sm font-semibold text-accent">{section.title}</h3>
                  <div className="flex items-center gap-2">
                    {expandedGuidance === section.title && (
                      <button
                        onClick={() => setExpandedGuidance(null)}
                        className="px-2 py-1 rounded text-xs text-subtle hover:text-ink transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (expandedGuidance === section.title) {
                          handleRegenerateSection(section.title);
                        } else {
                          setExpandedGuidance(section.title);
                        }
                      }}
                      disabled={regeneratingSection === section.title}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-canvas border border-line text-ink hover:bg-line/30 transition-colors disabled:opacity-50"
                    >
                      {regeneratingSection === section.title ? (
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 border-2 border-accent/30 border-t-clay rounded-full animate-spin" />
                          Regenerating...
                        </span>
                      ) : expandedGuidance === section.title ? (
                        "Regenerate"
                      ) : (
                        "Regenerate Section"
                      )}
                    </button>
                  </div>
                </div>
              )}
              {expandedGuidance === section.title && (
                <div className="px-6 py-3 border-b border-line bg-canvas/30">
                  <input
                    type="text"
                    value={sectionGuidance[section.title] || ""}
                    onChange={(e) =>
                      setSectionGuidance((prev) => ({
                        ...prev,
                        [section.title]: e.target.value,
                      }))
                    }
                    placeholder="Optional guidance — e.g., 'Make it more concise' or 'Add more metrics'"
                    className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-sm text-ink placeholder:text-subtle/60 focus:outline-none focus:ring-2 focus:ring-accent-glow/30 focus:border-accent"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleRegenerateSection(section.title);
                      }
                    }}
                  />
                  <p className="text-xs text-subtle mt-1">
                    Press Enter or click Regenerate to update this section.
                  </p>
                </div>
              )}
              {renderSectionContent(section.html)}
            </div>
          ))}
        </div>
      )}

      {/* History */}
      {narrativeHistory.length > 0 && (
        <div>
          <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-ink mb-4">Past Narratives</h2>
          <div className="space-y-2">
            {narrativeHistory.map((item) => {
              const template = templates.find((t) => t.type === item.narrative_type);
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-surface border border-line rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {templateIcons[item.narrative_type] ?? "\u{1F4DD}"}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-ink">{item.title}</p>
                      <p className="text-xs text-subtle">
                        {template?.label ?? item.narrative_type} &middot;{" "}
                        {new Date(item.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${confidenceColors[item.confidence] ?? ""}`}>
                    {item.confidence}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
