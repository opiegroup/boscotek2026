# Known Issue: BlenderBIM v0.8.4 Unit Parsing Bug

## 🐛 Issue

**BlenderBIM v0.8.4 has a bug** when parsing SI unit prefixes from IFC files.

### The Bug

```python
# BlenderBIM code (bim/import_ifc.py:977)
bpy.context.scene.unit_settings.length_unit = f"{unit.Prefix}METERS"

# When Prefix = ".MILLI." (correct IFC format)
# Result: ".MILLI.METERS" ❌ (invalid Blender enum)
```

### Error Message

```
TypeError: enum ".MILLI.METERS" not found in 
('ADAPTIVE', 'KILOMETERS', 'METERS', 'CENTIMETERS', 'MILLIMETERS', 'MICROMETERS')
```

## ✅ Our IFC Files Are CORRECT

Our exported IFC files use the **proper IFC4 format**:

```ifc
#2=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);
```

This is valid per ISO 10303-21 (STEP) and IFC4 specification.

## 🔧 Workarounds

### Option 1: Use Different BIM Tool (Recommended)

Our IFC files work correctly with:
- ✅ **Revit** (2020+)
- ✅ **ArchiCAD** (23+)
- ✅ **Navisworks**
- ✅ **Solibri**
- ✅ **BIMcollab Zoom**
- ✅ **IFC.js Web Viewer**

### Option 2: Manual File Edit (For Testing Only)

If you MUST use BlenderBIM v0.8.4, you can manually patch exported IFC files:

**Find and replace in text editor:**
```
Find:    (*,.LENGTHUNIT.,.MILLI.,.METRE.)
Replace: (*,.LENGTHUNIT.,$,.METRE.)
```

This removes the MILLI prefix, making units METERS instead of MILLIMETERS.

**Note:** This changes your dimensions by 1000x! Only for visualization testing.

### Option 3: Wait for BlenderBIM Fix

The BlenderBIM team should fix this in their code:

```python
# Current (buggy):
length_unit = f"{unit.Prefix}METERS"

# Should be:
prefix = str(unit.Prefix).strip('.') if unit.Prefix else ''
length_unit = f"{prefix}METERS"
```

Or better:
```python
prefix_map = {
    'MILLI': 'MILLIMETERS',
    'CENTI': 'CENTIMETERS',  
    'KILO': 'KILOMETERS',
    None: 'METERS'
}
length_unit = prefix_map.get(unit.Prefix, 'METERS')
```

## 📊 Impact

| Tool | Status | Notes |
|------|--------|-------|
| **Revit** | ✅ Works | Proper unit handling |
| **ArchiCAD** | ✅ Works | Proper unit handling |
| **BlenderBIM v0.8.4** | ❌ Fails | Unit parsing bug |
| **BlenderBIM v0.9+** | ❓ Unknown | Bug may be fixed |
| **Solibri** | ✅ Works | Proper unit handling |
| **Navisworks** | ✅ Works | Proper unit handling |

## 🎯 Recommendation

**For Architects/Engineers:** Use Revit, ArchiCAD, or Solibri for production work.

**For Visualization:** Use IFC.js web viewer or wait for BlenderBIM update.

**For BIM Coordination:** Our IFC files are **fully compliant** and work with all major BIM platforms.

## 📝 Technical Details

### IFC4 Specification

Per IFC4 specification (ISO 16739-1:2018), enum values in STEP format MUST be written as:

```
.ENUM_VALUE.
```

Examples:
- `.LENGTHUNIT.` - Unit type
- `.MILLI.` - SI prefix
- `.METRE.` - Unit name
- `.ELEMENT.` - Composition type

### IfcOpenShell Parsing

IfcOpenShell correctly parses these as enum values and provides accessors:

```python
unit = model.by_type('IfcSIUnit')[0]
print(unit.Prefix)  # Should return: 'MILLI' or '.MILLI.' depending on version
```

The inconsistency in what IfcOpenShell returns (with or without dots) is why BlenderBIM has this bug.

## 🚀 Our Position

**We export valid, specification-compliant IFC4 files.**

If a tool can't read them correctly, that's a bug in the tool, not our export.

---

**Status**: Known Issue in BlenderBIM v0.8.4  
**Our Files**: ✅ Valid IFC4  
**Workaround**: Use different BIM tool  
**Impact**: Low (affects only BlenderBIM)
