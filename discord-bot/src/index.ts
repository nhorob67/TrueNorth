import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ComponentType,
  TextChannel,
} from "discord.js";
import { supabase, getOrgId, getDefaultUserId } from "./supabase.js";
import { MOSS, BRICK, OCHRE, APP_URL, healthEmoji, severityEmoji, truncate } from "./helpers.js";
import { summarizeThread, type ThreadSummary } from "./summarize.js";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID!;

// ---------------------------------------------------------------------------
// Command definitions
// ---------------------------------------------------------------------------

const commands = [
  new SlashCommandBuilder().setName("pulse").setDescription("Submit your daily pulse"),
  new SlashCommandBuilder().setName("scoreboard").setDescription("View KPI scoreboard status"),
  new SlashCommandBuilder().setName("bets").setDescription("View active quarterly bets"),
  new SlashCommandBuilder()
    .setName("blocker")
    .setDescription("Report a blocker")
    .addUserOption((opt) => opt.setName("person").setDescription("Who is blocked").setRequired(true))
    .addStringOption((opt) => opt.setName("description").setDescription("Blocker description").setRequired(true)),
  new SlashCommandBuilder()
    .setName("commit")
    .setDescription("Make a commitment")
    .addStringOption((opt) => opt.setName("commitment").setDescription("What you commit to").setRequired(true)),
  new SlashCommandBuilder().setName("cockpit").setDescription("View operator cockpit summary"),
  new SlashCommandBuilder()
    .setName("moves")
    .setDescription("View active moves")
    .addStringOption((opt) => opt.setName("bet").setDescription("Filter by bet name").setRequired(false)),
  new SlashCommandBuilder()
    .setName("move-done")
    .setDescription("Mark a move as shipped")
    .addStringOption((opt) => opt.setName("name").setDescription("Move name").setRequired(true)),
  new SlashCommandBuilder()
    .setName("move-add")
    .setDescription("Quick-create a milestone move")
    .addStringOption((opt) => opt.setName("bet").setDescription("Bet name").setRequired(true))
    .addStringOption((opt) => opt.setName("title").setDescription("Move title").setRequired(true)),
  new SlashCommandBuilder()
    .setName("idea")
    .setDescription("Submit an idea to the vault")
    .addStringOption((opt) => opt.setName("description").setDescription("Idea description").setRequired(true)),
  new SlashCommandBuilder()
    .setName("todo")
    .setDescription("Create a personal todo")
    .addStringOption((opt) => opt.setName("title").setDescription("Todo title").setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName("priority")
        .setDescription("Priority level")
        .setRequired(false)
        .addChoices(
          { name: "High", value: "high" },
          { name: "Medium", value: "medium" },
          { name: "Low", value: "low" }
        )
    ),
  new SlashCommandBuilder().setName("focus").setDescription("Show what you should focus on today"),
  new SlashCommandBuilder()
    .setName("update-kpi")
    .setDescription("Quick KPI value update")
    .addStringOption((opt) => opt.setName("name").setDescription("KPI name to search").setRequired(true))
    .addNumberOption((opt) => opt.setName("value").setDescription("New KPI value").setRequired(true)),
  new SlashCommandBuilder()
    .setName("decision")
    .setDescription("Record a decision")
    .addStringOption((opt) => opt.setName("title").setDescription("Decision title").setRequired(true))
    .addStringOption((opt) => opt.setName("decision").setDescription("The decision text").setRequired(true)),
  new SlashCommandBuilder()
    .setName("summarize-thread")
    .setDescription("Summarize recent messages and offer to create TrueNorth objects"),
];

// ---------------------------------------------------------------------------
// Register slash commands with Discord
// ---------------------------------------------------------------------------

async function registerCommands() {
  const rest = new REST().setToken(DISCORD_TOKEN);
  console.log("Registering slash commands...");
  await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), {
    body: commands.map((c) => c.toJSON()),
  });
  console.log("Commands registered.");
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

function errorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(BRICK).setTitle("Error").setDescription(message);
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

async function handlePulse(interaction: ChatInputCommandInteraction) {
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(MOSS)
        .setTitle("\u{1F4DD} Daily Pulse")
        .setDescription(`Submit your daily pulse on the web app.\n\n[Open Pulse](${APP_URL}/pulse)`),
    ],
  });
}

async function handleScoreboard(interaction: ChatInputCommandInteraction) {
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(MOSS)
        .setTitle("\u{1F4CA} Scoreboard")
        .setDescription(`View your KPI scoreboard on the web app.\n\n[Open Scoreboard](${APP_URL}/scoreboard)`),
    ],
  });
}

async function handleBets(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const orgId = await getOrgId();

  // Fetch active bets
  const { data: bets, error } = await supabase
    .from("bets")
    .select("id, outcome, health_status, lifecycle_status")
    .eq("organization_id", orgId)
    .eq("lifecycle_status", "active")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch bets: ${error.message}`);

  if (!bets || bets.length === 0) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(MOSS)
          .setTitle("\u{1F3AF} Active Bets")
          .setDescription(`No active bets found.\n\n[Open Bets](${APP_URL}/bets)`),
      ],
    });
    return;
  }

  // For each bet, count moves
  const betFields = await Promise.all(
    bets.map(async (bet) => {
      const { count: totalMoves } = await supabase
        .from("moves")
        .select("*", { count: "exact", head: true })
        .eq("bet_id", bet.id);

      const { count: shippedMoves } = await supabase
        .from("moves")
        .select("*", { count: "exact", head: true })
        .eq("bet_id", bet.id)
        .eq("lifecycle_status", "shipped");

      return {
        name: `${healthEmoji(bet.health_status)} ${truncate(bet.outcome)}`,
        value: `${shippedMoves ?? 0} shipped / ${totalMoves ?? 0} total moves`,
        inline: false,
      };
    })
  );

  const embed = new EmbedBuilder()
    .setColor(MOSS)
    .setTitle("\u{1F3AF} Active Bets")
    .addFields(betFields)
    .setFooter({ text: `View all bets in the app` })
    .setDescription(`[Open Bets](${APP_URL}/bets)`);

  await interaction.editReply({ embeds: [embed] });
}

async function handleBlocker(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const person = interaction.options.getUser("person", true);
  const description = interaction.options.getString("description", true);
  const orgId = await getOrgId();
  const ownerId = await getDefaultUserId(orgId);

  const { data, error } = await supabase
    .from("blockers")
    .insert({
      organization_id: orgId,
      description: `${description} (reported by Discord user, blocking <@${person.id}> / ${person.username})`,
      owner_id: ownerId,
      severity: "medium",
      resolution_state: "open",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create blocker: ${error.message}`);

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(MOSS)
        .setTitle("\u{1F6A7} Blocker Created")
        .setDescription(truncate(description, 200))
        .addFields(
          { name: "Blocking", value: `<@${person.id}>`, inline: true },
          { name: "Severity", value: `${severityEmoji("medium")} Medium`, inline: true },
          { name: "Status", value: "Open", inline: true }
        )
        .setFooter({ text: `ID: ${data.id}` })
        .setDescription(`${truncate(description, 200)}\n\n[Open Ops](${APP_URL}/ops)`),
    ],
  });
}

async function handleCommit(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const commitment = interaction.options.getString("commitment", true);
  const orgId = await getOrgId();
  const ownerId = await getDefaultUserId(orgId);

  const { data, error } = await supabase
    .from("commitments")
    .insert({
      organization_id: orgId,
      description: commitment,
      owner_id: ownerId,
      status: "pending",
      created_in: "discord",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create commitment: ${error.message}`);

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(MOSS)
        .setTitle("\u{1F91D} Commitment Created")
        .setDescription(`${truncate(commitment, 200)}\n\n[Open Ops](${APP_URL}/ops)`)
        .setFooter({ text: `ID: ${data.id}` }),
    ],
  });
}

async function handleCockpit(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const orgId = await getOrgId();
  const today = new Date().toISOString().slice(0, 10);

  // Run all queries in parallel
  const [redKpis, yellowKpis, openBlockers, overdueCommitments, todayPulses, totalMembers] =
    await Promise.all([
      supabase
        .from("kpis")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("lifecycle_status", "active")
        .eq("health_status", "red"),
      supabase
        .from("kpis")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("lifecycle_status", "active")
        .eq("health_status", "yellow"),
      supabase
        .from("blockers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("resolution_state", "open"),
      supabase
        .from("commitments")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "pending")
        .lt("due_date", today),
      supabase
        .from("pulses")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("date", today),
      supabase
        .from("organization_memberships")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId),
    ]);

  const redCount = redKpis.count ?? 0;
  const yellowCount = yellowKpis.count ?? 0;
  const blockerCount = openBlockers.count ?? 0;
  const overdueCount = overdueCommitments.count ?? 0;
  const pulseCount = todayPulses.count ?? 0;
  const memberCount = totalMembers.count ?? 0;

  const hasCritical = redCount > 0 || blockerCount > 0;

  const embed = new EmbedBuilder()
    .setColor(hasCritical ? BRICK : MOSS)
    .setTitle("\u{1F9ED} Cockpit Summary")
    .addFields(
      {
        name: "Drifting KPIs",
        value: `\u{1F534} ${redCount} red \u{00B7} \u{1F7E1} ${yellowCount} yellow`,
        inline: true,
      },
      {
        name: "Open Blockers",
        value: `${blockerCount}`,
        inline: true,
      },
      {
        name: "Overdue Commitments",
        value: `${overdueCount}`,
        inline: true,
      },
      {
        name: "Pulse Rate",
        value: `${pulseCount} / ${memberCount} today`,
        inline: true,
      }
    )
    .setDescription(`[Open Cockpit](${APP_URL}/cockpit)`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleMoves(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const orgId = await getOrgId();
  const betFilter = interaction.options.getString("bet");

  let betIds: string[] | null = null;

  // If filtering by bet name, find matching bets first
  if (betFilter) {
    const { data: matchingBets, error: betError } = await supabase
      .from("bets")
      .select("id, outcome")
      .eq("organization_id", orgId)
      .ilike("outcome", `%${betFilter}%`);

    if (betError) throw new Error(`Failed to search bets: ${betError.message}`);

    if (!matchingBets || matchingBets.length === 0) {
      await interaction.editReply({
        embeds: [errorEmbed(`No bet found matching "${betFilter}"`)],
      });
      return;
    }

    betIds = matchingBets.map((b) => b.id);
  }

  // Build query for moves
  let query = supabase
    .from("moves")
    .select("id, title, health_status, lifecycle_status, due_date, bet_id, bets(outcome)")
    .eq("organization_id", orgId)
    .in("lifecycle_status", ["not_started", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(25);

  if (betIds) {
    query = query.in("bet_id", betIds);
  }

  const { data: moves, error } = await query;

  if (error) throw new Error(`Failed to fetch moves: ${error.message}`);

  if (!moves || moves.length === 0) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(MOSS)
          .setTitle("\u{1F3C3} Active Moves")
          .setDescription(
            betFilter
              ? `No active moves found for "${betFilter}".\n\n[Open Bets](${APP_URL}/bets)`
              : `No active moves found.\n\n[Open Bets](${APP_URL}/bets)`
          ),
      ],
    });
    return;
  }

  // Group moves by bet
  const grouped = new Map<string, { betName: string; moves: typeof moves }>();
  for (const move of moves) {
    const betName = Array.isArray(move.bets)
      ? (move.bets[0] as { outcome: string })?.outcome ?? "Unknown Bet"
      : (move.bets as { outcome: string } | null)?.outcome ?? "Unknown Bet";

    if (!grouped.has(move.bet_id)) {
      grouped.set(move.bet_id, { betName, moves: [] });
    }
    grouped.get(move.bet_id)!.moves.push(move);
  }

  const fields: { name: string; value: string; inline: boolean }[] = [];
  let totalShown = 0;
  const MAX_SHOWN = 10;

  for (const [, group] of grouped) {
    if (totalShown >= MAX_SHOWN) break;

    const moveLines: string[] = [];
    for (const m of group.moves) {
      if (totalShown >= MAX_SHOWN) break;
      const duePart = m.due_date ? ` (due ${m.due_date})` : "";
      moveLines.push(`${healthEmoji(m.health_status)} ${truncate(m.title, 45)}${duePart}`);
      totalShown++;
    }

    fields.push({
      name: truncate(group.betName, 50),
      value: moveLines.join("\n"),
      inline: false,
    });
  }

  const remaining = moves.length - totalShown;
  const embed = new EmbedBuilder()
    .setColor(MOSS)
    .setTitle("\u{1F3C3} Active Moves")
    .addFields(fields)
    .setDescription(`[Open Bets](${APP_URL}/bets)`);

  if (remaining > 0) {
    embed.setFooter({ text: `and ${remaining} more...` });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleMoveDone(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const name = interaction.options.getString("name", true);
  const orgId = await getOrgId();

  // Search for matching milestone moves
  const { data: matches, error: searchError } = await supabase
    .from("moves")
    .select("id, title, lifecycle_status, type")
    .eq("organization_id", orgId)
    .eq("type", "milestone")
    .in("lifecycle_status", ["not_started", "in_progress"])
    .ilike("title", `%${name}%`);

  if (searchError) throw new Error(`Failed to search moves: ${searchError.message}`);

  if (!matches || matches.length === 0) {
    await interaction.editReply({
      embeds: [
        errorEmbed(
          `No active milestone move found matching "${name}". Make sure the move exists, is a milestone, and is not already shipped.`
        ),
      ],
    });
    return;
  }

  if (matches.length > 1) {
    const list = matches
      .slice(0, 5)
      .map((m) => `\u2022 ${m.title}`)
      .join("\n");
    await interaction.editReply({
      embeds: [
        errorEmbed(
          `Multiple moves match "${name}". Please be more specific:\n${list}${matches.length > 5 ? `\n...and ${matches.length - 5} more` : ""}`
        ),
      ],
    });
    return;
  }

  const move = matches[0];

  const { error: updateError } = await supabase
    .from("moves")
    .update({ lifecycle_status: "shipped" })
    .eq("id", move.id);

  if (updateError) throw new Error(`Failed to update move: ${updateError.message}`);

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(MOSS)
        .setTitle("\u2705 Move Shipped")
        .setDescription(`**${move.title}**\n\n[Open Bets](${APP_URL}/bets)`),
    ],
  });
}

async function handleMoveAdd(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const betName = interaction.options.getString("bet", true);
  const title = interaction.options.getString("title", true);
  const orgId = await getOrgId();

  // Find bet by name
  const { data: bets, error: betError } = await supabase
    .from("bets")
    .select("id, outcome, venture_id, owner_id")
    .eq("organization_id", orgId)
    .ilike("outcome", `%${betName}%`);

  if (betError) throw new Error(`Failed to search bets: ${betError.message}`);

  if (!bets || bets.length === 0) {
    await interaction.editReply({
      embeds: [errorEmbed(`No bet found matching "${betName}".`)],
    });
    return;
  }

  // Use the first match
  const bet = bets[0];
  const ownerId = await getDefaultUserId(orgId);

  const { data, error: insertError } = await supabase
    .from("moves")
    .insert({
      organization_id: orgId,
      venture_id: bet.venture_id,
      bet_id: bet.id,
      type: "milestone",
      title,
      owner_id: ownerId,
      lifecycle_status: "not_started",
      health_status: "green",
    })
    .select("id")
    .single();

  if (insertError) throw new Error(`Failed to create move: ${insertError.message}`);

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(MOSS)
        .setTitle("\u2795 Move Created")
        .setDescription(
          `**${truncate(title, 100)}** on bet **${truncate(bet.outcome, 80)}**\n\n[Open Bet](${APP_URL}/bets/${bet.id})`
        )
        .setFooter({ text: `ID: ${data.id}` }),
    ],
  });
}

async function handleIdea(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const description = interaction.options.getString("description", true);
  const orgId = await getOrgId();

  // Get the first venture for this org
  const { data: venture, error: ventureError } = await supabase
    .from("ventures")
    .select("id")
    .eq("organization_id", orgId)
    .limit(1)
    .single();

  if (ventureError) throw new Error(`Failed to find venture: ${ventureError.message}`);

  const name = description.slice(0, 60);
  const coolingExpires = new Date();
  coolingExpires.setDate(coolingExpires.getDate() + 14);

  const { data, error } = await supabase
    .from("ideas")
    .insert({
      organization_id: orgId,
      venture_id: venture.id,
      name,
      description,
      lifecycle_status: "quarantine",
      cooling_expires_at: coolingExpires.toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create idea: ${error.message}`);

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(MOSS)
        .setTitle("\u{1F4A1} Idea Submitted")
        .setDescription(`**${truncate(name)}**\n\n14-day cooling period started.\n\n[Open Ideas](${APP_URL}/ideas)`)
        .setFooter({ text: `ID: ${data.id}` }),
    ],
  });
}

async function handleTodo(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const title = interaction.options.getString("title", true);
  const priority = interaction.options.getString("priority") ?? "medium";
  const orgId = await getOrgId();
  const userId = await getDefaultUserId(orgId);

  const { data, error } = await supabase
    .from("todos")
    .insert({
      organization_id: orgId,
      user_id: userId,
      title,
      priority,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create todo: ${error.message}`);

  const priorityBadge =
    priority === "high" ? "\u{1F534} High" : priority === "low" ? "\u26AA Low" : "\u{1F7E1} Medium";

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(MOSS)
        .setTitle("\u2705 Todo Created")
        .setDescription(`**${truncate(title, 100)}**`)
        .addFields({ name: "Priority", value: priorityBadge, inline: true })
        .setDescription(`**${truncate(title, 100)}**\n\n[Open Todos](${APP_URL}/todos)`)
        .setFooter({ text: `ID: ${data.id}` }),
    ],
  });
}

async function handleFocus(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const orgId = await getOrgId();
  const userId = await getDefaultUserId(orgId);
  const today = new Date().toISOString().slice(0, 10);

  const [movesResult, commitmentsResult, todosResult, rhythmsResult] = await Promise.all([
    // Active moves owned by user
    supabase
      .from("moves")
      .select("id, title, health_status")
      .eq("organization_id", orgId)
      .eq("owner_id", userId)
      .eq("lifecycle_status", "in_progress")
      .order("created_at", { ascending: false })
      .limit(5),
    // Today's pending commitments
    supabase
      .from("commitments")
      .select("id, description")
      .eq("organization_id", orgId)
      .eq("owner_id", userId)
      .eq("status", "pending")
      .lte("due_date", today)
      .limit(5),
    // Overdue todos
    supabase
      .from("todos")
      .select("id, title")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .eq("completed", false)
      .lte("due_date", today)
      .limit(5),
    // Recurring move instances pending today
    supabase
      .from("move_instances")
      .select("id, title, status, moves(title)")
      .eq("organization_id", orgId)
      .eq("owner_id", userId)
      .eq("status", "pending")
      .lte("due_date", today)
      .limit(5),
  ]);

  const embed = new EmbedBuilder()
    .setColor(MOSS)
    .setTitle("\u{1F3AF} Your Focus Today")
    .setTimestamp();

  // Active Moves
  const moves = movesResult.data ?? [];
  if (moves.length > 0) {
    const lines = moves.map((m) => `${healthEmoji(m.health_status)} ${truncate(m.title, 50)}`);
    embed.addFields({ name: `Active Moves (${moves.length})`, value: lines.join("\n"), inline: false });
  }

  // Due Commitments
  const commitments = commitmentsResult.data ?? [];
  if (commitments.length > 0) {
    const lines = commitments.map((c) => `\u2022 ${truncate(c.description, 50)}`);
    embed.addFields({ name: `Due Commitments (${commitments.length})`, value: lines.join("\n"), inline: false });
  }

  // Overdue Todos
  const todos = todosResult.data ?? [];
  if (todos.length > 0) {
    const lines = todos.map((t) => `\u2022 ${truncate(t.title, 50)}`);
    embed.addFields({ name: `Overdue Todos (${todos.length})`, value: lines.join("\n"), inline: false });
  }

  // Pending Rhythms
  const rhythms = rhythmsResult.data ?? [];
  if (rhythms.length > 0) {
    const lines = rhythms.map((r) => {
      const moveTitle = Array.isArray(r.moves)
        ? (r.moves[0] as { title: string })?.title ?? r.title
        : (r.moves as { title: string } | null)?.title ?? r.title;
      return `\u{1F504} ${truncate(moveTitle ?? r.title, 50)}`;
    });
    embed.addFields({ name: `Pending Rhythms (${rhythms.length})`, value: lines.join("\n"), inline: false });
  }

  if (moves.length === 0 && commitments.length === 0 && todos.length === 0 && rhythms.length === 0) {
    embed.setDescription("Nothing urgent today \u2014 you're all clear!");
  }

  embed.setDescription(
    (embed.data.description ?? "") + `\n\n[Open My Cockpit](${APP_URL}/cockpit/my)`
  );

  await interaction.editReply({ embeds: [embed] });
}

async function handleUpdateKpi(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const name = interaction.options.getString("name", true);
  const value = interaction.options.getNumber("value", true);
  const orgId = await getOrgId();

  // Find KPI by name
  const { data: kpis, error: searchError } = await supabase
    .from("kpis")
    .select("id, name, unit, lifecycle_status")
    .eq("organization_id", orgId)
    .eq("lifecycle_status", "active")
    .ilike("name", `%${name}%`);

  if (searchError) throw new Error(`Failed to search KPIs: ${searchError.message}`);

  if (!kpis || kpis.length === 0) {
    await interaction.editReply({
      embeds: [errorEmbed(`No active KPI found matching "${name}".`)],
    });
    return;
  }

  const kpi = kpis[0];

  // Insert a new KPI entry
  const { error: entryError } = await supabase.from("kpi_entries").insert({
    kpi_id: kpi.id,
    organization_id: orgId,
    value,
    source: "discord",
    recorded_at: new Date().toISOString(),
  });

  if (entryError) throw new Error(`Failed to insert KPI entry: ${entryError.message}`);

  // Update current_value on the KPI
  const { error: updateError } = await supabase
    .from("kpis")
    .update({ current_value: value })
    .eq("id", kpi.id);

  if (updateError) throw new Error(`Failed to update KPI: ${updateError.message}`);

  const unit = kpi.unit ? ` ${kpi.unit}` : "";

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(MOSS)
        .setTitle("\u{1F4C8} KPI Updated")
        .setDescription(
          `Updated **${kpi.name}**: ${value}${unit}\n\n[Open Scoreboard](${APP_URL}/scoreboard/${kpi.id})`
        ),
    ],
  });
}

async function handleDecision(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const title = interaction.options.getString("title", true);
  const decision = interaction.options.getString("decision", true);
  const orgId = await getOrgId();
  const ownerId = await getDefaultUserId(orgId);

  const { data, error } = await supabase
    .from("decisions")
    .insert({
      organization_id: orgId,
      title,
      final_decision: decision,
      decided_at: new Date().toISOString(),
      owner_id: ownerId,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to record decision: ${error.message}`);

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(MOSS)
        .setTitle("\u2696\uFE0F Decision Recorded")
        .setDescription(`**${truncate(title, 100)}**\n\n${truncate(decision, 300)}\n\n[Open Ops](${APP_URL}/ops)`)
        .setFooter({ text: `ID: ${data.id}` }),
    ],
  });
}

// ---------------------------------------------------------------------------
// /summarize-thread handler
// ---------------------------------------------------------------------------

async function handleSummarizeThread(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const channel = interaction.channel;
  if (!channel || !("messages" in channel)) {
    await interaction.editReply({
      embeds: [errorEmbed("This command can only be used in a text channel.")],
    });
    return;
  }

  const textChannel = channel as TextChannel;

  // Fetch last 50 messages
  const messages = await textChannel.messages.fetch({ limit: 50 });
  const messageArray = [...messages.values()].reverse(); // oldest first

  if (messageArray.length < 20) {
    await interaction.editReply({
      embeds: [
        errorEmbed(`Not enough messages to summarize (found ${messageArray.length}, need at least 20).`),
      ],
    });
    return;
  }

  // Build message text for AI
  const messageTexts = messageArray
    .filter((m) => !m.author.bot && m.content.trim())
    .map((m) => `${m.author.displayName}: ${m.content}`)
    .join("\n");

  if (!messageTexts.trim()) {
    await interaction.editReply({
      embeds: [errorEmbed("No text messages found to summarize.")],
    });
    return;
  }

  // Call AI summarization
  let summary: ThreadSummary;
  try {
    summary = await summarizeThread(messageTexts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await interaction.editReply({
      embeds: [errorEmbed(`Failed to summarize: ${msg}`)],
    });
    return;
  }

  // Build the summary embed
  const embed = new EmbedBuilder()
    .setColor(MOSS)
    .setTitle("\u{1F4CB} Thread Summary")
    .setTimestamp();

  // Summary bullets
  if (summary.summary.length > 0) {
    embed.addFields({
      name: "Summary",
      value: summary.summary.map((s) => `\u2022 ${s}`).join("\n"),
      inline: false,
    });
  }

  // Decisions
  if (summary.decisions.length > 0) {
    embed.addFields({
      name: "\u2696\uFE0F Decisions",
      value: summary.decisions.map((d) => `\u2022 ${d}`).join("\n"),
      inline: false,
    });
  }

  // Blockers
  if (summary.blockers.length > 0) {
    embed.addFields({
      name: "\u{1F6A7} Blockers",
      value: summary.blockers.map((b) => `\u2022 ${b}`).join("\n"),
      inline: false,
    });
  }

  // Action items
  if (summary.actionItems.length > 0) {
    embed.addFields({
      name: "\u{1F4CB} Action Items",
      value: summary.actionItems.map((a) => `\u2022 ${a}`).join("\n"),
      inline: false,
    });
  }

  // Build action buttons
  const buttons = new ActionRowBuilder<ButtonBuilder>();

  if (summary.decisions.length > 0) {
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId("summary_create_decision")
        .setLabel("Create Decision")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("\u2696\uFE0F")
    );
  }

  if (summary.blockers.length > 0) {
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId("summary_create_blocker")
        .setLabel("Create Blocker")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("\u{1F6A7}")
    );
  }

  if (summary.actionItems.length > 0) {
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId("summary_create_commitment")
        .setLabel("Create Commitment")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("\u{1F91D}")
    );
  }

  const replyPayload: { embeds: EmbedBuilder[]; components?: ActionRowBuilder<ButtonBuilder>[] } = {
    embeds: [embed],
  };
  if (buttons.components.length > 0) {
    replyPayload.components = [buttons];
  }

  const reply = await interaction.editReply(replyPayload);

  // Handle button interactions (active for 5 minutes)
  if (buttons.components.length === 0) return;

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 5 * 60 * 1000,
  });

  collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
    try {
      await buttonInteraction.deferReply({ ephemeral: true });

      const orgId = await getOrgId();
      const ownerId = await getDefaultUserId(orgId);

      if (buttonInteraction.customId === "summary_create_decision") {
        const decisionText = summary.decisions.join("; ");
        const { data, error } = await supabase
          .from("decisions")
          .insert({
            organization_id: orgId,
            title: truncate(decisionText, 100),
            final_decision: decisionText,
            decided_at: new Date().toISOString(),
            owner_id: ownerId,
          })
          .select("id")
          .single();

        if (error) throw new Error(error.message);

        await buttonInteraction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(MOSS)
              .setTitle("\u2696\uFE0F Decision Created")
              .setDescription(`${truncate(decisionText, 200)}\n\n[Open Ops](${APP_URL}/ops)`)
              .setFooter({ text: `ID: ${data.id}` }),
          ],
        });
      } else if (buttonInteraction.customId === "summary_create_blocker") {
        const blockerText = summary.blockers.join("; ");
        const { data, error } = await supabase
          .from("blockers")
          .insert({
            organization_id: orgId,
            description: blockerText,
            owner_id: ownerId,
            severity: "medium",
            resolution_state: "open",
          })
          .select("id")
          .single();

        if (error) throw new Error(error.message);

        await buttonInteraction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(MOSS)
              .setTitle("\u{1F6A7} Blocker Created")
              .setDescription(`${truncate(blockerText, 200)}\n\n[Open Ops](${APP_URL}/ops)`)
              .setFooter({ text: `ID: ${data.id}` }),
          ],
        });
      } else if (buttonInteraction.customId === "summary_create_commitment") {
        const commitmentText = summary.actionItems.join("; ");
        const { data, error } = await supabase
          .from("commitments")
          .insert({
            organization_id: orgId,
            description: commitmentText,
            owner_id: ownerId,
            status: "pending",
            created_in: "discord",
          })
          .select("id")
          .single();

        if (error) throw new Error(error.message);

        await buttonInteraction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(MOSS)
              .setTitle("\u{1F91D} Commitment Created")
              .setDescription(`${truncate(commitmentText, 200)}\n\n[Open Ops](${APP_URL}/ops)`)
              .setFooter({ text: `ID: ${data.id}` }),
          ],
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await buttonInteraction.editReply({
        embeds: [errorEmbed(msg)],
      });
    }
  });

  collector.on("end", async () => {
    // Disable buttons after timeout
    try {
      const disabledButtons = new ActionRowBuilder<ButtonBuilder>();
      for (const btn of buttons.components) {
        disabledButtons.addComponents(
          ButtonBuilder.from(btn).setDisabled(true)
        );
      }
      await interaction.editReply({ components: [disabledButtons] });
    } catch {
      // Message may have been deleted
    }
  });
}

// ---------------------------------------------------------------------------
// Client setup — includes MessageContent and GuildMessages intents
// ---------------------------------------------------------------------------

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on("ready", () => {
  console.log(`TrueNorth bot logged in as ${client.user?.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    switch (interaction.commandName) {
      case "pulse":
        await handlePulse(interaction);
        break;
      case "scoreboard":
        await handleScoreboard(interaction);
        break;
      case "bets":
        await handleBets(interaction);
        break;
      case "blocker":
        await handleBlocker(interaction);
        break;
      case "commit":
        await handleCommit(interaction);
        break;
      case "cockpit":
        await handleCockpit(interaction);
        break;
      case "moves":
        await handleMoves(interaction);
        break;
      case "move-done":
        await handleMoveDone(interaction);
        break;
      case "move-add":
        await handleMoveAdd(interaction);
        break;
      case "idea":
        await handleIdea(interaction);
        break;
      case "todo":
        await handleTodo(interaction);
        break;
      case "focus":
        await handleFocus(interaction);
        break;
      case "update-kpi":
        await handleUpdateKpi(interaction);
        break;
      case "decision":
        await handleDecision(interaction);
        break;
      case "summarize-thread":
        await handleSummarizeThread(interaction);
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred";
    console.error(`Error handling /${interaction.commandName}:`, err);

    const embed = errorEmbed(message);

    // If we already deferred, use editReply; otherwise use reply
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [embed] }).catch(() => {});
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
    }
  }
});

registerCommands().then(() => client.login(DISCORD_TOKEN));
