
import { ConfigurationState, ProductDefinition } from '../types';
import { getPartitionById, resolvePartitionCode } from '../data/catalog';

export const generateReferenceCode = (config: ConfigurationState, product: ProductDefinition): string => {
  
  const getCode = (groupId: string): string => {
    const val = config.selections[groupId];
    if (val === undefined || val === '') return '';
    
    const group = product.groups.find(g => g.id === groupId);
    if (!group) return '';

    if (group.type === 'checkbox') {
       if (val === true) {
         const opt = group.options.find(o => o.value === true);
         return opt?.code || '';
       }
       return '';
    }

    const opt = group.options.find(o => o.id === val);
    return opt?.code || '';
  };

  if (product.id === 'prod-hd-cabinet') {
    // Specific format for cabinets: Series.Height.Width.Drawers.HousingColor.FaciaColor
    const series = getCode('series');
    const h = getCode('height');
    const w = getCode('width');
    const housing = getCode('housing_color');
    const facia = getCode('facia_color');
    
    // Generate stack string
    // e.g. .300.300.150
    const drawerGroup = product.groups.find(g => g.id === 'config');
    let drawerCodes = '';
    
    if (config.customDrawers && config.customDrawers.length > 0) {
       // Reverse to match bottom-up physical order usually used in codes
       const codes = config.customDrawers.map(drawer => {
          const opt = drawerGroup?.options.find(o => o.id === drawer.id);
          // let code = opt?.code || '?';
          // Actually usually the drawer shell code isn't listed inline if it's standard, 
          // but let's keep the existing format: Width.Height.Drawers
          // If we want exact catalog style it's usually: BTCD.900.560. [Drawers]
          
          let partString = '';
          if (drawer.interiorId) {
             const part = getPartitionById(drawer.interiorId);
             if (part) {
                const drawerHeight = opt?.meta?.front || 0;
                partString = `(${resolvePartitionCode(part, drawerHeight)})`;
             }
          }
          return `${opt?.code || '?'}${partString}`;
       });
       drawerCodes = codes.join('.');
    } else {
       drawerCodes = 'EMPTY';
    }

    return `${series}.${h}.${w}.${drawerCodes}.${housing}.${facia}`;
  }

  if (product.id === 'prod-workbench-heavy') {
    const size = getCode('size');
    const under = getCode('under_bench');
    const pos = getCode('under_bench_pos');
    const above = getCode('above_bench');
    const inc = getCode('shelf_incline');
    const mobility = getCode('mobility');
    
    // Format: WBH.Size.UnderBench(Pos).AboveBench(Inc)[-Mobility]
    let ref = `WBH.${size}.${under}`;
    if (pos) ref += `.${pos}`;
    ref += `.${above}`;
    if (inc) ref += `.${inc}`;
    if (mobility) ref += `-${mobility}`;
    return ref;
  }

  if (product.id === 'prod-workbench-industrial') {
    const h = getCode('bench_height');
    const w = getCode('size');
    const under = getCode('under_bench');
    const above = getCode('above_bench');
    const mobility = getCode('mobility');

    // Format BTWBI.Height.Width.Config[-Mobility]
    let ref = `BTWBI.${h}.${w}`;
    let suffix = '00';

    // Simplified Logic to match Popular Choices from PDF:
    // .01 = Shelf
    // .02 = Shelf + Power
    // .03 = Half Shelf + Cabinet
    // .04 = Half Shelf + Cabinet + Power
    // .05 = 2x Cabinets
    // .06 = 2x Cabinets + Power
    
    // EXTENDED (.15 - .34)
    // .15 = 2x Cabinet + Overhead Shelf + Power
    // .16 = Cabinet + Door + Overhead Shelf
    // .17 = Cabinet + Door + Overhead Shelf + Power
    // .18 = Half Shelf + Door + Overhead Shelf
    // .19 = Half Shelf + Door + Overhead Shelf + Power
    // .20 = Full Shelf + 1 Drawer + Overhead Shelf
    // .21 = Full Shelf + 1 Drawer + Overhead Shelf + Power
    // .22 = Half Shelf + 1 Drawer + Cabinet + Overhead Shelf
    // .23 = Half Shelf + 1 Drawer + Cabinet + Overhead Shelf + Power
    // .24 = Half Shelf + 1 Drawer + Door + Overhead Shelf
    
    // NEW: .25 - .34
    // .25 = Half Shelf + Drawer + Cupboard + Overhead + Power
    // .26 = Half Shelf + Drawer
    // .27 = Half Shelf + Drawer + Power
    // .28 = Half Shelf + Drawer + Cabinet
    // .29 = Half Shelf + Drawer + Cabinet + Power (Wait, checking logic) -- Actually .29 is usually Cabinet(L)+Drawer(R)+Shelf. 
    // .30 = Half Shelf + Drawer + Cupboard
    // .31 = 2x Drawers + Full Shelf
    // .32 = 2x Drawers + Full Shelf + Power
    // .33 = 2x Drawers + Full Shelf + Overhead
    // .34 = 2x Drawers + Full Shelf + Overhead + Power

    const hasShelf = under.includes('shelf') || under === 'US';
    const hasHalfShelf = under.includes('half_shelf') || under === 'HUS' || under.includes('shelf_cab') || under.includes('shelf_door') || under.includes('shelf_cup') || under.includes('dr1_hs');
    const hasDualCabinet = under.includes('cab2') || under === 'C2';
    const hasCabinetDoor = under.includes('cab_door') || under === 'CD';
    const hasSingleCabinet = under.includes('cab1') || under === 'C1' || under.includes('shelf_cab') || under.includes('hs_dr_cab');
    const hasSingleDoor = under.includes('door1') || under === 'DOR' || under.includes('shelf_door') || under.includes('hs_dr_cup'); 
    const hasSingleDrawer = under.includes('drawer-1') || under.includes('shelf_dr1') || under.includes('hs_dr') || under.includes('dr1_hs');
    const hasDualDrawer = under.includes('dr2_us');
    const hasComplexHalfStack = under.includes('hs_dr_cab') || under.includes('hs_dr_cup');

    const hasPower = above.includes('power') || above === 'P' || above === 'SP';
    const hasAdjShelf = above.includes('shelf') && !above.includes('fixed'); // AS

    // --- LOGIC TREE ---

    // DUAL DRAWERS
    if (hasDualDrawer) {
        if (hasAdjShelf && hasPower) suffix = '34';
        else if (hasAdjShelf) suffix = '33';
        else if (hasPower) suffix = '32';
        else suffix = '31';
    }

    // DUAL CABINET
    else if (hasDualCabinet) {
        if (hasAdjShelf && hasPower) suffix = '15';
        else if (hasPower) suffix = '06';
        else if (hasAdjShelf) suffix = '14'; // Assuming .14 pattern matches Dual Cab + Shelf
        else suffix = '05';
    }
    
    // CABINET + DOOR
    else if (hasCabinetDoor) {
        if (hasAdjShelf && hasPower) suffix = '17';
        else if (hasAdjShelf) suffix = '16';
        else if (hasPower) suffix = '08';
        else suffix = '07';
    }

    // HALF SHELF + DRAWER + CABINET/DOOR (Complex)
    else if (hasComplexHalfStack) {
       if (under.includes('hs_dr_cab')) {
          // Half Shelf + Drawer + Cabinet
          // .28 = basic, .29 = ?? (Actually let's assume .28/29 distinction is position or power, sticking to basic mapping)
          // If no overheads:
          if (!hasAdjShelf && !hasPower) suffix = '28'; // Drawer+Cab+Shelf
          
          if (hasAdjShelf && hasPower) suffix = '23';
          else if (hasAdjShelf) suffix = '22';
       } else if (under.includes('hs_dr_cup')) {
          // Half Shelf + Drawer + Door
          if (hasAdjShelf && hasPower) suffix = '25'; // Matches fully loaded .25 description roughly
          else if (hasAdjShelf) suffix = '24';
          else if (!hasAdjShelf && !hasPower) suffix = '30';
       }
    }

    // HALF SHELF + SINGLE DRAWER (No Cabinet/Door)
    else if (hasHalfShelf && hasSingleDrawer && !hasSingleCabinet && !hasSingleDoor) {
       if (hasPower) suffix = '27';
       else suffix = '26';
    }

    // HALF SHELF + SINGLE CABINET (Standard)
    else if (hasHalfShelf && hasSingleCabinet && !hasSingleDrawer) {
        if (hasAdjShelf) suffix = '12';
        else if (hasPower) suffix = '04';
        else suffix = '03';
    }

    // HALF SHELF + SINGLE DOOR (Standard)
    else if (hasHalfShelf && hasSingleDoor && !hasSingleDrawer) {
        if (hasAdjShelf && hasPower) suffix = '19';
        else if (hasAdjShelf) suffix = '18';
        else suffix = '09';
    }

    // FULL SHELF + SINGLE DRAWER
    else if (hasShelf && hasSingleDrawer) {
        if (hasAdjShelf && hasPower) suffix = '21';
        else if (hasAdjShelf) suffix = '20';
    }

    // FULL SHELF (Basic)
    else if (hasShelf) {
       if (hasAdjShelf && hasPower) suffix = '11';
       else if (hasAdjShelf) suffix = '10';
       else if (hasPower) suffix = '02';
       else suffix = '01';
    }

    else {
       // Custom build
       if (under !== '00') ref += `.${under}`;
       if (above !== '00') ref += `.${above}`;
       if (mobility) ref += `-${mobility}`;
       return ref;
    }

    return `${ref}.${suffix}`;
  }

  return 'GEN-CONFIG';
};