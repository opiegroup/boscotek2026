import { makeCodeGetter } from './common';
import { ConfigurationState, ProductDefinition } from '../../types';

export const generateWorkbenchIndustrialRef = (config: ConfigurationState, product: ProductDefinition): string => {
  const getCode = makeCodeGetter(config, product);

  const h = getCode('bench_height');
  const w = getCode('size');
  const under = getCode('under_bench');
  const above = getCode('above_bench');
  const mobility = getCode('mobility');

  // Format BTWBI.Height.Width.Config[-Mobility]
  let ref = `BTWBI.${h}.${w}`;
  let suffix = '00';

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
      else if (hasAdjShelf) suffix = '14';
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
        if (!hasAdjShelf && !hasPower) suffix = '28';
        if (hasAdjShelf && hasPower) suffix = '23';
        else if (hasAdjShelf) suffix = '22';
     } else if (under.includes('hs_dr_cup')) {
        if (hasAdjShelf && hasPower) suffix = '25';
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
     if (under !== '00') ref += `.${under}`;
     if (above !== '00') ref += `.${above}`;
     if (mobility) ref += `-${mobility}`;
     return ref;
  }

  return `${ref}.${suffix}`;
};

