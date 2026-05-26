import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useTheme, Spacing, FontSize, Radius, Shadows } from "../src/lib/theme";
import { AppIcon } from "../src/components/AppIcon";
import { vfs } from "../src/services/vfs";
import type { VFSNode } from "../src/services/vfs-types";

export default function FilesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: Colors, isDark } = useTheme();

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<VFSNode[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<VFSNode[]>([]);
  const [loading, setLoading] = useState(true);

  // Editor state
  const [editingFile, setEditingFile] = useState<VFSNode | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editDirty, setEditDirty] = useState(false);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");

  // Create dialog
  const [creating, setCreating] = useState<"file" | "folder" | null>(null);
  const [newName, setNewName] = useState("");

  // Load current folder contents
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

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      // Close editor if navigating back
      if (!editingFile) {
        loadFolder(currentFolderId);
      }
    }, [currentFolderId, editingFile, loadFolder]),
  );

  // Initial load
  useEffect(() => {
    loadFolder(currentFolderId);
  }, [currentFolderId, loadFolder]);

  // --- Actions ---

  function navigateTo(folderId: string | null) {
    setEditingFile(null);
    setEditDirty(false);
    setCurrentFolderId(folderId);
  }

  function openFile(file: VFSNode) {
    setEditingFile(file);
    setEditContent(file.content ?? "");
    setEditDirty(false);
  }

  function closeEditor() {
    if (editDirty) {
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
    } else {
      setEditingFile(null);
    }
  }

  async function saveFile() {
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
  }

  function handleCreate(type: "file" | "folder") {
    setCreating(type);
    setNewName("");
  }

  async function confirmCreate() {
    if (!creating || !newName.trim()) return;
    try {
      await vfs.create({
        name: newName.trim(),
        type: creating,
        parentId: currentFolderId,
        content: creating === "file" ? "" : undefined,
      });
      setCreating(null);
      setNewName("");
      loadFolder(currentFolderId);
    } catch (err) {
      Alert.alert("创建失败", (err as Error).message);
    }
  }

  function startRename(node: VFSNode) {
    setRenamingId(node.id);
    setRenameText(node.name);
  }

  async function confirmRename() {
    if (!renamingId || !renameText.trim()) return;
    try {
      await vfs.update(renamingId, { name: renameText.trim() });
      setRenamingId(null);
      setRenameText("");
      loadFolder(currentFolderId);
    } catch (err) {
      Alert.alert("重命名失败", (err as Error).message);
    }
  }

  function confirmDelete(node: VFSNode) {
    const msg =
      node.type === "folder"
        ? `确定要删除文件夹"${node.name}"及其所有内容吗？`
        : `确定要删除"${node.name}"吗？`;
    Alert.alert("删除确认", msg, [
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
  }

  function handleLongPress(node: VFSNode) {
    Alert.alert(node.name, undefined, [
      { text: "重命名", onPress: () => startRename(node) },
      {
        text: "删除",
        style: "destructive",
        onPress: () => confirmDelete(node),
      },
      { text: "取消", style: "cancel" },
    ]);
  }

  // --- Render ---

  function renderItem({ item }: { item: VFSNode }) {
    const isRenaming = renamingId === item.id;

    return (
      <TouchableOpacity
        style={[styles.itemRow, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
        onPress={() =>
          item.type === "folder" ? navigateTo(item.id) : openFile(item)
        }
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.6}
      >
        <Text style={styles.itemIcon}>
          {item.type === "folder" ? "📁" : "📄"}
        </Text>

        {isRenaming ? (
          <TextInput
            style={[styles.itemNameInput, { color: Colors.textPrimary, borderColor: Colors.primary }]}
            value={renameText}
            onChangeText={setRenameText}
            autoFocus
            onSubmitEditing={confirmRename}
            onBlur={confirmRename}
            returnKeyType="done"
          />
        ) : (
          <View style={styles.itemInfo}>
            <Text
              style={[styles.itemName, { color: Colors.textPrimary }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text style={[styles.itemMeta, { color: Colors.textTertiary }]}>
              {item.type === "folder"
                ? new Date(item.updatedAt).toLocaleDateString("zh-CN")
                : `${(item.content?.length ?? 0)} 字节`}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // File editor view
  if (editingFile) {
    return (
      <View style={[styles.container, { backgroundColor: Colors.bg }]}>
        <StatusBar style={isDark ? "light" : "dark"} />

        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, backgroundColor: Colors.bg }]}>
          <TouchableOpacity
            onPress={closeEditor}
            style={styles.headerBtn}
            accessibilityLabel="返回"
          >
            <AppIcon name="arrow-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: Colors.textPrimary }]} numberOfLines={1}>
              {editingFile.name}
            </Text>
          </View>
          <TouchableOpacity
            onPress={saveFile}
            style={[
              styles.saveBtn,
              {
                backgroundColor: editDirty ? Colors.primary : Colors.border,
              },
            ]}
            disabled={!editDirty}
          >
            <Text
              style={[
                styles.saveBtnText,
                { color: editDirty ? Colors.textOnPrimary : Colors.textTertiary },
              ]}
            >
              保存
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={[styles.editor, { color: Colors.textPrimary, backgroundColor: Colors.surface }]}
          value={editContent}
          onChangeText={(t) => {
            setEditContent(t);
            setEditDirty(true);
          }}
          multiline
          autoFocus
          textAlignVertical="top"
          placeholder="输入内容..."
          placeholderTextColor={Colors.textTertiary}
        />
      </View>
    );
  }

  // File browser view
  return (
    <View style={[styles.container, { backgroundColor: Colors.bg }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, backgroundColor: Colors.bg }]}>
        <TouchableOpacity
          onPress={() =>
            currentFolderId === null ? router.back() : navigateTo(
              breadcrumbs.length > 1
                ? breadcrumbs[breadcrumbs.length - 2].id
                : null,
            )
          }
          style={styles.headerBtn}
          accessibilityLabel="返回"
        >
          <AppIcon name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.kicker, { color: Colors.textTertiary }]}>
            文件管理
          </Text>
          <Text style={[styles.headerTitle, { color: Colors.textPrimary }]}>
            {breadcrumbs.length > 0
              ? breadcrumbs[breadcrumbs.length - 1].name
              : "我的文件"}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => handleCreate("folder")}
            style={[styles.headerBtn, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
            accessibilityLabel="新建文件夹"
          >
            <Text style={{ fontSize: 16 }}>📁</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleCreate("file")}
            style={[styles.headerBtn, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
            accessibilityLabel="新建文件"
          >
            <Text style={{ fontSize: 16 }}>📄</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Breadcrumb */}
      {breadcrumbs.length > 0 && (
        <View style={[styles.breadcrumb, { borderBottomColor: Colors.divider }]}>
          <TouchableOpacity onPress={() => navigateTo(null)}>
            <Text style={[styles.breadcrumbItem, { color: Colors.primary }]}>
              根目录
            </Text>
          </TouchableOpacity>
          {breadcrumbs.map((node) => (
            <React.Fragment key={node.id}>
              <Text style={{ color: Colors.textTertiary, marginHorizontal: 4 }}>
                /
              </Text>
              <TouchableOpacity
                onPress={() => navigateTo(node.id)}
              >
                <Text
                  style={[
                    styles.breadcrumbItem,
                    {
                      color:
                        node.id === currentFolderId
                          ? Colors.textPrimary
                          : Colors.primary,
                    },
                  ]}
                >
                  {node.name}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      )}

      {/* Create dialog */}
      {creating && (
        <View style={[styles.createBar, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
          <Text style={{ fontSize: 14 }}>
            {creating === "folder" ? "📁" : "📄"}
          </Text>
          <TextInput
            style={[styles.createInput, { color: Colors.textPrimary, borderColor: Colors.border }]}
            value={newName}
            onChangeText={setNewName}
            placeholder={creating === "folder" ? "文件夹名称" : "文件名称"}
            placeholderTextColor={Colors.textTertiary}
            autoFocus
            onSubmitEditing={confirmCreate}
            returnKeyType="done"
          />
          <TouchableOpacity onPress={confirmCreate} style={[styles.createConfirm, { backgroundColor: Colors.primary }]}>
            <Text style={{ color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: "600" }}>
              确定
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setCreating(null)}
            style={{ paddingLeft: Spacing.sm }}
          >
            <Text style={{ color: Colors.textTertiary, fontSize: FontSize.sm }}>
              取消
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* File list */}
      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : nodes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ color: Colors.textTertiary, fontSize: FontSize.md }}>
            空文件夹
          </Text>
          <Text style={{ color: Colors.textTertiary, fontSize: FontSize.sm, marginTop: Spacing.xs }}>
            点击右上角按钮创建文件或文件夹
          </Text>
        </View>
      ) : (
        <FlatList
          data={nodes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: Spacing.sm }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  headerBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: Radius.full,
  },
  headerTitleWrap: {
    flex: 1,
  },
  kicker: {
    fontSize: FontSize.xs,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 1,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: "800",
  },
  headerActions: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  saveBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
  },
  saveBtnText: {
    fontSize: FontSize.sm,
    fontWeight: "700",
  },
  breadcrumb: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
  },
  breadcrumbItem: {
    fontSize: FontSize.sm,
    fontWeight: "500",
  },
  createBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
    gap: Spacing.xs,
  },
  createInput: {
    flex: 1,
    fontSize: FontSize.md,
    paddingVertical: Spacing.xs,
    borderWidth: 0,
  },
  createConfirm: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.xs / 2,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  itemIcon: {
    fontSize: 20,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  itemNameInput: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: "600",
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  itemMeta: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  editor: {
    flex: 1,
    fontSize: FontSize.md,
    lineHeight: 22,
    padding: Spacing.md,
    margin: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 0,
    textAlignVertical: "top",
  },
});
