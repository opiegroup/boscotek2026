
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ProductDefinition, DrawerInteriorOption } from '../types';
import { getProducts, getInteriors } from '../services/mockBackend';

interface CatalogContextType {
  products: ProductDefinition[];
  interiors: DrawerInteriorOption[];
  isLoading: boolean;
  refreshCatalog: () => Promise<void>;
  
  // Helpers
  addProduct: (product: ProductDefinition) => void; // Kept for import compatibility
  updateProduct: (product: ProductDefinition) => void; // Kept for import compatibility
}

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

export const CatalogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<ProductDefinition[]>([]);
  const [interiors, setInteriors] = useState<DrawerInteriorOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshCatalog = async () => {
    setIsLoading(true);
    try {
      const [prods, ints] = await Promise.all([
        getProducts(),
        getInteriors()
      ]);
      setProducts(prods);
      setInteriors(ints);
    } catch (err) {
      console.error("Failed to load catalog", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshCatalog();
  }, []);

  // Compat helpers for the AdminDashboard import functionality
  // In a real app, these would call API endpoints
  const updateProduct = (updatedProduct: ProductDefinition) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
  };
  const addProduct = (newProduct: ProductDefinition) => {
    setProducts(prev => [...prev, newProduct]);
  };

  return (
    <CatalogContext.Provider value={{ products, interiors, isLoading, refreshCatalog, updateProduct, addProduct }}>
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
