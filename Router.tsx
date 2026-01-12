import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet, useParams } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { BrandProvider, DistributorBrandGuard } from './contexts/BrandContext';
import { CatalogProvider } from './contexts/CatalogContext';
import BrandThemeProvider from './components/BrandThemeProvider';
import { EmbedBlocker } from './components/EmbedWrapper';

// Pages
import OpieGroupLanding from './pages/OpieGroupLanding';
import BrandLanding from './pages/BrandLanding';
import BrandConfigurator from './pages/BrandConfigurator';

/**
 * BrandLayout
 * 
 * Layout wrapper for all brand-scoped routes.
 * Provides brand context, auth, catalog, and theme providers.
 */
const BrandLayout: React.FC = () => {
  const { brand } = useParams<{ brand: string }>();
  
  // Redirect if no brand slug
  if (!brand) {
    return <Navigate to="/" replace />;
  }
  
  return (
    <AuthProvider>
      <BrandProvider>
        <BrandThemeProvider>
          <DistributorBrandGuard>
            <CatalogProvider>
              <EmbedBlocker>
                <Outlet />
              </EmbedBlocker>
            </CatalogProvider>
          </DistributorBrandGuard>
        </BrandThemeProvider>
      </BrandProvider>
    </AuthProvider>
  );
};

/**
 * Router Configuration
 * 
 * Public routes:
 * - / or /opie-configurator: OPIE Group brand selector
 * - /{brand}/: Brand landing page
 * - /{brand}/configurator: Brand product configurator
 */
const router = createBrowserRouter([
  // OPIE Group Landing Page (unscoped)
  {
    path: '/',
    element: <OpieGroupLanding />,
  },
  {
    path: '/opie-configurator',
    element: <OpieGroupLanding />,
  },
  
  // Brand-scoped routes
  {
    path: '/:brand',
    element: <BrandLayout />,
    children: [
      // Brand Landing Page
      {
        index: true,
        element: <BrandLanding />,
      },
      // Brand Configurator
      {
        path: 'configurator',
        element: <BrandConfigurator />,
      },
      // Future: Admin routes (protected by EmbedBlocker in embed mode)
      {
        path: 'admin',
        element: <Navigate to="configurator" replace />, // TODO: Add AdminDashboard route
      },
      {
        path: 'admin/*',
        element: <Navigate to="../configurator" replace />,
      },
      // Future: Sales routes
      {
        path: 'sales',
        element: <Navigate to="configurator" replace />,
      },
      {
        path: 'sales/*',
        element: <Navigate to="../configurator" replace />,
      },
    ],
  },
  
  // Catch-all redirect to landing
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

/**
 * AppRouter
 * 
 * Main router component for the application.
 */
const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />;
};

export default AppRouter;
