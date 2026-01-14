/**
 * Lectrum Catalog Service
 * 
 * Converts Lectrum product data into the standard ProductDefinition format
 * used by the configurator.
 */

import { ProductDefinition, OptionGroup, ProductAttribute } from '../../types';
import {
  LECTRUM_MODELS,
  FRAME_COLOURS,
  PANEL_COLOURS,
  LECTRUM_ACCESSORIES,
  LectrumModel,
  generateLectrumCode,
} from './lectrumConstants';

/**
 * Convert frame colours to ProductAttribute options
 */
function getFrameColourOptions(): ProductAttribute[] {
  return FRAME_COLOURS.map(colour => ({
    id: colour.id,
    label: colour.label,
    value: colour.id,
    code: colour.code,
    priceDelta: colour.priceDelta,
    meta: { hex: colour.hex },
  }));
}

// Premium for non-standard panel colours (Petronas is standard/included)
const PANEL_COLOUR_PREMIUM = 269;

/**
 * Convert panel colours to ProductAttribute options
 * Petronas is the standard colour (no premium), all others add $269
 */
function getPanelColourOptions(): ProductAttribute[] {
  return PANEL_COLOURS.map(colour => ({
    id: colour.id,
    label: colour.label,
    value: colour.id,
    code: colour.code,
    priceDelta: colour.id === 'petronas' ? 0 : PANEL_COLOUR_PREMIUM,
    description: colour.description,
    meta: { hex: colour.hex },
  }));
}

/**
 * Get accessories applicable to a specific model/series
 */
function getAccessoryOptions(model: LectrumModel): ProductAttribute[] {
  return LECTRUM_ACCESSORIES
    .filter(acc => acc.applicableSeries === 'all' || acc.applicableSeries.includes(model.series))
    .map(acc => ({
      id: acc.id,
      label: acc.name,
      value: acc.id,
      code: acc.id.toUpperCase(),
      priceDelta: acc.price,
      description: acc.description,
      meta: { category: acc.category },
    }));
}

/**
 * Build option groups for a Lectrum product
 */
function buildOptionGroups(model: LectrumModel): OptionGroup[] {
  const groups: OptionGroup[] = [];
  
  // Frame Colour
  groups.push({
    id: 'frame-colour',
    label: 'Frame Colour',
    type: 'color',
    options: getFrameColourOptions(),
    defaultValue: 'black',
    step: 1,
    description: 'Select the frame finish for your lectern.',
  });
  
  // Panel Colour
  groups.push({
    id: 'panel-colour',
    label: 'Panel Colour',
    type: 'color',
    options: getPanelColourOptions(),
    defaultValue: 'petronas',
    step: 2,
    description: 'Select the dress panel fabric colour.',
  });
  
  // Accessories (qty_list for multiple accessories)
  const accessoryOptions = getAccessoryOptions(model);
  if (accessoryOptions.length > 0) {
    groups.push({
      id: 'accessories',
      label: 'Accessories',
      type: 'qty_list',
      options: accessoryOptions,
      defaultValue: {},
      step: 3,
      description: 'Add optional accessories to your lectern.',
    });
  }
  
  return groups;
}

/**
 * Convert a LectrumModel to a ProductDefinition
 */
function modelToProductDefinition(model: LectrumModel): ProductDefinition {
  return {
    id: `lectrum-${model.id.toLowerCase()}`,
    name: model.name,
    description: model.description,
    basePrice: model.basePrice,
    groups: buildOptionGroups(model),
  };
}

/**
 * Get all Lectrum products as ProductDefinitions
 */
export function getLectrumProducts(): ProductDefinition[] {
  return LECTRUM_MODELS.map(modelToProductDefinition);
}

/**
 * Get Lectrum products by series
 */
export function getLectrumProductsBySeries(series: 'aero' | 'classic'): ProductDefinition[] {
  return LECTRUM_MODELS
    .filter(m => m.series === series)
    .map(modelToProductDefinition);
}

/**
 * Get a specific Lectrum product by ID
 */
export function getLectrumProduct(modelId: string): ProductDefinition | null {
  const model = LECTRUM_MODELS.find(m => 
    m.id.toLowerCase() === modelId.toLowerCase() ||
    `lectrum-${m.id.toLowerCase()}` === modelId.toLowerCase()
  );
  
  if (!model) return null;
  return modelToProductDefinition(model);
}

/**
 * Get model info for 3D rendering
 */
export function getLectrumModelInfo(modelId: string): LectrumModel | null {
  return LECTRUM_MODELS.find(m => 
    m.id.toLowerCase() === modelId.toLowerCase() ||
    `lectrum-${m.id.toLowerCase()}` === modelId.toLowerCase()
  ) || null;
}

/**
 * Generate reference code for a Lectrum configuration
 */
export function generateLectrumReferenceCode(
  productId: string,
  selections: Record<string, any>
): string {
  // Extract model ID from product ID (e.g., 'lectrum-l2001' -> 'L2001')
  const modelId = productId.replace('lectrum-', '').toUpperCase();
  const frameColour = selections['frame-colour'] || 'black';
  const panelColour = selections['panel-colour'] || 'ink';
  
  return generateLectrumCode(modelId, frameColour, panelColour);
}

/**
 * Calculate total price for a Lectrum configuration
 */
export function calculateLectrumPrice(
  productId: string,
  selections: Record<string, any>
): { basePrice: number; accessoriesTotal: number; panelPremium: number; total: number } {
  const model = getLectrumModelInfo(productId);
  if (!model) {
    return { basePrice: 0, accessoriesTotal: 0, panelPremium: 0, total: 0 };
  }

  const basePrice = model.basePrice;
  let accessoriesTotal = 0;
  let panelPremium = 0;

  // Check if non-standard panel colour is selected (Petronas is standard)
  const panelColour = selections['panel-colour'] as string | undefined;
  if (panelColour && panelColour !== 'petronas') {
    panelPremium = PANEL_COLOUR_PREMIUM;
  }

  // Calculate accessories total
  const accessories = selections['accessories'] as Record<string, number> | undefined;
  if (accessories) {
    Object.entries(accessories).forEach(([accId, qty]) => {
      const acc = LECTRUM_ACCESSORIES.find(a => a.id === accId);
      if (acc && qty > 0) {
        accessoriesTotal += acc.price * qty;
      }
    });
  }

  return {
    basePrice,
    accessoriesTotal,
    panelPremium,
    total: basePrice + panelPremium + accessoriesTotal,
  };
}

// Default export for convenience
export default {
  getProducts: getLectrumProducts,
  getProduct: getLectrumProduct,
  getProductsBySeries: getLectrumProductsBySeries,
  getModelInfo: getLectrumModelInfo,
  generateReferenceCode: generateLectrumReferenceCode,
  calculatePrice: calculateLectrumPrice,
};
