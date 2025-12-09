import { ConfigurationState, ProductDefinition } from '../../types';

export const makeCodeGetter = (config: ConfigurationState, product: ProductDefinition) => {
  return (groupId: string): string => {
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
};

