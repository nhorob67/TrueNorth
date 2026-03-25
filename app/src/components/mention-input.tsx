"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionsChange?: (mentions: Array<{ userId: string; name: string }>) => void;
  placeholder?: string;
  className?: string;
}

interface TeamMember {
  user_id: string;
  full_name: string;
}

export function MentionInput({
  value,
  onChange,
  onMentionsChange,
  placeholder,
  className = "",
}: MentionInputProps) {
  const supabase = createClient();
  const [showDropdown, setShowDropdown] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<TeamMember[]>([]);
  const [mentions, setMentions] = useState<Array<{ userId: string; name: string }>>([]);
  const [cursorPos, setCursorPos] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function loadMembers() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from("organization_memberships")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!membership) return;

      const { data } = await supabase
        .from("organization_memberships")
        .select("user_id, user_profiles(full_name)")
        .eq("organization_id", membership.organization_id);

      if (data) {
        setMembers(
          data.map((m: Record<string, unknown>) => ({
            user_id: m.user_id as string,
            full_name: Array.isArray(m.user_profiles)
              ? ((m.user_profiles as Array<{ full_name: string }>)[0]?.full_name ?? "Unknown")
              : ((m.user_profiles as { full_name: string } | null)?.full_name ?? "Unknown"),
          }))
        );
      }
    }
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value;
    const pos = e.target.selectionStart ?? 0;
    setCursorPos(pos);
    onChange(newValue);

    // Check for @ trigger
    const textBeforeCursor = newValue.substring(0, pos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      const query = atMatch[1].toLowerCase();
      const filtered = members.filter((m) =>
        m.full_name.toLowerCase().includes(query)
      );
      setFilteredMembers(filtered);
      setShowDropdown(filtered.length > 0);
    } else {
      setShowDropdown(false);
    }
  }

  function selectMember(member: TeamMember) {
    const textBeforeCursor = value.substring(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    const before = value.substring(0, atIndex);
    const after = value.substring(cursorPos);
    const newValue = `${before}@${member.full_name} ${after}`;

    onChange(newValue);
    setShowDropdown(false);

    const newMentions = [...mentions, { userId: member.user_id, name: member.full_name }];
    setMentions(newMentions);
    onMentionsChange?.(newMentions);

    textareaRef.current?.focus();
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={`block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm min-h-[60px] focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-accent-glow/20 ${className}`}
      />
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-line bg-surface shadow-lg max-h-40 overflow-auto">
          {filteredMembers.map((m) => (
            <button
              key={m.user_id}
              type="button"
              onClick={() => selectMember(m)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-canvas"
            >
              @{m.full_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
