import { makeCodeGetter } from './common';
import { getPartitionById, resolvePartitionCode } from '../../data/catalog';
import { ConfigurationState, ProductDefinition } from '../../types';

export const generateHdCabinetRef = (config: ConfigurationState, product: ProductDefinition): string => {
  const getCode = makeCodeGetter(config, product);

  // Specific format: Series.Height.Width.Drawers.HousingColor.FaciaColor
  const series = getCode('series');
  const h = getCode('height');
  const w = getCode('width');
  const housing = getCode('housing_color');
  const facia = getCode('facia_color');

  const drawerGroup = product.groups.find(g => g.id === 'config');
  let drawerCodes = '';

  if (config.customDrawers && config.customDrawers.length > 0) {
    const codes = config.customDrawers.map(drawer => {
      const opt = drawerGroup?.options.find(o => o.id === drawer.id);

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
};

