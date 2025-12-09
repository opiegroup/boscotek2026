import { supabase } from './supabaseClient';
import { DrawerInteriorOption, ProductDefinition } from '../types';

export type SeedCatalogResponse = { success: boolean };

export const seedCatalog = async (products: ProductDefinition[], interiors: DrawerInteriorOption[]) => {
  return supabase.functions.invoke<SeedCatalogResponse>('seed-catalog', {
    body: { products, interiors }
  });
};

