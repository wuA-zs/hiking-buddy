import React from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "../src/components/AppIcon";
import { FontSize, Radius, Shadows, Spacing, useTheme } from "../src/lib/theme";
import type { VFSNode } from "../src/services/vfs-types";
import { useFileBrowser } from "../src/features/files";

export default function FilesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: Colors, isDark } = useTheme();
  const files = useFileBrowser();

  function renderItem({ item }: { item: VFSNode }) {
    const isRenaming = files.renamingId === item.id;

    return (
      <TouchableOpacity
        style={[styles.itemRow, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
        onPress={() => (item.type === "folder" ? files.navigateTo(item.id) : files.openFile(item))}
        onLongPress={() => files.handleLongPress(item)}
        activeOpacity={0.7}
      >
        <AppIcon
          name={item.type === "folder" ? "chevron-forward-outline" : "chatbubble-ellipses-outline"}
          size={19}
          color={Colors.primary}
        />
        {isRenaming ? (
          <TextInput
            style={[styles.itemNameInput, { color: Colors.textPrimary, borderColor: Colors.primary }]}
            value={files.renameText}
            onChangeText={files.setRenameText}
            autoFocus
            onSubmitEditing={files.confirmRename}
            onBlur={files.confirmRename}
            returnKeyType="done"
          />
        ) : (
          <View style={styles.itemTextWrap}>
            <Text style={[styles.itemName, { color: Colors.textPrimary }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.itemMeta, { color: Colors.textTertiary }]}>
              {item.type === "folder" ? "文件夹" : `${item.content?.length ?? 0} 字符`}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: Colors.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, backgroundColor: Colors.bg }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.iconBtn, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
          accessibilityLabel="返回"
          accessibilityRole="button"
        >
          <AppIcon name="arrow-back" size={19} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.kicker, { color: Colors.textTertiary }]}>Files</Text>
          <Text style={[styles.title, { color: Colors.textPrimary }]}>文件</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => files.handleCreate("folder")}
            style={[styles.iconBtn, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
            accessibilityLabel="新建文件夹"
            accessibilityRole="button"
          >
            <AppIcon name="chevron-up" size={18} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => files.handleCreate("file")}
            style={[styles.iconBtn, { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
            accessibilityLabel="新建文件"
            accessibilityRole="button"
          >
            <AppIcon name="checkmark-circle-outline" size={18} color={Colors.textOnPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.breadcrumbs}>
        <TouchableOpacity onPress={() => files.navigateTo(null)}>
          <Text style={[styles.breadcrumbText, { color: Colors.primary }]}>根目录</Text>
        </TouchableOpacity>
        {files.breadcrumbs.map((crumb) => (
          <React.Fragment key={crumb.id}>
            <Text style={[styles.breadcrumbText, { color: Colors.textTertiary }]}>/</Text>
            <TouchableOpacity onPress={() => files.navigateTo(crumb.id)}>
              <Text style={[styles.breadcrumbText, { color: Colors.primary }]} numberOfLines={1}>
                {crumb.name}
              </Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>

      {files.editingFile ? (
        <View style={styles.editor}>
          <View style={styles.editorHeader}>
            <TouchableOpacity onPress={files.closeEditor} style={[styles.textBtn, { borderColor: Colors.border }]}>
              <Text style={[styles.textBtnLabel, { color: Colors.textSecondary }]}>关闭</Text>
            </TouchableOpacity>
            <Text style={[styles.editorTitle, { color: Colors.textPrimary }]} numberOfLines={1}>
              {files.editingFile.name}
            </Text>
            <TouchableOpacity onPress={files.saveFile} style={[styles.textBtn, { borderColor: Colors.primary, backgroundColor: Colors.primary }]}>
              <Text style={[styles.textBtnLabel, { color: Colors.textOnPrimary }]}>保存</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.editorInput, { color: Colors.textPrimary, backgroundColor: Colors.surface, borderColor: Colors.border }]}
            value={files.editContent}
            onChangeText={files.updateEditContent}
            multiline
            textAlignVertical="top"
            placeholder="写点什么..."
            placeholderTextColor={Colors.textTertiary}
          />
        </View>
      ) : files.loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={files.nodes}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={files.nodes.length === 0 ? styles.emptyList : styles.listContent}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: Colors.textTertiary }]}>这里还没有文件</Text>
          }
        />
      )}

      <Modal transparent visible={files.creating !== null} animationType="fade" onRequestClose={files.cancelCreate}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
            <Text style={[styles.modalTitle, { color: Colors.textPrimary }]}>
              新建{files.creating === "folder" ? "文件夹" : "文件"}
            </Text>
            <TextInput
              style={[styles.modalInput, { color: Colors.textPrimary, borderColor: Colors.border }]}
              value={files.newName}
              onChangeText={files.setNewName}
              autoFocus
              placeholder="名称"
              placeholderTextColor={Colors.textTertiary}
              onSubmitEditing={files.confirmCreate}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={files.cancelCreate} style={[styles.textBtn, { borderColor: Colors.border }]}>
                <Text style={[styles.textBtnLabel, { color: Colors.textSecondary }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={files.confirmCreate} style={[styles.textBtn, { borderColor: Colors.primary, backgroundColor: Colors.primary }]}>
                <Text style={[styles.textBtnLabel, { color: Colors.textOnPrimary }]}>创建</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerText: {
    flex: 1,
  },
  kicker: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    letterSpacing: 0,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: "800",
  },
  headerActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  breadcrumbs: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  breadcrumbText: {
    fontSize: FontSize.sm,
    fontWeight: "700",
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  emptyList: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  emptyText: {
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  itemRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    ...Shadows.sm,
  },
  itemTextWrap: {
    flex: 1,
  },
  itemName: {
    fontSize: FontSize.md,
    fontWeight: "700",
  },
  itemMeta: {
    marginTop: 2,
    fontSize: FontSize.xs,
    fontWeight: "600",
  },
  itemNameInput: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    fontSize: FontSize.md,
    fontWeight: "700",
  },
  editor: {
    flex: 1,
    padding: Spacing.md,
  },
  editorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  editorTitle: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: "800",
    textAlign: "center",
  },
  editorInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  textBtn: {
    minHeight: 36,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  textBtnLabel: {
    fontSize: FontSize.sm,
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: Spacing.lg,
  },
  modalContent: {
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: "800",
  },
  modalInput: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
  },
});
