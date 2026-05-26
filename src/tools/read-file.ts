import type { AgentTool, AgentToolResult } from "../agent/types";
import { vfs } from "../services/vfs";
import type { VFSNode } from "../services/vfs-types";

export const readFileTool: AgentTool = {
  name: "read_file",
  label: "读取文件",
  description: "读取指定文件的完整内容。通过文件路径或文件 ID 查找。",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "文件路径，如 '/notes/todo.txt'",
      },
      id: {
        type: "string",
        description: "文件 ID（可替代路径）",
      },
    },
    required: [],
  },
  execute: async (
    _toolCallId: string,
    params: Record<string, unknown>,
  ): Promise<AgentToolResult> => {
    let node: VFSNode | null = null;

    if (params.id) {
      node = await vfs.getById(params.id as string);
    } else if (params.path) {
      node = await vfs.getByPath(params.path as string);
    } else {
      return {
        content: [
          { type: "text" as const, text: "请提供 path 或 id 参数" },
        ],
      };
    }

    if (!node) {
      return {
        content: [
          {
            type: "text" as const,
            text: "文件不存在",
          },
        ],
      };
    }

    if (node.type === "folder") {
      return {
        content: [
          {
            type: "text" as const,
            text: `\u201C${node.name}\u201D 是文件夹，请使用 list_files 查看`,
          },
        ],
      };
    }

    const filePath = await vfs.getPath(node.id);
    const size = node.content?.length ?? 0;
    const header = `--- ${filePath} (${size} 字节) ---`;

    return {
      content: [
        {
          type: "text" as const,
          text: `${header}\n${node.content ?? ""}`,
        },
      ],
      details: { id: node.id, path: filePath, size },
    };
  },
};
