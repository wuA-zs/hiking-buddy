import type { AgentTool, Skill } from "../agent/types";

export function createLoadSkillTool(getSkills: () => Skill[]): AgentTool {
  return {
    name: "load_skill",
    label: "加载技能",
    description:
      "按名称加载 skill 的完整指令内容。当用户任务匹配某个 skill 的描述时调用此工具获取详细指令。",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "要加载的 skill 名称，如 'hiking-guide'、'photo-explainer'",
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
      return {
        content: [{ type: "text" as const, text: skill.content }],
      };
    },
  };
}
