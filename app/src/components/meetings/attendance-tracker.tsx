"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface TeamMember {
  user_id: string;
  role: string;
  full_name: string;
}

interface AttendanceTrackerProps {
  teamMembers: TeamMember[];
  onAttendanceChange: (attendeeIds: string[]) => void;
}

export function AttendanceTracker({
  teamMembers,
  onAttendanceChange,
}: AttendanceTrackerProps) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    new Set(teamMembers.map((m) => m.user_id))
  );

  function toggle(userId: string) {
    const next = new Set(checkedIds);
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    setCheckedIds(next);
    onAttendanceChange(Array.from(next));
  }

  return (
    <Card>
      <CardHeader className="bg-moss/5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-moss">Attendance</h3>
          <span className="text-xs text-warm-gray">
            {checkedIds.size}/{teamMembers.length} present
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {teamMembers.map((member) => (
            <label
              key={member.user_id}
              className="flex items-center gap-2 text-sm cursor-pointer py-1"
            >
              <input
                type="checkbox"
                checked={checkedIds.has(member.user_id)}
                onChange={() => toggle(member.user_id)}
                className="rounded border-warm-border text-moss focus:ring-moss"
              />
              <span className="text-charcoal">{member.full_name}</span>
              <span className="text-xs text-warm-gray capitalize">
                {member.role}
              </span>
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
