/**
 * Virtual File System — type definitions
 */

export interface VFSNode {
  id: string;
  name: string;
  type: "file" | "folder";
  parentId: string | null; // null = root level
  content: string | null; // non-null only for type="file"
  createdAt: number;
  updatedAt: number;
}
