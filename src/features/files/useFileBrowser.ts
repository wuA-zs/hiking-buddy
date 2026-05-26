import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { vfs } from "../../services/vfs";
import type { VFSNode } from "../../services/vfs-types";

export function useFileBrowser() {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<VFSNode[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<VFSNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFile, setEditingFile] = useState<VFSNode | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editDirty, setEditDirty] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [creating, setCreating] = useState<"file" | "folder" | null>(null);
  const [newName, setNewName] = useState("");

  const loadFolder = useCallback(async (folderId: string | null) => {
    setLoading(true);
    try {
      const children = await vfs.list(folderId);
      const ancestors = await vfs.getAncestors(folderId);
      setNodes(children);
      setBreadcrumbs(ancestors);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!editingFile) {
        loadFolder(currentFolderId);
      }
    }, [currentFolderId, editingFile, loadFolder]),
  );

  useEffect(() => {
    loadFolder(currentFolderId);
  }, [currentFolderId, loadFolder]);

  const navigateTo = useCallback((folderId: string | null) => {
    setEditingFile(null);
    setEditDirty(false);
    setCurrentFolderId(folderId);
  }, []);

  const openFile = useCallback((file: VFSNode) => {
    setEditingFile(file);
    setEditContent(file.content ?? "");
    setEditDirty(false);
  }, []);

  const closeEditor = useCallback(() => {
    if (!editDirty) {
      setEditingFile(null);
      return;
    }

    Alert.alert("未保存的更改", "关闭编辑器将丢失未保存的更改。", [
      { text: "取消", style: "cancel" },
      {
        text: "不保存",
        style: "destructive",
        onPress: () => {
          setEditingFile(null);
          setEditDirty(false);
        },
      },
    ]);
  }, [editDirty]);

  const saveFile = useCallback(async () => {
    if (!editingFile) return;
    try {
      await vfs.update(editingFile.id, { content: editContent });
      setEditDirty(false);
      const updated = await vfs.getById(editingFile.id);
      if (updated) setEditingFile(updated);
      loadFolder(currentFolderId);
    } catch (err) {
      Alert.alert("保存失败", (err as Error).message);
    }
  }, [currentFolderId, editContent, editingFile, loadFolder]);

  const handleCreate = useCallback((type: "file" | "folder") => {
    setCreating(type);
    setNewName("");
  }, []);

  const cancelCreate = useCallback(() => {
    setCreating(null);
    setNewName("");
  }, []);

  const confirmCreate = useCallback(async () => {
    if (!creating || !newName.trim()) return;
    try {
      await vfs.create({
        name: newName.trim(),
        type: creating,
        parentId: currentFolderId,
        content: creating === "file" ? "" : undefined,
      });
      cancelCreate();
      loadFolder(currentFolderId);
    } catch (err) {
      Alert.alert("创建失败", (err as Error).message);
    }
  }, [cancelCreate, creating, currentFolderId, loadFolder, newName]);

  const startRename = useCallback((node: VFSNode) => {
    setRenamingId(node.id);
    setRenameText(node.name);
  }, []);

  const confirmRename = useCallback(async () => {
    if (!renamingId || !renameText.trim()) return;
    try {
      await vfs.update(renamingId, { name: renameText.trim() });
      setRenamingId(null);
      setRenameText("");
      loadFolder(currentFolderId);
    } catch (err) {
      Alert.alert("重命名失败", (err as Error).message);
    }
  }, [currentFolderId, loadFolder, renameText, renamingId]);

  const confirmDelete = useCallback((node: VFSNode) => {
    const message = node.type === "folder"
      ? `确定要删除文件夹 "${node.name}" 及其所有内容吗？`
      : `确定要删除 "${node.name}" 吗？`;

    Alert.alert("删除确认", message, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await vfs.remove(node.id);
            loadFolder(currentFolderId);
          } catch (err) {
            Alert.alert("删除失败", (err as Error).message);
          }
        },
      },
    ]);
  }, [currentFolderId, loadFolder]);

  const handleLongPress = useCallback((node: VFSNode) => {
    Alert.alert(node.name, undefined, [
      { text: "重命名", onPress: () => startRename(node) },
      { text: "删除", style: "destructive", onPress: () => confirmDelete(node) },
      { text: "取消", style: "cancel" },
    ]);
  }, [confirmDelete, startRename]);

  const updateEditContent = useCallback((value: string) => {
    setEditContent(value);
    setEditDirty(true);
  }, []);

  return {
    currentFolderId,
    nodes,
    breadcrumbs,
    loading,
    editingFile,
    editContent,
    editDirty,
    renamingId,
    renameText,
    creating,
    newName,
    setRenameText,
    setNewName,
    navigateTo,
    openFile,
    closeEditor,
    saveFile,
    handleCreate,
    cancelCreate,
    confirmCreate,
    startRename,
    confirmRename,
    confirmDelete,
    handleLongPress,
    updateEditContent,
  };
}
