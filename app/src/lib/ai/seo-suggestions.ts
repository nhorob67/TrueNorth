// ============================================================
// SEO Optimization Suggestions
//
// PRD Section 3.5: AI-powered SEO analysis and suggestions.
// Uses Claude to analyze content and return structured SEO data.
// ============================================================

export interface SeoSuggestions {
  title: string;
  metaDescription: string;
  keywords: string[];
  readabilityScore: number;
  improvements: string[];
}

/**
 * Client-side function that calls the SEO API route.
 */
export async function generateSeoSuggestions(
  content: string,
  title: string
): Promise<SeoSuggestions> {
  const res = await fetch("/api/ai/seo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, title }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "SEO analysis failed");
  }

  return res.json();
}
