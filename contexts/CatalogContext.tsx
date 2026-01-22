import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { ProductDefinition, DrawerInteriorOption } from '../types';
import { getProducts, getInteriors } from '../services/mockBackend';
import { useBrand } from './BrandContext';
import { getLectrumProducts } from '../services/products/lectrumCatalog';
import { getArgentProducts } from '../services/products/argentCatalog';

const BOSCOTEK_PRODUCT_IDS = [
  'prod-workbench-heavy',
  'prod-workbench-industrial',
  'prod-hd-cabinet',
  'prod-mobile-tool-cart',
  'prod-storage-cupboard',
  'prod-hilo-workbench',
];

interface CatalogContextType {
  products: ProductDefinition[];
  interiors: DrawerInteriorOption[];
  isLoading: boolean;
  refreshCatalog: () => Promise<void>;
  
  // Current brand info
  brandId: string | null;
  brandSlug: string;
  
  // Helpers
  addProduct: (product: ProductDefinition) => void;
  updateProduct: (product: ProductDefinition) => void;
}

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

export const CatalogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { brand, brandSlug, isLoading: brandLoading } = useBrand();
  
  const [products, setProducts] = useState<ProductDefinition[]>([]);
  const [interiors, setInteriors] = useState<DrawerInteriorOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshCatalog = useCallback(async () => {
    setIsLoading(true);
    try {
      // Brand-specific product loading
      switch (brandSlug) {
        case 'boscotek':
          // Boscotek uses the existing product catalog
          const [prods, ints] = await Promise.all([
            getProducts(brand?.id),
            getInteriors(brand?.id)
          ]);
          setProducts(prods.filter(product => BOSCOTEK_PRODUCT_IDS.includes(product.id)));
          setInteriors(ints);
          break;
          
        case 'lectrum':
          // Lectrum has its own product catalog
          const lectrumProducts = getLectrumProducts();
          setProducts(lectrumProducts);
          setInteriors([]); // Lectrum doesn't use drawer interiors
          break;
          
        case 'argent':
          // Argent has its own product catalog (server racks and security enclosures)
          const argentProducts = getArgentProducts();
          setProducts(argentProducts);
          setInteriors([]); // Argent doesn't use drawer interiors
          break;
          
        default:
          // Other brands have no products yet
          // TODO: In production, products will come from DB filtered by brand_id
          setProducts([]);
          setInteriors([]);
          break;
      }
    } catch (err) {
      console.error("Failed to load catalog", err);
    } finally {
      setIsLoading(false);
    }
  }, [brand?.id, brandSlug]);

  // Reload catalog when brand changes
  useEffect(() => {
    if (!brandLoading) {
      refreshCatalog();
    }
  }, [brandLoading, brand?.id, refreshCatalog]);

  // Compat helpers for the AdminDashboard import functionality
  const updateProduct = (updatedProduct: ProductDefinition) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
  };
  
  const addProduct = (newProduct: ProductDefinition) => {
    setProducts(prev => [...prev, newProduct]);
  };

  const value: CatalogContextType = {
    products,
    interiors,
    isLoading: isLoading || brandLoading,
    refreshCatalog,
    brandId: brand?.id || null,
    brandSlug,
    updateProduct,
    addProduct,
  };

  return (
    <CatalogContext.Provider value={value}>
      {children}
    </CatalogContext.Provider>
  );
};

export const useCatalog = () => {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error('useCatalog must be used within a CatalogProvider');
  }
  return context;
};
