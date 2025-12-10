# Plinth Visual Gap Fix

## Problem Summary

The HD Cabinet plinth (bottom panel) was causing visual issues:

1. **Separate black block** - Plinth rendered as black instead of housing color
2. **Step-back offset** - Plinth set back (-0.02 Z) creating a visual gap
3. **Reduced depth** - Plinth depth was `depth - 0.05`, not flush with cabinet
4. **Visual disconnect** - Cabinet looked "short" with visible gaps even at 100% fill

## Root Causes

### 1. **Hardcoded Black Material**
```typescript
// ❌ BEFORE
const bottomShellMaterial = isGhost 
  ? <meshStandardMaterial color="#1a1a1a" transparent opacity={0.05} /> 
  : <meshStandardMaterial color="#1a1a1a" roughness={0.8} />;
```
The plinth used a separate material hardcoded to black (`#1a1a1a`), ignoring the housing color selection.

### 2. **Step-Back Positioning**
```typescript
// ❌ BEFORE
<mesh position={[0, bottomShellHeight/2, -0.02]} castShadow={!isGhost} receiveShadow>
   <boxGeometry args={[width, bottomShellHeight, depth - 0.05]} />
   {bottomShellMaterial}
</mesh>
```
- Z position: `-0.02` (pushed back 20mm)
- Depth: `depth - 0.05` (50mm shorter)

This created a visible step-back and made the cabinet appear disconnected.

## Solution Implemented

### 1. **Unified Material System**
```typescript
// ✅ AFTER
// Single material for entire cabinet body
const shellMaterial = isGhost 
  ? <meshStandardMaterial color={frameColor} transparent opacity={0.05} roughness={0.1} depthWrite={false} /> 
  : <meshStandardMaterial color={frameColor} roughness={0.5} />;
```

Now the **entire cabinet** (top, bottom, sides, back) uses the **housing color** from the configuration.

### 2. **Flush Front Alignment**
```typescript
// ✅ AFTER
{/* Bottom Shell Panel / Plinth (60% - thicker) - FLUSH with cabinet front */}
<mesh position={[0, bottomShellHeight/2, 0]} castShadow={!isGhost} receiveShadow>
   <boxGeometry args={[width, bottomShellHeight, depth]} />
   {shellMaterial}
</mesh>
```

Changes:
- Z position: `0` (flush with cabinet front)
- Depth: `depth` (full depth, same as top panel)
- Material: `shellMaterial` (housing color)

## Visual Comparison

### Before (❌):
```
┌─────────────────┐ ← Top (grey housing)
│                 │
│   Empty Gap     │ ← Visual gap even at 100%
│                 │
├─────────────────┤ ← Drawer fronts
│█████████████████│ ← Black plinth (stepped back)
└─────────────────┘
```

### After (✅):
```
┌─────────────────┐ ← Top (housing color)
├─────────────────┤ ← Drawer fronts fill cavity
├─────────────────┤
├─────────────────┤ ← Bottom drawer flush with plinth
█████████████████   ← Plinth (same housing color, flush)
```

## Test Cases

### Test 1: Housing Color Applied to Entire Cabinet
1. Select HD Cabinet
2. Choose any housing color (e.g., Light Blue)
3. **Expected**: Entire cabinet (including plinth) is light blue
4. **Before**: Plinth stayed black ❌
5. **After**: Plinth matches housing color ✅

### Test 2: 100% Fill Configuration (525mm)
1. Select 660mm cabinet (525mm usable)
2. Add: 300mm + 225mm = 525mm (exact fill)
3. **Expected**: No gaps at top or bottom
4. **Before**: Visible gap at top, plinth stepped back ❌
5. **After**: Drawers fill cavity perfectly ✅

### Test 3: Front Face Alignment
1. View cabinet from front
2. **Expected**: Plinth front flush with cabinet front
3. **Before**: Plinth stepped back 20mm ❌
4. **After**: Plinth flush ✅

### Test 4: Partial Fill (300mm only in 525mm cavity)
1. Add single 300mm drawer
2. **Expected**: 
   - 300mm drawer at bottom
   - 225mm empty space at top
   - Plinth visible below drawer
3. **Before**: Weird black step-back at bottom ❌
4. **After**: Clean plinth base, housing color ✅

## Cabinet Anatomy (After Fix)

```
┌──────────────────────────┐
│   Top Shell (40mm)       │ ← Housing Color
├──────────────────────────┤
│                          │
│   Internal Cavity        │ ← Drawer stack fills this
│   (525mm usable)         │
│                          │
├──────────────────────────┤
█  Bottom Shell/Plinth     █ ← Housing Color (60mm)
█  (60mm - thicker)        █
└──────────────────────────┘
```

## Files Modified

1. **`components/Viewer3D.tsx`** (Lines 266-345)
   - Removed separate `bottomShellMaterial` variable
   - Applied unified `shellMaterial` to plinth
   - Fixed plinth position: Z=0 (flush)
   - Fixed plinth depth: full depth (not reduced)

## Related Fixes

This fix works in conjunction with:
- **DRAWER_RENDERING_FIX.md** - Proper drawer height rendering
- Previous shell thickness fix (60/40 split)

## Acceptance Criteria

✅ **Plinth uses housing color** - Not hardcoded black  
✅ **Plinth flush with cabinet front** - No step-back  
✅ **Full depth plinth** - Same depth as rest of cabinet  
✅ **Visual continuity** - Cabinet reads as single unified volume  
✅ **No top gap at 100% fill** - Drawers fill cavity completely  
✅ **Proper stacking** - Bottom drawer sits on plinth line  

## Technical Notes

### Why 60/40 Split?
- **Bottom (60%)**: Heavier base provides visual stability and structural realism
- **Top (40%)**: Lighter top cap aligns with typical cabinet construction

### Material Consistency
All cabinet panels now use the **same material**:
- `color: frameColor` (from housing color selection)
- `roughness: 0.5`
- `metalness: 0` (implicit default)

This creates visual unity and allows the housing color picker to affect the entire cabinet as expected.
