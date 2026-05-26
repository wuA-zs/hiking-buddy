/**
 * Virtual File System — CRUD operations backed by AsyncStorage
 *
 * Flat node array with parentId references forming a tree.
 * Root is implicit (all nodes where parentId === null).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateId } from "../agent/types";
import type { VFSNode } from "./vfs-types";

const STORAGE_KEY = "vfs_nodes";
const MAX_FILE_SIZE = 100 * 1024; // 100 KB per file

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function loadAll(): Promise<VFSNode[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as VFSNode[];
  } catch {
    return [];
  }
}

async function saveAll(nodes: VFSNode[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
}

/** Collect a node and all its descendants (BFS). */
function collectDescendants(nodes: VFSNode[], id: string): Set<string> {
  const ids = new Set<string>([id]);
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const n of nodes) {
      if (n.parentId === current && !ids.has(n.id)) {
        ids.add(n.id);
        queue.push(n.id);
      }
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const vfs = {
  /** List direct children of a folder. Pass null for root. */
  async list(parentId: string | null): Promise<VFSNode[]> {
    const nodes = await loadAll();
    const children = nodes.filter((n) => n.parentId === parentId);
    // Sort: folders first, then alphabetical
    children.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name, "zh-CN");
    });
    return children;
  },

  /** Get a single node by id. */
  async getById(id: string): Promise<VFSNode | null> {
    const nodes = await loadAll();
    return nodes.find((n) => n.id === id) ?? null;
  },

  /** Resolve a path like "/notes/hiking/todo.txt" to a VFSNode. */
  async getByPath(path: string): Promise<VFSNode | null> {
    const parts = path
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return null;

    const nodes = await loadAll();
    let parentId: string | null = null;

    for (const part of parts) {
      const found = nodes.find((n) => n.parentId === parentId && n.name === part);
      if (!found) return null;
      parentId = found.id;
      if (part === parts[parts.length - 1]) return found;
    }
    return null;
  },

  /** Create a new file or folder. */
  async create(params: {
    name: string;
    type: "file" | "folder";
    parentId: string | null;
    content?: string;
  }): Promise<VFSNode> {
    const { name, type, parentId } = params;
    const content = type === "file" ? (params.content ?? "") : null;

    // Validate name
    if (!name.trim() || name.includes("/")) {
      throw new Error("文件名不能为空且不能包含 /");
    }

    // Check size
    if (content && content.length > MAX_FILE_SIZE) {
      throw new Error(`文件内容不能超过 ${MAX_FILE_SIZE / 1024} KB`);
    }

    const nodes = await loadAll();

    // Check duplicate name in same folder
    if (nodes.some((n) => n.parentId === parentId && n.name === name.trim())) {
      throw new Error(`"${name.trim()}" 已存在`);
    }

    const now = Date.now();
    const node: VFSNode = {
      id: generateId(),
      name: name.trim(),
      type,
      parentId,
      content,
      createdAt: now,
      updatedAt: now,
    };

    nodes.push(node);
    await saveAll(nodes);
    return node;
  },

  /** Create a file at a path, auto-creating intermediate folders. */
  async createAtPath(
    path: string,
    content: string = "",
    type: "file" | "folder" = "file",
  ): Promise<VFSNode> {
    const parts = path
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) throw new Error("路径不能为空");

    const nodes = await loadAll();
    let parentId: string | null = null;

    // Create intermediate folders
    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      let existing = nodes.find(
        (n) => n.parentId === parentId && n.name === folderName && n.type === "folder",
      );
      if (!existing) {
        const now = Date.now();
        existing = {
          id: generateId(),
          name: folderName,
          type: "folder",
          parentId,
          content: null,
          createdAt: now,
          updatedAt: now,
        };
        nodes.push(existing);
      }
      parentId = existing.id;
    }

    // Create the final node
    const finalName = parts[parts.length - 1];
    const existing = nodes.find((n) => n.parentId === parentId && n.name === finalName);
    if (existing) {
      // If it already exists and is a file, update content
      if (existing.type === "file" && type === "file") {
        existing.content = content;
        existing.updatedAt = Date.now();
        await saveAll(nodes);
        return existing;
      }
      // If folder already exists, just return it
      if (existing.type === "folder" && type === "folder") return existing;
      throw new Error(`"${finalName}" 已存在且类型不同`);
    }

    if (type === "file" && content.length > MAX_FILE_SIZE) {
      throw new Error(`文件内容不能超过 ${MAX_FILE_SIZE / 1024} KB`);
    }

    const now = Date.now();
    const node: VFSNode = {
      id: generateId(),
      name: finalName,
      type,
      parentId,
      content: type === "file" ? content : null,
      createdAt: now,
      updatedAt: now,
    };
    nodes.push(node);
    await saveAll(nodes);
    return node;
  },

  /** Update content and/or name of a node. */
  async update(
    id: string,
    params: { name?: string; content?: string },
  ): Promise<VFSNode> {
    const nodes = await loadAll();
    const node = nodes.find((n) => n.id === id);
    if (!node) throw new Error("文件或文件夹不存在");

    if (params.name !== undefined) {
      const trimmed = params.name.trim();
      if (!trimmed || trimmed.includes("/")) {
        throw new Error("名称不能为空且不能包含 /");
      }
      // Check duplicate in same parent
      if (
        nodes.some(
          (n) => n.parentId === node.parentId && n.name === trimmed && n.id !== id,
        )
      ) {
        throw new Error(`"${trimmed}" 已存在`);
      }
      node.name = trimmed;
    }

    if (params.content !== undefined && node.type === "file") {
      if (params.content.length > MAX_FILE_SIZE) {
        throw new Error(`文件内容不能超过 ${MAX_FILE_SIZE / 1024} KB`);
      }
      node.content = params.content;
    }

    node.updatedAt = Date.now();
    await saveAll(nodes);
    return node;
  },

  /** Delete a node. Recursively deletes descendants for folders. */
  async remove(id: string): Promise<number> {
    const nodes = await loadAll();
    const node = nodes.find((n) => n.id === id);
    if (!node) throw new Error("文件或文件夹不存在");

    const toDelete = collectDescendants(nodes, id);
    const remaining = nodes.filter((n) => !toDelete.has(n.id));
    await saveAll(remaining);
    return toDelete.size;
  },

  /** Get the full path string for a node (e.g. "/notes/todo.txt"). */
  async getPath(id: string | null): Promise<string> {
    if (id === null) return "/";
    const ancestors = await this.getAncestors(id);
    return "/" + ancestors.map((n) => n.name).join("/");
  },

  /** Get ancestor chain from root to this node (inclusive). */
  async getAncestors(id: string | null): Promise<VFSNode[]> {
    if (id === null) return [];
    const nodes = await loadAll();
    const chain: VFSNode[] = [];
    let current: VFSNode | undefined = nodes.find((n) => n.id === id);
    while (current) {
      chain.unshift(current);
      if (current.parentId === null) break;
      current = nodes.find((n) => n.id === current!.parentId);
    }
    return chain;
  },

  /** Count direct children of a folder. */
  async countChildren(parentId: string): Promise<number> {
    const nodes = await loadAll();
    return nodes.filter((n) => n.parentId === parentId).length;
  },
};
