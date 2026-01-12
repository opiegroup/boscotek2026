import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useBrand } from '../../contexts/BrandContext';
import { useAuth } from '../../contexts/AuthContext';
import { Brand } from '../../types';

interface BrandSettingsFormData {
  name: string;
  logoUrl: string;
  contactEmail: string;
  salesEmail: string;
  supportEmail: string;
  phone: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressPostcode: string;
  addressCountry: string;
  primaryColor: string;
  accentColor: string;
}

const BrandSettings: React.FC = () => {
  const { brand, brandSlug, refreshBrand, isLoading: brandLoading } = useBrand();
  const { isSuperAdmin, isAdmin } = useAuth();
  
  const [formData, setFormData] = useState<BrandSettingsFormData>({
    name: '',
    logoUrl: '',
    contactEmail: '',
    salesEmail: '',
    supportEmail: '',
    phone: '',
    addressStreet: '',
    addressCity: '',
    addressState: '',
    addressPostcode: '',
    addressCountry: 'Australia',
    primaryColor: '#f59e0b',
    accentColor: '#292926',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Load brand data into form
  useEffect(() => {
    if (brand) {
      const address = brand.addressJson || {};
      const theme = brand.themeJson || {};
      
      setFormData({
        name: brand.name || '',
        logoUrl: (brand as any).logoUrl || theme.logo || '',
        contactEmail: brand.contactEmail || '',
        salesEmail: (brand as any).salesEmail || '',
        supportEmail: brand.supportEmail || '',
        phone: brand.phone || '',
        addressStreet: (address as any).street || '',
        addressCity: (address as any).city || '',
        addressState: (address as any).state || '',
        addressPostcode: (address as any).postcode || '',
        addressCountry: (address as any).country || 'Australia',
        primaryColor: theme.primaryColor || '#f59e0b',
        accentColor: theme.accentColor || '#292926',
      });
      
      setLogoPreview((brand as any).logoUrl || theme.logo || null);
    }
  }, [brand]);

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(null);
  };

  // Handle logo file upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo image must be under 2MB');
      return;
    }
    
    setUploadingLogo(true);
    setError(null);
    
    try {
      // Create a preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${brandSlug}-logo-${Date.now()}.${fileExt}`;
      const filePath = `brands/${brandSlug}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('brand-assets')
        .upload(filePath, file, { upsert: true });
      
      if (uploadError) {
        // If bucket doesn't exist, try creating it or use a fallback
        console.error('Upload error:', uploadError);
        setError('Failed to upload logo. Storage may not be configured.');
        setUploadingLogo(false);
        return;
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('brand-assets')
        .getPublicUrl(filePath);
      
      setFormData(prev => ({ ...prev, logoUrl: publicUrl }));
      setSuccess('Logo uploaded successfully');
    } catch (err) {
      console.error('Logo upload error:', err);
      setError('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!brand?.id) {
      setError('No brand selected');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Build address JSON
      const addressJson = {
        street: formData.addressStreet,
        city: formData.addressCity,
        state: formData.addressState,
        postcode: formData.addressPostcode,
        country: formData.addressCountry,
      };
      
      // Build theme JSON (preserve existing, update colors)
      const themeJson = {
        ...(brand.themeJson || {}),
        primaryColor: formData.primaryColor,
        accentColor: formData.accentColor,
        logo: formData.logoUrl,
      };
      
      // Call the RPC function to update brand settings
      const { data, error: updateError } = await supabase.rpc('update_brand_settings', {
        p_brand_id: brand.id,
        p_name: formData.name,
        p_logo_url: formData.logoUrl,
        p_contact_email: formData.contactEmail,
        p_sales_email: formData.salesEmail,
        p_support_email: formData.supportEmail,
        p_phone: formData.phone,
        p_address_json: addressJson,
        p_theme_json: themeJson,
      });
      
      if (updateError) {
        throw updateError;
      }
      
      setSuccess('Brand settings saved successfully');
      
      // Refresh brand context to reflect changes
      await refreshBrand();
      
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to save brand settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Permission check
  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-zinc-400">
        <p>You do not have permission to access brand settings.</p>
      </div>
    );
  }

  if (brandLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Brand Settings</h1>
        <p className="text-zinc-400">
          Configure {brand?.name || 'brand'} identity, contact details, and theme.
          {isSuperAdmin && (
            <span className="ml-2 text-amber-500 text-sm">(God Mode: All brands accessible)</span>
          )}
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Brand Identity Section */}
        <section className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <h2 className="text-lg font-semibold text-white mb-4">Brand Identity</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo Upload */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Brand Logo
              </label>
              <div className="flex items-start gap-6">
                {/* Logo Preview */}
                <div className="w-32 h-32 bg-zinc-800 rounded-lg border border-zinc-700 flex items-center justify-center overflow-hidden">
                  {logoPreview ? (
                    <img 
                      src={logoPreview} 
                      alt="Logo preview" 
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <span className="text-zinc-500 text-sm">No logo</span>
                  )}
                </div>
                
                {/* Upload Controls */}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="logo-upload"
                    disabled={uploadingLogo}
                  />
                  <label
                    htmlFor="logo-upload"
                    className={`
                      inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium cursor-pointer
                      ${uploadingLogo 
                        ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed' 
                        : 'bg-amber-500 text-black hover:bg-amber-400'
                      }
                    `}
                  >
                    {uploadingLogo ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Upload Logo
                      </>
                    )}
                  </label>
                  <p className="mt-2 text-xs text-zinc-500">
                    Recommended: SVG or PNG, max 2MB. Square or landscape orientation.
                  </p>
                  
                  {/* Manual URL input */}
                  <div className="mt-3">
                    <input
                      type="text"
                      name="logoUrl"
                      value={formData.logoUrl}
                      onChange={handleChange}
                      placeholder="Or paste logo URL..."
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Brand Name */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Brand Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            {/* Brand Slug (read-only) */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Brand Slug
              </label>
              <input
                type="text"
                value={brandSlug}
                disabled
                className="w-full px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-400 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-zinc-500">Used in URLs. Contact support to change.</p>
            </div>
          </div>
        </section>

        {/* Contact Details Section */}
        <section className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <h2 className="text-lg font-semibold text-white mb-4">Contact Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Primary Email
              </label>
              <input
                type="email"
                name="contactEmail"
                value={formData.contactEmail}
                onChange={handleChange}
                placeholder="info@brand.com.au"
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Sales Email
              </label>
              <input
                type="email"
                name="salesEmail"
                value={formData.salesEmail}
                onChange={handleChange}
                placeholder="sales@brand.com.au"
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Support Email
              </label>
              <input
                type="email"
                name="supportEmail"
                value={formData.supportEmail}
                onChange={handleChange}
                placeholder="support@brand.com.au"
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+61 2 1234 5678"
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </section>

        {/* Address Section */}
        <section className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <h2 className="text-lg font-semibold text-white mb-4">Address</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Street Address
              </label>
              <input
                type="text"
                name="addressStreet"
                value={formData.addressStreet}
                onChange={handleChange}
                placeholder="123 Industrial Way"
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                City / Suburb
              </label>
              <input
                type="text"
                name="addressCity"
                value={formData.addressCity}
                onChange={handleChange}
                placeholder="Sydney"
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                State
              </label>
              <input
                type="text"
                name="addressState"
                value={formData.addressState}
                onChange={handleChange}
                placeholder="NSW"
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Postcode
              </label>
              <input
                type="text"
                name="addressPostcode"
                value={formData.addressPostcode}
                onChange={handleChange}
                placeholder="2000"
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Country
              </label>
              <input
                type="text"
                name="addressCountry"
                value={formData.addressCountry}
                onChange={handleChange}
                placeholder="Australia"
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </section>

        {/* Theme Section */}
        <section className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <h2 className="text-lg font-semibold text-white mb-4">Theme Colours</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Primary Colour
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  name="primaryColor"
                  value={formData.primaryColor}
                  onChange={handleChange}
                  className="w-12 h-12 rounded-lg border border-zinc-700 cursor-pointer"
                />
                <input
                  type="text"
                  name="primaryColor"
                  value={formData.primaryColor}
                  onChange={handleChange}
                  className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <p className="mt-1 text-xs text-zinc-500">Used for buttons, links, and highlights</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Accent Colour
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  name="accentColor"
                  value={formData.accentColor}
                  onChange={handleChange}
                  className="w-12 h-12 rounded-lg border border-zinc-700 cursor-pointer"
                />
                <input
                  type="text"
                  name="accentColor"
                  value={formData.accentColor}
                  onChange={handleChange}
                  className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <p className="mt-1 text-xs text-zinc-500">Used for backgrounds and secondary elements</p>
            </div>
          </div>
          
          {/* Theme Preview */}
          <div className="mt-6 p-4 rounded-lg border border-zinc-700" style={{ backgroundColor: formData.accentColor }}>
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="px-4 py-2 rounded-lg font-medium text-black"
                style={{ backgroundColor: formData.primaryColor }}
              >
                Primary Button
              </button>
              <span style={{ color: formData.primaryColor }} className="font-medium">
                Primary Text
              </span>
              <span className="text-white">White Text</span>
            </div>
          </div>
        </section>

        {/* Submit Button */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
          <p className="text-sm text-zinc-500">
            Changes are logged in the audit trail.
          </p>
          <button
            type="submit"
            disabled={isSaving}
            className={`
              px-6 py-3 rounded-lg font-medium transition-colors
              ${isSaving 
                ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed' 
                : 'bg-amber-500 text-black hover:bg-amber-400'
              }
            `}
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                Saving...
              </span>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BrandSettings;
