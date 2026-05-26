import type { AgentTool, AgentToolResult } from "../agent/types";
import { vfs } from "../services/vfs";
import type { VFSNode } from "../services/vfs-types";

export const updateFileTool: AgentTool = {
  name: "update_file",
  label: "更新文件",
  description: "更新文件内容或重命名文件/文件夹。",
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
      content: {
        type: "string",
        description: "新的文件内容（仅文件）",
      },
      name: {
        type: "string",
        description: "新名称（用于重命名）",
      },
    },
    required: [],
  },
  execute: async (
    _toolCallId: string,
    params: Record<string, unknown>,
  ): Promise<AgentToolResult> => {
    if (!params.content && !params.name) {
      return {
        content: [
          {
            type: "text" as const,
            text: "请提供 content 或 name 参数",
          },
        ],
      };
    }

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
      const updated = await vfs.update(node.id, {
        content: params.content as string | undefined,
        name: params.name as string | undefined,
      });
      const filePath = await vfs.getPath(updated.id);
      const changes: string[] = [];
      if (params.name) changes.push(`重命名为 "${updated.name}"`);
      if (params.content !== undefined)
        changes.push(`内容已更新 (${updated.content?.length ?? 0} 字节)`);

      return {
        content: [
          {
            type: "text" as const,
            text: `${filePath}: ${changes.join(", ")}`,
          },
        ],
        details: { id: updated.id, path: filePath },
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `更新失败: ${(err as Error).message}`,
          },
        ],
      };
    }
  },
};
