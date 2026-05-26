import type { AgentTool, Skill } from "../agent/types";

export function createLoadSkillTool(getSkills: () => Skill[]): AgentTool {
  return {
    name: "load_skill",
    label: "加载技能",
    description:
      "按名称加载 skill 的完整指令内容。支持加载子文档。当用户任务匹配某个 skill 的描述时调用此工具获取详细指令。",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "要加载的 skill 名称，如 'hiking-guide'",
        },
        doc: {
          type: "string",
          description:
            "可选。要加载的子文档相对路径，如 'reference.md'。不传则返回主 SKILL.md 内容。",
        },
      },
      required: ["name"],
    },
    execute: async (_toolCallId, params) => {
      const skills = getSkills();
      const skill = skills.find((s) => s.name === params.name);
      if (!skill) {
        const available = skills.map((s) => s.name).join(", ");
        return {
          content: [{ type: "text" as const, text: `未找到 skill: ${params.name}。可用的 skill: ${available}` }],
        };
      }

      // If doc is specified, load a sub-document
      if (params.doc && typeof params.doc === "string") {
        const docContent = skill.docs?.[params.doc];
        if (!docContent) {
          const availableDocs = Object.keys(skill.docs ?? {});
          if (availableDocs.length === 0) {
            return {
              content: [{ type: "text" as const, text: `Skill '${params.name}' 没有子文档。直接使用主内容即可。` }],
            };
          }
          return {
            content: [{
              type: "text" as const,
              text: `未找到子文档: ${params.doc}。可用的子文档:\n${availableDocs.map((d) => `- ${d}`).join("\n")}`,
            }],
          };
        }
        return {
          content: [{ type: "text" as const, text: docContent }],
        };
      }

      // No doc specified — return main content + list available docs
      const availableDocs = Object.keys(skill.docs ?? {});
      let text = skill.content;
      if (availableDocs.length > 0) {
        text += `\n\n---\n\n## 可用的子文档\n使用 load_skill(name="${params.name}", doc="...") 加载：\n${availableDocs.map((d) => `- \`${d}\``).join("\n")}`;
      }
      return {
        content: [{ type: "text" as const, text }],
      };
    },
  };
}
