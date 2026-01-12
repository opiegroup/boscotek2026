import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBrand } from '../contexts/BrandContext';
import { useAuth } from '../contexts/AuthContext';
import BrandLogo from '../components/BrandLogo';
import { generateEmbedSnippet, generateShareUrl } from '../hooks/useEmbedMode';

/**
 * BrandLanding
 * 
 * Individual brand entry page at /{brand}/
 * Shows brand logo, CTA to start configurator, and Share/Embed options.
 */
const BrandLanding: React.FC = () => {
  const { brand, theme, brandSlug, isLoading: brandLoading } = useBrand();
  const { isAuthenticated, isAdmin, isStaff, signOut, user } = useAuth();
  const navigate = useNavigate();
  
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);
  
  const primaryColor = theme.primaryColor || '#f59e0b';
  const accentColor = theme.accentColor || '#292926';
  
  // Get the current domain for share/embed URLs
  const domain = typeof window !== 'undefined' ? window.location.host : 'configurator.opie.com.au';
  const shareUrl = generateShareUrl(brandSlug, domain);
  const embedSnippet = generateEmbedSnippet(brandSlug, domain);
  
  const handleCopyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  if (brandLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p>Loading {brandSlug}...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      className="min-h-screen flex flex-col text-white relative"
      style={{ backgroundColor: accentColor }}
    >
      {/* Toast Notification */}
      {showShareToast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in">
          Link copied to clipboard
        </div>
      )}
      
      {/* Header */}
      <header className="border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Back to OPIE */}
          <Link 
            to="/"
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            OPIE Group
          </Link>
          
          {/* User Actions */}
          <div className="flex items-center gap-4">
            {isAuthenticated && user && (
              <div className="flex items-center gap-2 text-xs text-zinc-400 bg-black/20 px-4 py-2 rounded-full backdrop-blur-sm">
                <span className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-green-500' : 'bg-zinc-500'}`} />
                <span>{user.name}</span>
                <button onClick={signOut} className="ml-2 text-zinc-500 hover:text-white">
                  Sign Out
                </button>
              </div>
            )}
            
            {(isAdmin || isStaff) && (
              <button 
                onClick={() => navigate(`/${brandSlug}/admin`)}
                className="text-xs text-zinc-400 hover:text-white font-medium bg-black/20 px-4 py-2 rounded-full backdrop-blur-sm transition-colors"
              >
                {isAdmin ? 'Admin' : 'Staff'} Dashboard
              </button>
            )}
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        {/* Brand Logo */}
        <div className="mb-8 transform scale-150">
          <BrandLogo className="h-16" showText={true} />
        </div>
        
        {/* Brand Name & Tagline */}
        <h1 className="text-3xl md:text-4xl font-bold mb-3 text-center text-white">
          {brand?.name} Product Configurator
        </h1>
        <p className="text-zinc-400 mb-10 text-center max-w-lg">
          Configure {brand?.name} products to your exact specifications and receive an instant quote.
        </p>
        
        {/* Primary CTA */}
        <Link
          to={`/${brandSlug}/configurator`}
          className="inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-lg text-black transition-all hover:brightness-110 hover:scale-105 shadow-lg"
          style={{ backgroundColor: primaryColor }}
        >
          Start Configurator
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        
        {/* Share & Embed Actions */}
        <div className="mt-12 flex flex-col sm:flex-row items-center gap-4">
          {/* Share Link */}
          <button
            onClick={handleCopyShareUrl}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share Link
          </button>
          
          {/* Embed Button */}
          <button
            onClick={() => setShowEmbedModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Embed Code
          </button>
        </div>
        
        {/* Brand Footer */}
        <div className="mt-16 text-center text-zinc-500 text-sm">
          <p>Part of the <span className="text-zinc-400">Opie Manufacturing Group</span></p>
        </div>
      </main>
      
      {/* Embed Modal */}
      {showEmbedModal && (
        <EmbedModal
          brandName={brand?.name || brandSlug}
          embedSnippet={embedSnippet}
          onClose={() => setShowEmbedModal(false)}
        />
      )}
    </div>
  );
};

/**
 * Embed Modal Component
 */
interface EmbedModalProps {
  brandName: string;
  embedSnippet: string;
  onClose: () => void;
}

const EmbedModal: React.FC<EmbedModalProps> = ({ brandName, embedSnippet, onClose }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl max-w-2xl w-full p-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        {/* Header */}
        <h2 className="text-2xl font-bold text-white mb-2">
          Embed {brandName} Configurator
        </h2>
        <p className="text-zinc-400 mb-6">
          Copy the code below to embed the configurator on your website.
        </p>
        
        {/* Code Block */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 mb-4">
          <pre className="text-sm text-zinc-300 whitespace-pre-wrap break-all font-mono">
            {embedSnippet}
          </pre>
        </div>
        
        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className={`
            flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all
            ${copied 
              ? 'bg-green-600 text-white' 
              : 'bg-amber-500 text-black hover:bg-amber-400'
            }
          `}
        >
          {copied ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy Embed Code
            </>
          )}
        </button>
        
        {/* Instructions */}
        <div className="mt-6 p-4 bg-zinc-800/50 rounded-lg">
          <h3 className="text-sm font-medium text-zinc-300 mb-2">Embedding Instructions</h3>
          <ul className="text-sm text-zinc-400 space-y-1">
            <li>• Paste this code where you want the configurator to appear</li>
            <li>• The iframe will fill the width of its container</li>
            <li>• Adjust the height value as needed for your layout</li>
            <li>• The embed mode hides navigation for a cleaner integration</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BrandLanding;
