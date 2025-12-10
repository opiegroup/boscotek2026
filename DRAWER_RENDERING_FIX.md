# Drawer Height Rendering Fix

## Problem Summary

Previously, the configurator was **scaling drawers to fill 100% of the cabinet cavity**, which meant:
- A single 75mm drawer would stretch to fill the entire 750mm cavity
- Drawers did not maintain their nominal heights
- Visual representation was misleading

## Solution Implemented

### 1. **Removed Auto-Scaling Logic**

**Before (❌ INCORRECT):**
```typescript
// Calculate scale factor to fill 100% of aperture
const scaleFactor = totalNominalHeight > 0 ? apertureHeight / totalNominalHeight : 1;
const scaledHeight = nominalHeight * scaleFactor; // ❌ Stretched to fill cavity
```

**After (✅ CORRECT):**
```typescript
// Use ACTUAL nominal heights - no scaling
const heightMeters = d.heightMm / 1000;
stack.push({
   ...d,
   height: heightMeters, // ✅ Maintains true nominal height
   y: yPosition,
   originalIndex: d.originalIndex
});
```

### 2. **Proper Bottom-Up Stacking**

Drawers now stack from the **bottom of the internal cavity** upward:

```typescript
let currentOffsetMm = 0; // Start at 0mm from internal bottom

for (let i = 0; i < sortedDrawers.length; i++) {
   const d = sortedDrawers[i];
   const heightMeters = d.heightMm / 1000;
   
   // Position = bottom shell + current offset + half height (for center)
   const yPosition = bottomShellHeight + (currentOffsetMm / 1000) + (heightMeters / 2);
   
   stack.push({ ...d, height: heightMeters, y: yPosition, originalIndex: d.originalIndex });
   
   currentOffsetMm += d.heightMm; // Accumulate
}
```

### 3. **Auto-Sort: Largest to Smallest (Bottom to Top)**

Drawers are automatically sorted with:
- **Largest drawers at the bottom** (Index 0 in render stack)
- **Smallest drawers at the top** (Index N in render stack)

```typescript
// Sort by height DESC (largest first) for bottom-to-top stacking
const sortedDrawers = [...drawersWithHeights].sort((a, b) => b.heightMm - a.heightMm);
```

### 4. **Height Validation**

The UI (`DrawerStackBuilder` component) already enforces:
- Block adding drawers if `sum(drawer heights) > usable cavity height`
- Show remaining capacity in real-time
- Visual progress bar turns red when exceeded

### 5. **Shell Thickness Adjustment (60/40 Split)**

Also fixed the cabinet shell proportions:
```typescript
const totalShellThickness = 0.1;           // 100mm total
const bottomShellHeight = 0.06;            // 60mm (60%)
const topShellHeight = 0.04;               // 40mm (40%)
```

## Drawer Height Mapping Examples

For a **750mm usable height cabinet**:

| Drawer Size | Visual Height | Percentage |
|-------------|--------------|------------|
| 75mm        | 75mm         | 10%        |
| 100mm       | 100mm        | 13.3%      |
| 150mm       | 150mm        | 20%        |
| 225mm       | 225mm        | 30%        |
| 300mm       | 300mm        | 40%        |

### Example Stacks (750mm cabinet):

**Stack 1:** Single 75mm drawer
- Drawer renders as 75mm at bottom
- 675mm of empty space above ✅

**Stack 2:** 300mm + 150mm + 150mm + 150mm = 750mm (exact fill)
- 300mm drawer at bottom
- 150mm drawer above
- 150mm drawer above
- 150mm drawer at top
- 0mm empty space ✅

**Stack 3:** 225mm + 225mm + 150mm = 600mm
- 225mm drawer at bottom
- 225mm drawer above
- 150mm drawer at top
- 150mm empty space above ✅

## Key Behavioral Rules

✅ **Drawers maintain nominal heights** - No stretching or scaling  
✅ **Bottom-anchored stacking** - First drawer sits flush on internal floor  
✅ **Auto-sorted** - Largest always at bottom, smallest at top  
✅ **Height validation** - Cannot exceed usable cavity height  
✅ **Empty space allowed** - Top cavity can be unfilled  
✅ **No visual gaps** - Drawers stack with zero spacing between faces  

## Files Modified

1. **`components/Viewer3D.tsx`** (Lines 266-340)
   - Removed scaling logic
   - Implemented true nominal height rendering
   - Fixed bottom-up positioning
   - Added auto-sort DESC for rendering

2. **Shell thickness adjusted** (Lines 267-275)
   - Bottom shell: 60mm (60%)
   - Top shell: 40mm (40%)

## Testing Checklist

- [ ] Single 75mm drawer appears small at bottom (not stretched)
- [ ] Multiple drawers stack correctly with largest at bottom
- [ ] Empty space visible at top when not filled
- [ ] Cannot add drawer that exceeds capacity
- [ ] Drawers maintain proportions when switching cabinet heights
- [ ] Embedded cabinets also follow same logic
- [ ] Drawer interiors render correctly at actual heights

## Related Components

- `services/drawerUtils.ts` - Validation and sorting helpers
- `components/ConfiguratorControls.tsx` - UI validation and controls
- `types.ts` - DrawerConfiguration interface
