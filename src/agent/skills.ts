/**
 * Skill system — adapted from pi-agent-core harness/skills.ts
 *
 * Loads SKILL.md files and formats them into the system prompt
 * using the agentskills.io XML format.
 */

import type { Skill } from "./types";

/**
 * Parse YAML frontmatter from markdown content.
 * Simple parser — only handles flat key-value pairs.
 */
function parseFrontmatter(raw: string): { frontmatter: Record<string, string>; body: string } {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized.startsWith("---")) {
    return { frontmatter: {}, body: normalized };
  }
  const endIndex = normalized.indexOf("\n---", 3);
  if (endIndex === -1) {
    return { frontmatter: {}, body: normalized };
  }
  const yaml = normalized.slice(3, endIndex);
  const body = normalized.slice(endIndex + 4).trim();

  const frontmatter: Record<string, string> = {};
  for (const line of yaml.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();
    // Strip quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    frontmatter[key] = value;
  }

  return { frontmatter, body };
}

/**
 * Load skills from a record of name → markdown content.
 * In a mobile app, skills are bundled as static strings rather than files.
 */
export function loadSkills(skillContents: Record<string, string>): Skill[] {
  const skills: Skill[] = [];
  for (const [name, content] of Object.entries(skillContents)) {
    const { frontmatter, body } = parseFrontmatter(content);
    skills.push({
      name: frontmatter.name ?? name,
      description: frontmatter.description ?? "",
      content: body,
      filePath: `skills://${name}/SKILL.md`,
    });
  }
  return skills;
}

/**
 * Format skills for system prompt using agentskills.io XML format.
 * Same format as pi-agent-core harness/system-prompt.ts.
 */
export function formatSkillsForSystemPrompt(skills: Skill[]): string {
  if (skills.length === 0) return "";

  const lines = [
    "",
    "The following skills provide specialized instructions for specific tasks.",
    "Read the full skill content when the task matches its description.",
    "",
    "<available_skills>",
  ];

  for (const skill of skills) {
    lines.push("  <skill>");
    lines.push(`    <name>${escapeXml(skill.name)}</name>`);
    lines.push(`    <description>${escapeXml(skill.description)}</description>`);
    lines.push(`    <location>${escapeXml(skill.filePath)}</location>`);
    lines.push("  </skill>");
  }

  lines.push("</available_skills>");

  // Also include full skill content inline (mobile has no file system to read from)
  for (const skill of skills) {
    lines.push("");
    lines.push(`<skill name="${escapeXml(skill.name)}">`);
    lines.push(skill.content);
    lines.push("</skill>");
  }

  return lines.join("\n");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
