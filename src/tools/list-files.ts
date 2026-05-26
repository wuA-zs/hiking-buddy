import type { AgentTool, AgentToolResult } from "../agent/types";
import { vfs } from "../services/vfs";

export const listFilesTool: AgentTool = {
  name: "list_files",
  label: "浏览文件",
  description:
    "列出指定文件夹中的文件和子文件夹。返回名称、类型和大小摘要。默认列出根目录。",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "文件夹路径，如 '/notes' 或 '/notes/hiking'。默认为根目录 '/'。",
      },
    },
    required: [],
  },
  execute: async (
    _toolCallId: string,
    params: Record<string, unknown>,
  ): Promise<AgentToolResult> => {
    const path = (params.path as string) || "/";

    // Resolve parentId from path
    let parentId: string | null = null;
    if (path !== "/") {
      const node = await vfs.getByPath(path);
      if (!node) {
        return {
          content: [
            {
              type: "text" as const,
              text: `路径 "${path}" 不存在`,
            },
          ],
          };
      }
      if (node.type !== "folder") {
        return {
          content: [
            {
              type: "text" as const,
              text: `"${path}" 不是文件夹`,
            },
          ],
          };
      }
      parentId = node.id;
    }

    const children = await vfs.list(parentId);

    if (children.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: path === "/" ? "根目录为空" : `"${path}" 为空`,
          },
        ],
      };
    }

    const lines: string[] = [`${path} (${children.length} 项):`];
    for (const child of children) {
      if (child.type === "folder") {
        const count = await vfs.countChildren(child.id);
        lines.push(`  📁 ${child.name}/ (${count} 项)`);
      } else {
        const size = child.content ? child.content.length : 0;
        const date = new Date(child.updatedAt).toLocaleDateString("zh-CN");
        lines.push(`  📄 ${child.name} (${size} 字节, ${date})`);
      }
    }

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
      details: { path, children },
    };
  },
};
