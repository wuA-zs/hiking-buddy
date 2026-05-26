import type { AgentTool, AgentToolResult } from "../agent/types";
import { vfs } from "../services/vfs";

export const createFileTool: AgentTool = {
  name: "create_file",
  label: "创建文件",
  description:
    "创建新文件或文件夹。如果路径中包含不存在的中间目录，会自动创建。",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "文件或文件夹名称，也可以是完整路径如 '/notes/hiking/todo.txt'",
      },
      type: {
        type: "string",
        enum: ["file", "folder"],
        description: "创建类型：file（文件）或 folder（文件夹）",
      },
      path: {
        type: "string",
        description: "父文件夹路径，默认根目录。如果 name 是完整路径则忽略此参数。",
      },
      content: {
        type: "string",
        description: "文件内容（仅文件类型）",
      },
    },
    required: ["name", "type"],
  },
  execute: async (
    _toolCallId: string,
    params: Record<string, unknown>,
  ): Promise<AgentToolResult> => {
    const name = params.name as string;
    const type = params.type as "file" | "folder";
    const content = (params.content as string) ?? "";

    try {
      let node;

      // If name contains "/", treat as a full path
      if (name.startsWith("/")) {
        node = await vfs.createAtPath(name, content, type);
      } else {
        // Resolve parentId from optional path
        let parentId: string | null = null;
        if (params.path) {
          const parent = await vfs.getByPath(params.path as string);
          if (!parent) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `父文件夹 "${params.path}" 不存在`,
                },
              ],
                  };
          }
          if (parent.type !== "folder") {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `"${params.path}" 不是文件夹`,
                },
              ],
                  };
          }
          parentId = parent.id;
        }

        node = await vfs.create({ name, type, parentId, content });
      }

      const filePath = await vfs.getPath(node.id);
      const summary =
        type === "folder"
          ? `已创建文件夹: ${filePath}`
          : `已创建文件: ${filePath} (${node.content?.length ?? 0} 字节)`;

      return {
        content: [{ type: "text" as const, text: summary }],
        details: { id: node.id, path: filePath, type: node.type },
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `创建失败: ${(err as Error).message}`,
          },
        ],
      };
    }
  },
};
