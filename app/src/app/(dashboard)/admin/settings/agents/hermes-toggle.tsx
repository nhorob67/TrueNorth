"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import type { Agent, AgentConnectionStatus } from "@/types/database";

function ConnectionDot({ status }: { status: AgentConnectionStatus }) {
  const colors: Record<AgentConnectionStatus, string> = {
    offline: "bg-faded",
    idle: "bg-semantic-green",
    busy: "bg-semantic-ochre",
    error: "bg-semantic-brick",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[status] ?? colors.offline}`}
      title={status}
    />
  );
}

interface HermesToggleProps {
  agent: Agent;
}

export function HermesToggle({ agent }: HermesToggleProps) {
  const router = useRouter();
  const supabase = createClient();
  const [toggling, setToggling] = useState(false);

  async function handleToggle() {
    setToggling(true);
    await supabase
      .from("agents")
      .update({ hermes_enabled: !agent.hermes_enabled })
      .eq("id", agent.id);
    setToggling(false);
    router.refresh();
  }

  const connectionStatus = (agent.connection_status ?? "offline") as AgentConnectionStatus;

  return (
    <div className="flex items-center gap-3 border-t border-line pt-3 mt-3">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold text-subtle uppercase">Hermes Runtime</p>
        {agent.hermes_profile_name && (
          <Badge status="neutral">
            {agent.hermes_profile_name}
          </Badge>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        {agent.hermes_enabled && (
          <div className="flex items-center gap-1.5">
            <ConnectionDot status={connectionStatus} />
            <span className="text-xs text-subtle capitalize">{connectionStatus}</span>
          </div>
        )}

        {agent.hermes_runtime && (
          <Badge status="neutral">
            {agent.hermes_runtime}
          </Badge>
        )}

        <button
          onClick={handleToggle}
          disabled={toggling || !agent.hermes_profile_name}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            agent.hermes_enabled ? "bg-accent" : "bg-well"
          } ${(!agent.hermes_profile_name || toggling) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          title={
            !agent.hermes_profile_name
              ? "Configure a Hermes profile name first"
              : agent.hermes_enabled
                ? "Disable Hermes runtime"
                : "Enable Hermes runtime"
          }
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              agent.hermes_enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {agent.last_error && agent.hermes_enabled && (
        <p className="text-xs text-semantic-brick mt-1 w-full">
          {agent.last_error}
        </p>
      )}
    </div>
  );
}
