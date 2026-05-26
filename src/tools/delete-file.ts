import type { AgentTool, AgentToolResult } from "../agent/types";
import { vfs } from "../services/vfs";
import type { VFSNode } from "../services/vfs-types";

export const deleteFileTool: AgentTool = {
  name: "delete_file",
  label: "删除文件",
  description:
    "删除文件或文件夹。删除文件夹时会递归删除其中所有内容。此操作不可撤销。",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "文件或文件夹路径",
      },
      id: {
        type: "string",
        description: "文件或文件夹 ID（可替代路径）",
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
          { type: "text" as const, text: "文件或文件夹不存在" },
        ],
      };
    }

    try {
      const filePath = await vfs.getPath(node.id);
      const count = await vfs.remove(node.id);

      const summary =
        node.type === "folder"
          ? `已删除文件夹 "${filePath}" 及其中的 ${count} 项内容`
          : `已删除文件 "${filePath}"`;

      return {
        content: [{ type: "text" as const, text: summary }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `删除失败: ${(err as Error).message}`,
          },
        ],
      };
    }
  },
};
