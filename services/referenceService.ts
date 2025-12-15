
import { ConfigurationState, ProductDefinition } from '../types';
import { generateHdCabinetRef } from './products/hdCabinet';
import { generateWorkbenchHeavyRef } from './products/workbenchHeavy';
import { generateWorkbenchIndustrialRef } from './products/workbenchIndustrial';
import { generateMobileToolCartRef } from './products/mobileToolCart';

export const generateReferenceCode = (config: ConfigurationState, product: ProductDefinition): string => {
  switch (product.id) {
    case 'prod-hd-cabinet':
      return generateHdCabinetRef(config, product);
    case 'prod-workbench-heavy':
      return generateWorkbenchHeavyRef(config, product);
    case 'prod-workbench-industrial':
      return generateWorkbenchIndustrialRef(config, product);
    case 'prod-mobile-tool-cart':
      return generateMobileToolCartRef(config, product);
    default:
      return 'GEN-CONFIG';
  }
};