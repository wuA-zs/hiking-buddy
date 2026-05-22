# DTO Component Mode

## Scope
This document covers `DTO Component` mode only.

## When to Use
- The user has provided a DTO (data transfer object)
- The user wants a component / card (not a full page)

## Deliverables
1. Python transformer code (`*_transformer.py`)
2. `updateComponents` JSON
3. `updateDataModel` JSON

## Unified Entry Function
All Python transformers must use this entry point:

```python
def build_component_payload_from_dto(dto: dict) -> tuple[dict, dict]:
    """
    Args:
        dto: raw data transfer object (dict)

    Returns:
        tuple of (updateComponents_dict, updateDataModel_dict)
    """
    ...
```

## DTO Discipline

### Required vs Optional Fields
- Explicitly layer fields into required / optional
- Design the layout-collapse path for when optional fields are missing
- When a secondary field is missing, prefer omitting the corresponding component rather than leaving an empty placeholder
- When a key field for an entire section is missing, prefer omitting the entire section
- The final card should remain complete and compact — missing fields must not leave visible blank gaps

### Semantic Validity Check
- DTO fields must pass a semantic validity check before display; non-empty does not equal informative
- When semantic meaning depends on a combination of fields (e.g., status + time), perform the combination mapping first, then decide whether to display or omit
- Low-information-value fields (generic / section words) should be filtered or downgraded

### Compatibility
- The Python must be compatible with more DTOs of the same type, not just tailored to one sample
- Do not build layout on the assumption that "every field happens to exist and every text happens to be short"
- When text length is uncertain, the structure must leave room for wrapping, truncation, and fallback layouts

## Common Combined Fields
- `openStatus/openStatusCode/status/openTime/*` should be combined into readable status copy, not single-field output
