import { makeCodeGetter } from './common';
import { ConfigurationState, ProductDefinition } from '../../types';

/**
 * Generate reference code for Industrial Storage Cupboard
 * Pattern: BT[TopType][Config].[Height].[Width].[BodyColor].[DoorColor]
 * Examples: BTFF.1800.900.MG.SG, BTSF.2000.900.LB.SG
 */
export const generateStorageCupboardRef = (config: ConfigurationState, product: ProductDefinition): string => {
  const getCode = makeCodeGetter(config, product);

  // Get the configuration preset (contains full code like BTFF.1800.900)
  const configPreset = config.selections['cupboard_config'] as string;
  
  // Get color codes
  const bodyColor = getCode('body_color');
  const doorColor = getCode('door_color');

  // The config preset already contains the base code (e.g., BTFF.1800.900)
  // Find the option to get its code
  const configGroup = product.groups.find(g => g.id === 'cupboard_config');
  const configOption = configGroup?.options.find(o => o.id === configPreset);
  const baseCode = configOption?.code || 'BTFF.1800.900';

  return `${baseCode}.${bodyColor}.${doorColor}`;
};

