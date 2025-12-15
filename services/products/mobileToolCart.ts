import { makeCodeGetter } from './common';
import { ConfigurationState, ProductDefinition } from '../../types';

export const generateMobileToolCartRef = (config: ConfigurationState, product: ProductDefinition): string => {
  const getCode = makeCodeGetter(config, product);
  const width = getCode('width');
  const bayPreset = getCode('bay_preset');
  const worktop = getCode('worktop');
  const housing = getCode('housing_color');
  const facia = getCode('facia_color');
  const hasRearPosts = config.selections['rear_system'] === true;
  const toolboard = getCode('rear_toolboard');
  const louvre = getCode('rear_louvre');
  const trays = getCode('rear_trays');

  let rearSegment = '';
  if (hasRearPosts) {
    const rearParts: string[] = [];
    if (toolboard && toolboard !== 'TB0') rearParts.push(toolboard);
    if (louvre && louvre !== 'LV0') rearParts.push(louvre);
    if (trays && trays !== 'T0') rearParts.push(trays);
    rearSegment = rearParts.length > 0 ? `.${rearParts.join('+')}` : '.RP';
  }
  return `TCS.${width}.${bayPreset}.${worktop}${rearSegment}.${housing}.${facia}`;
};


