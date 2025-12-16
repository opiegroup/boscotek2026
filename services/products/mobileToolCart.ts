import { makeCodeGetter } from './common';
import { ConfigurationState, ProductDefinition } from '../../types';

export const generateMobileToolCartRef = (config: ConfigurationState, product: ProductDefinition): string => {
  const getCode = makeCodeGetter(config, product);
  
  // Bay preset code (B24, B25, B26, B27) - width is fixed at 1130mm per catalogue
  const bayPreset = getCode('bay_preset') || 'B26';
  const worktop = getCode('worktop') || 'L';
  const housing = getCode('housing_color') || 'MG';
  const facia = getCode('facia_color') || 'SG';
  
  // Rear accessory system - T8 suffix when enabled (per Boscotek catalogue naming)
  const hasRearPosts = config.selections['rear_system'] === true;
  const toolboard = getCode('rear_toolboard');
  const louvre = getCode('rear_louvre');
  const trays = getCode('rear_trays');

  // Build code segments
  let baseCode = `TCS.${bayPreset}`;
  
  // Add T8 suffix if rear accessory system is enabled (matches catalogue: TCS.B26.T8)
  if (hasRearPosts) {
    baseCode += '.T8';
  }
  
  // Add worktop code
  baseCode += `.${worktop}`;
  
  // Add specific accessory details if present (for detailed specification)
  if (hasRearPosts) {
    const accessoryParts: string[] = [];
    if (toolboard && toolboard !== 'TB0') accessoryParts.push(toolboard);
    if (louvre && louvre !== 'LV0') accessoryParts.push(louvre);
    if (trays && trays !== 'T0') accessoryParts.push(trays);
    if (accessoryParts.length > 0) {
      baseCode += `.${accessoryParts.join('+')}`;
    }
  }
  
  // Add color codes
  baseCode += `.${housing}.${facia}`;
  
  return baseCode;
};



