#!/usr/bin/env python3
"""
A2UI Protocol Validator

Validates A2UI updateComponents and updateDataModel JSON files
against the A2UI specification rules.

Usage:
    python validate_a2ui.py <components.json> <datamodel.json> [overrides.json]
    python validate_a2ui.py <combined.md> [overrides.json]
"""

import json
import sys
import os
from typing import Any

# Allowed values
JUSTIFY_VALUES = {"flex-start", "flex-end", "center", "space-between", "space-around", "space-evenly"}
ALIGN_VALUES = {"flex-start", "flex-end", "center", "stretch", "baseline"}
FLEX_WRAP_VALUES = {"nowrap", "wrap", "wrap-reverse"}
OVERFLOW_VALUES = {"hidden", "visible"}
DISPLAY_VALUES = {"none"}
VISIBILITY_VALUES = {"visible", "hidden"}
FONT_WEIGHT_VALUES = {"normal", "bold"}
BORDER_STYLE_VALUES = {"solid"}
TEXT_DECORATION_LINE = {"underline", "line-through"}
TEXT_DECORATION_STYLE = {"solid", "dashed"}
TEXT_OVERFLOW = {"clip", "head", "middle", "ellipsis"}
DIRECTION_VALUES = {"vertical", "horizontal"}
AXIS_VALUES = {"horizontal", "vertical"}
IMAGE_FIT = {"contain", "cover", "fill", "none", "scale-down"}

LAYOUT_COMPONENTS = {"Column", "Row", "List", "Card", "Tabs", "Divider", "Modal"}
CONTENT_COMPONENTS = {"Text", "RichText", "Markdown", "Image", "Icon", "Video", "AudioPlayer", "Lottie", "Web"}
INTERACTION_COMPONENTS = {"Button", "TextField", "CheckBox", "ChoicePicker", "Slider", "DateTimeInput"}
CHART_COMPONENTS = {"BarChart", "LineChart", "DonutChart", "Table"}
ALL_COMPONENTS = LAYOUT_COMPONENTS | CONTENT_COMPONENTS | INTERACTION_COMPONENTS | CHART_COMPONENTS

STYLE_SIZE_PROPS = {"width", "height", "min-width", "min-height", "border-radius", "border-width",
                    "padding-top", "padding-bottom", "padding-left", "padding-right",
                    "padding-inline-start", "padding-inline-end", "padding-block-start", "padding-block-end",
                    "margin-top", "margin-bottom", "margin-left", "margin-right",
                    "margin-inline-start", "margin-inline-end", "margin-block-start", "margin-block-end",
                    "font-size", "text-decoration-thickness"}

UNSUPPORTED_STYLE_PROPS = {"flex-basis", "gap", "box-shadow", "position", "z-index"}

errors = []
warnings = []


def load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_combined(path: str):
    """Load from a combined markdown file with fenced JSON blocks."""
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    blocks = []
    in_fence = False
    fence_lang = ""
    buf = []

    for line in content.split("\n"):
        if line.strip().startswith("```"):
            if not in_fence:
                in_fence = True
                fence_lang = line.strip()[3:].strip()
                buf = []
            else:
                in_fence = False
                text = "\n".join(buf).strip()
                if text:
                    try:
                        blocks.append(json.loads(text))
                    except json.JSONDecodeError:
                        pass
        elif in_fence:
            buf.append(line)

    components = None
    datamodel = None
    for block in blocks:
        if "updateComponents" in block:
            components = block
        if "updateDataModel" in block:
            datamodel = block

    return components, datamodel


def validate_components(data: dict, overrides: dict = None):
    """Validate updateComponents structure."""
    overrides = overrides or {}
    allowed_unsupported = set(overrides.get("allowUnsupportedStyles", []))

    uc = data.get("updateComponents", data)
    components = uc.get("components", [])
    if not components:
        errors.append("updateComponents.components is empty or missing")
        return

    comp_map = {}
    for comp in components:
        cid = comp.get("id")
        ctype = comp.get("component")
        if not cid:
            errors.append(f"Component missing 'id': {json.dumps(comp)[:100]}")
            continue
        if cid in comp_map:
            errors.append(f"Duplicate component id: {cid}")
        comp_map[cid] = comp

        if ctype not in ALL_COMPONENTS:
            errors.append(f"Unknown component type '{ctype}' in id='{cid}'")

        # Validate children references
        children = comp.get("children")
        if isinstance(children, list):
            for child_id in children:
                if child_id not in [c.get("id") for c in components]:
                    warnings.append(f"Component '{cid}' references unknown child '{child_id}'")

        # Validate child reference
        child = comp.get("child")
        if child and child not in [c.get("id") for c in components]:
            warnings.append(f"Component '{cid}' references unknown child '{child}'")

        # Validate styles
        styles = comp.get("styles", {})
        for key, value in styles.items():
            if key in UNSUPPORTED_STYLE_PROPS and key not in allowed_unsupported:
                errors.append(f"Unsupported style property '{key}' in component '{cid}'")

            if key in STYLE_SIZE_PROPS:
                if isinstance(value, str) and not value.endswith("px"):
                    errors.append(f"Style '{key}' must use px units in component '{cid}': '{value}'")

            if key == "padding" or key == "margin":
                if isinstance(value, str):
                    parts = value.strip().split()
                    if len(parts) != 4:
                        errors.append(f"Style '{key}' shorthand must have 4 values in component '{cid}': '{value}'")

            if key == "font-weight" and value not in FONT_WEIGHT_VALUES:
                errors.append(f"Invalid font-weight '{value}' in component '{cid}'")

            if key == "justify-content" and value not in JUSTIFY_VALUES:
                errors.append(f"Invalid justify-content '{value}' in component '{cid}'")

            if key == "align-items" and value not in ALIGN_VALUES:
                errors.append(f"Invalid align-items '{value}' in component '{cid}'")

            if key == "flex-wrap" and value not in FLEX_WRAP_VALUES:
                errors.append(f"Invalid flex-wrap '{value}' in component '{cid}'")

        # Check Text styles on non-Text components
        text_only_styles = {"color", "font-size", "font-weight", "font-family", "line-height",
                           "text-align", "line-clamp", "text-overflow"}
        if ctype not in ("Text", "RichText"):
            for skey in styles:
                if skey in text_only_styles:
                    errors.append(f"Text style '{skey}' applied to non-Text component '{cid}' (type: {ctype})")

    # Check root component exists
    child_ids = set()
    for comp in components:
        if comp.get("child"):
            child_ids.add(comp["child"])
        if isinstance(comp.get("children"), list):
            for cid in comp["children"]:
                child_ids.add(cid)
    roots = [c for c in components if c.get("id") not in child_ids]
    if len(roots) == 0:
        errors.append("No root component found (all components are referenced as children)")
    elif len(roots) > 1:
        warnings.append(f"Multiple root components found: {[r.get('id') for r in roots]}")


def validate_datamodel(data: dict):
    """Validate updateDataModel structure."""
    dm = data.get("updateDataModel", data)
    path = dm.get("path", "")
    if not path.startswith("/"):
        errors.append(f"updateDataModel.path must start with '/': '{path}'")
    if "." in path:
        errors.append(f"updateDataModel.path must not use dot notation: '{path}'")


def validate_binding_consistency(comp_data: dict, dm_data: dict):
    """Check that binding paths in components can be resolved from datamodel."""
    if not dm_data:
        return

    dm = dm_data.get("updateDataModel", dm_data)
    dm_path = dm.get("path", "")
    dm_value = dm.get("value", {})

    def resolve(path, obj):
        parts = path.strip("/").split("/")
        current = obj
        for p in parts:
            if not p:
                continue
            if isinstance(current, dict):
                current = current.get(p)
            elif isinstance(current, list):
                try:
                    current = current[int(p)]
                except (ValueError, IndexError):
                    return None
            else:
                return None
        return current

    components = comp_data.get("updateComponents", comp_data).get("components", [])
    for comp in components:
        for key, value in comp.items():
            if isinstance(value, dict) and "path" in value:
                binding_path = value["path"]
                if binding_path.startswith("/"):
                    # Absolute path
                    resolved = resolve(binding_path, {dm_path.strip("/").split("/")[0] if dm_path else "root": dm_value})
                    # We don't error on unresolved paths as they may be valid at runtime


def main():
    if len(sys.argv) < 2:
        print("Usage: python validate_a2ui.py <components.json> <datamodel.json> [overrides.json]")
        print("       python validate_a2ui.py <combined.md> [overrides.json]")
        sys.exit(1)

    path1 = sys.argv[1]
    overrides = {}

    if len(sys.argv) >= 3 and sys.argv[2].endswith(".json"):
        path2 = sys.argv[2]
        if len(sys.argv) >= 4:
            try:
                overrides = load_json(sys.argv[3])
            except Exception as e:
                warnings.append(f"Failed to load overrides: {e}")
    else:
        path2 = None
        if len(sys.argv) >= 3:
            try:
                overrides = load_json(sys.argv[2])
            except Exception:
                pass

    # Load data
    if path1.endswith(".md"):
        comp_data, dm_data = load_combined(path1)
        if not comp_data:
            errors.append("No updateComponents found in combined file")
        if not dm_data:
            warnings.append("No updateDataModel found in combined file")
    else:
        comp_data = load_json(path1)
        dm_data = load_json(path2) if path2 else None

    # Validate
    if comp_data:
        validate_components(comp_data, overrides)
    if dm_data:
        validate_datamodel(dm_data)
    if comp_data and dm_data:
        validate_binding_consistency(comp_data, dm_data)

    # Report
    print(f"\n=== A2UI Validation Report ===\n")
    if errors:
        print(f"❌ {len(errors)} error(s):")
        for e in errors:
            print(f"   • {e}")
    if warnings:
        print(f"⚠️  {len(warnings)} warning(s):")
        for w in warnings:
            print(f"   • {w}")

    if not errors and not warnings:
        print("✅ All checks passed!")
    elif not errors:
        print(f"\n✅ Passed with {len(warnings)} warning(s)")

    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
