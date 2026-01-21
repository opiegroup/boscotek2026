import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

interface DistributorData {
  id: string;
  company_name: string;
  trading_name: string | null;
  abn: string | null;
  account_number: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_mobile: string | null;
  address_line1: string | null;
  address_line2: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  website: string | null;
  description: string | null;
  business_hours: string | null;
  logo_url: string | null;
  region: string | null;
  category: string | null;
  is_active: boolean;
  is_approved: boolean;
}

const STATES = [
  { value: 'NSW', label: 'New South Wales' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'WA', label: 'Western Australia' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'NT', label: 'Northern Territory' },
  { value: 'ACT', label: 'Australian Capital Territory' },
  { value: 'NZ', label: 'New Zealand' },
];

const COUNTRIES = [
  { value: 'Australia', label: 'Australia' },
  { value: 'New Zealand', label: 'New Zealand' },
];

const DistributorProfile: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [distributor, setDistributor] = useState<DistributorData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    company_name: '',
    trading_name: '',
    abn: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    contact_mobile: '',
    address_line1: '',
    address_line2: '',
    suburb: '',
    state: '',
    postcode: '',
    country: 'Australia',
    website: '',
    description: '',
    business_hours: '',
  });

  // Load distributor data
  useEffect(() => {
    loadDistributor();
  }, [user]);

  const loadDistributor = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('distributors')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError) throw fetchError;

      if (data) {
        setDistributor(data);
        setFormData({
          company_name: data.company_name || '',
          trading_name: data.trading_name || '',
          abn: data.abn || '',
          contact_name: data.contact_name || '',
          contact_email: data.contact_email || '',
          contact_phone: data.contact_phone || '',
          contact_mobile: data.contact_mobile || '',
          address_line1: data.address_line1 || '',
          address_line2: data.address_line2 || '',
          suburb: data.suburb || '',
          state: data.state || '',
          postcode: data.postcode || '',
          country: data.country || 'Australia',
          website: data.website || '',
          description: data.description || '',
          business_hours: data.business_hours || '',
        });
      }
    } catch (err: any) {
      console.error('Failed to load distributor:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!distributor) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from('distributors')
        .update({
          company_name: formData.company_name,
          trading_name: formData.trading_name || null,
          abn: formData.abn || null,
          contact_name: formData.contact_name || null,
          contact_email: formData.contact_email || null,
          contact_phone: formData.contact_phone || null,
          contact_mobile: formData.contact_mobile || null,
          address_line1: formData.address_line1 || null,
          address_line2: formData.address_line2 || null,
          suburb: formData.suburb || null,
          state: formData.state || null,
          postcode: formData.postcode || null,
          country: formData.country || null,
          website: formData.website || null,
          description: formData.description || null,
          business_hours: formData.business_hours || null,
        })
        .eq('id', distributor.id);

      if (updateError) throw updateError;

      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !distributor) return;

    // Validate file
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Please upload a PNG, JPG, or WebP image');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB');
      return;
    }

    setUploadingLogo(true);
    setError(null);

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${distributor.id}/logo.${fileExt}`;

      console.log('Uploading file:', {
        name: file.name,
        type: file.type,
        size: file.size,
        fileName: fileName
      });

      // Read file as ArrayBuffer to ensure binary upload
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('distributor-logos')
        .upload(fileName, uint8Array, { 
          upsert: true,
          contentType: file.type  // Explicitly set MIME type
        });

      console.log('Upload result:', { uploadData, uploadError });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('distributor-logos')
        .getPublicUrl(fileName);

      // Update distributor record with logo URL
      const logoUrl = urlData.publicUrl + `?t=${Date.now()}`; // Cache bust
      
      const { error: updateError } = await supabase
        .from('distributors')
        .update({ logo_url: logoUrl })
        .eq('id', distributor.id);

      if (updateError) throw updateError;

      // Update local state
      setDistributor(prev => prev ? { ...prev, logo_url: logoUrl } : null);
      setSuccess('Logo uploaded successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Failed to upload logo:', err);
      setError(err.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!distributor || !distributor.logo_url) return;

    if (!confirm('Remove your company logo?')) return;

    try {
      // Remove from storage
      const fileName = `${distributor.id}/logo`;
      await supabase.storage.from('distributor-logos').remove([`${fileName}.png`, `${fileName}.jpg`, `${fileName}.jpeg`, `${fileName}.webp`]);

      // Update distributor record
      const { error: updateError } = await supabase
        .from('distributors')
        .update({ logo_url: null })
        .eq('id', distributor.id);

      if (updateError) throw updateError;

      setDistributor(prev => prev ? { ...prev, logo_url: null } : null);
    } catch (err: any) {
      console.error('Failed to remove logo:', err);
      setError(err.message || 'Failed to remove logo');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!distributor) {
    return (
      <div className="text-center py-12 text-zinc-400">
        <p>No distributor profile found.</p>
        <p className="text-sm mt-2">Please contact an administrator to set up your account.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">My Account</h1>

      {/* Status Messages */}
      {success && (
        <div className="mb-6 bg-green-900/20 border border-green-900/50 text-green-400 p-4 rounded-lg">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-6 bg-red-900/20 border border-red-900/50 text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Logo & Blurb Section */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4">Company Profile</h2>
          
          <div className="flex flex-col md:flex-row gap-6">
            {/* Logo Upload */}
            <div className="flex-shrink-0">
              <div className="w-32 h-32 bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden flex items-center justify-center">
                {distributor.logo_url ? (
                  <img 
                    src={distributor.logo_url} 
                    alt="Company logo" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-zinc-500 text-center text-xs p-2">
                    No logo
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoUpload}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="text-xs bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded disabled:opacity-50"
                >
                  {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                </button>
                {distributor.logo_url && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="text-xs text-zinc-500 hover:text-red-400"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-2 w-32">
                PNG, JPG up to 2MB<br />
                Recommended: 400×400px
              </p>
            </div>

            {/* Blurb / Description */}
            <div className="flex-1">
              <label className="block text-xs font-mono text-zinc-500 mb-2">COMPANY DESCRIPTION</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={5}
                maxLength={500}
                placeholder="Tell us about your company..."
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none resize-none"
              />
              <p className="text-xs text-zinc-500 mt-1">
                {formData.description.length}/500 characters
              </p>
            </div>
          </div>
        </div>

        {/* Company Information */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4">Company Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">COMPANY NAME *</label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                required
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">TRADING NAME</label>
              <input
                type="text"
                name="trading_name"
                value={formData.trading_name}
                onChange={handleChange}
                placeholder="If different from company name"
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">ABN</label>
              <input
                type="text"
                name="abn"
                value={formData.abn}
                onChange={handleChange}
                placeholder="XX XXX XXX XXX"
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">WEBSITE</label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://example.com"
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-mono text-zinc-500 mb-2">BUSINESS HOURS</label>
              <input
                type="text"
                name="business_hours"
                value={formData.business_hours}
                onChange={handleChange}
                placeholder="Mon–Fri 9:00 am–5:00 pm"
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Primary Contact */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4">Primary Contact</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">CONTACT NAME</label>
              <input
                type="text"
                name="contact_name"
                value={formData.contact_name}
                onChange={handleChange}
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">EMAIL</label>
              <input
                type="email"
                name="contact_email"
                value={formData.contact_email}
                onChange={handleChange}
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">PHONE</label>
              <input
                type="tel"
                name="contact_phone"
                value={formData.contact_phone}
                onChange={handleChange}
                placeholder="02 XXXX XXXX"
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">MOBILE</label>
              <input
                type="tel"
                name="contact_mobile"
                value={formData.contact_mobile}
                onChange={handleChange}
                placeholder="04XX XXX XXX"
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4">Address</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-mono text-zinc-500 mb-2">STREET ADDRESS</label>
              <input
                type="text"
                name="address_line1"
                value={formData.address_line1}
                onChange={handleChange}
                placeholder="Unit/Street number and name"
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-mono text-zinc-500 mb-2">ADDRESS LINE 2</label>
              <input
                type="text"
                name="address_line2"
                value={formData.address_line2}
                onChange={handleChange}
                placeholder="Building, floor, etc. (optional)"
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">SUBURB / CITY</label>
              <input
                type="text"
                name="suburb"
                value={formData.suburb}
                onChange={handleChange}
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">STATE</label>
              <select
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              >
                <option value="">Select state...</option>
                {STATES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">POSTCODE</label>
              <input
                type="text"
                name="postcode"
                value={formData.postcode}
                onChange={handleChange}
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">COUNTRY</label>
              <select
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              >
                {COUNTRIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Account Details (Read-only) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4">Account Details</h2>
          <p className="text-xs text-zinc-500 mb-4">These details are managed by your account administrator.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">ACCOUNT NUMBER</label>
              <div className="bg-zinc-800/50 border border-zinc-700 text-zinc-400 p-3 rounded">
                {distributor.account_number || 'Not assigned'}
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">STATUS</label>
              <div className="bg-zinc-800/50 border border-zinc-700 p-3 rounded flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${distributor.is_approved ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span className={distributor.is_approved ? 'text-green-400' : 'text-yellow-400'}>
                  {distributor.is_approved ? 'Active' : 'Pending Approval'}
                </span>
              </div>
            </div>
            {distributor.region && (
              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-2">REGION</label>
                <div className="bg-zinc-800/50 border border-zinc-700 text-zinc-400 p-3 rounded">
                  {distributor.region}
                </div>
              </div>
            )}
            {distributor.category && (
              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-2">CATEGORY</label>
                <div className="bg-zinc-800/50 border border-zinc-700 text-zinc-400 p-3 rounded">
                  {distributor.category}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-amber-500 text-black font-bold px-8 py-3 rounded hover:bg-amber-400 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DistributorProfile;
