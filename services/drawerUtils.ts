import { DrawerConfiguration, DrawerInteriorOption, OptionGroup } from '../types';

// --- Drawer height helpers ---
const getDrawerHeight = (group: OptionGroup, drawerId: string): number => {
  const opt = group.options.find(o => o.id === drawerId);
  return (opt?.meta?.front as number) || 0;
};

// --- Sorting / normalization ---
export const sortDrawersByHeight = (
  drawers: DrawerConfiguration[],
  group: OptionGroup
): DrawerConfiguration[] => {
  return [...drawers].sort((a, b) => getDrawerHeight(group, a.id) - getDrawerHeight(group, b.id));
};

export const normalizeDrawerStack = (
  drawers: DrawerConfiguration[],
  group: OptionGroup
): DrawerConfiguration[] => sortDrawersByHeight(drawers, group);

// --- Capacity / usage ---
export const calculateUsedHeight = (
  drawers: DrawerConfiguration[],
  group: OptionGroup
): number => {
  return drawers.reduce((total, drawer) => total + getDrawerHeight(group, drawer.id), 0);
};

// --- Interior filtering ---
export const filterInteriorsForDrawer = (
  interiors: DrawerInteriorOption[],
  widthMm: number,
  depthType: 'S' | 'D',
  drawerHeight: number
): DrawerInteriorOption[] => {
  return interiors.filter(int => {
    if (int.isVisible === false) return false;
    if (int.width_mm !== widthMm) return false;
    if (int.depth_type !== depthType) return false;
    if (!int.supported_drawer_heights_mm.includes(drawerHeight)) return false;
    return true;
  });
};

// --- Summary text ---
export const summarizeDrawers = (
  drawers: DrawerConfiguration[],
  group: OptionGroup
): string => {
  if (!drawers.length) return 'Empty';
  const counts: Record<number, number> = {};
  let totalHeight = 0;
  drawers.forEach(d => {
    const h = getDrawerHeight(group, d.id);
    counts[h] = (counts[h] || 0) + 1;
    totalHeight += h;
  });
  const parts = Object.entries(counts)
    .sort(([h1], [h2]) => Number(h2) - Number(h1))
    .map(([h, c]) => `${c}×${h}mm`);
  return `${parts.join(', ')} (${totalHeight}mm)`;
};

