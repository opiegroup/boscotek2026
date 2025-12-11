import React, { useState, useEffect } from 'react';
import { BIMLeadData, LeadRole } from '../types';

interface LeadCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (lead: BIMLeadData) => Promise<void>;
  exportType: 'BIM' | 'DATA' | 'SPEC_PACK';
}

const ROLES: LeadRole[] = ['Architect', 'Builder', 'Designer', 'Engineer', 'Buyer', 'Other'];

export const LeadCaptureModal: React.FC<LeadCaptureModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  exportType
}) => {
  const [formData, setFormData] = useState<BIMLeadData>({
    name: '',
    email: '',
    company: '',
    role: 'Architect',
    projectName: '',
    projectLocation: '',
    consent: false
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreFilled, setIsPreFilled] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof BIMLeadData, string>>>({});

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      // Check if lead was captured recently (within 24 hours)
      const cachedLead = localStorage.getItem('bim_lead_data');
      const cacheTimestamp = localStorage.getItem('bim_lead_timestamp');
      
      if (cachedLead && cacheTimestamp) {
        const timestamp = parseInt(cacheTimestamp);
        const now = Date.now();
        const hoursSinceCapture = (now - timestamp) / (1000 * 60 * 60);
        
        // If less than 24 hours, auto-fill form (but keep it open for review)
        if (hoursSinceCapture < 24) {
          try {
            const lead = JSON.parse(cachedLead) as BIMLeadData;
            setFormData({ ...lead, consent: true });
            setIsPreFilled(true);
            // Don't auto-submit - let user review and click submit button
            console.log('Pre-filled cached lead data - please review and submit');
          } catch (err) {
            console.error('Error parsing cached lead:', err);
          }
        }
      }
    }
  }, [isOpen]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof BIMLeadData, string>> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }
    
    if (!formData.consent) {
      newErrors.consent = 'You must consent to continue';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent | null, cachedLead?: BIMLeadData) => {
    if (e) e.preventDefault();
    
    const dataToSubmit = cachedLead || formData;
    
    if (!validate() && !cachedLead) return;
    
    setIsSubmitting(true);
    
    try {
      await onSubmit(dataToSubmit);
      
      // Cache the lead data for 24 hours
      localStorage.setItem('bim_lead_data', JSON.stringify(dataToSubmit));
      localStorage.setItem('bim_lead_timestamp', Date.now().toString());
      
      onClose();
    } catch (error) {
      console.error('Error submitting lead:', error);
      setErrors({ name: 'Failed to submit. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getExportTitle = () => {
    switch (exportType) {
      case 'BIM':
        return 'Download BIM (IFC) File';
      case 'DATA':
        return 'Export Configuration Data';
      case 'SPEC_PACK':
        return 'Download Complete Specification Pack';
      default:
        return 'Export Configuration';
    }
  };

  const getExportDescription = () => {
    switch (exportType) {
      case 'BIM':
        return 'Your IFC file will include full 3D geometry, dimensions, materials, and all configuration data for use in BIM software like Revit, ArchiCAD, and Navisworks.';
      case 'DATA':
        return 'Your data export will include CSV, Excel, and JSON formats containing complete product specifications, dimensions, pricing, and technical details.';
      case 'SPEC_PACK':
        return 'Your specification pack will include the IFC file, data exports, 3D preview images, and a comprehensive quote summary.';
      default:
        return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 rounded-t-lg">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-black mb-1">{getExportTitle()}</h2>
              <p className="text-sm text-black/80">Please provide your details to continue</p>
            </div>
            <button
              onClick={onClose}
              className="text-black/70 hover:text-black text-2xl font-bold leading-none transition-colors"
              disabled={isSubmitting}
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Description */}
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <p className="text-sm text-zinc-300 leading-relaxed">
              {getExportDescription()}
            </p>
          </div>

          {/* Pre-filled Notice */}
          {isPreFilled && (
            <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-3 flex items-start gap-3">
              <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-green-300 font-medium">Your details have been pre-filled</p>
                <p className="text-xs text-green-400/80 mt-1">Review and update if needed, then click "Continue to Download"</p>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-3 py-2 bg-zinc-800 border ${errors.name ? 'border-red-500' : 'border-zinc-600'} rounded text-white focus:outline-none focus:border-amber-500 transition-colors`}
                placeholder="John Smith"
                disabled={isSubmitting}
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full px-3 py-2 bg-zinc-800 border ${errors.email ? 'border-red-500' : 'border-zinc-600'} rounded text-white focus:outline-none focus:border-amber-500 transition-colors`}
                placeholder="john@company.com"
                disabled={isSubmitting}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            {/* Company */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Company
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:border-amber-500 transition-colors"
                placeholder="Company Name"
                disabled={isSubmitting}
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as LeadRole })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:border-amber-500 transition-colors"
                disabled={isSubmitting}
              >
                {ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            {/* Project Name */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Project Name
              </label>
              <input
                type="text"
                value={formData.projectName}
                onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:border-amber-500 transition-colors"
                placeholder="Optional"
                disabled={isSubmitting}
              />
            </div>

            {/* Project Location */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Project Location
              </label>
              <input
                type="text"
                value={formData.projectLocation}
                onChange={(e) => setFormData({ ...formData, projectLocation: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:border-amber-500 transition-colors"
                placeholder="Optional"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Consent Checkbox */}
          <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.consent}
                onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                className="mt-1 w-4 h-4 accent-amber-500"
                disabled={isSubmitting}
              />
              <span className="text-sm text-zinc-300 leading-relaxed">
                I consent to Boscotek collecting and storing this information for the purpose of providing product information, technical support, and following up on this inquiry. This information will not be shared with third parties.
                {errors.consent && <span className="block text-red-500 text-xs mt-1">{errors.consent}</span>}
              </span>
            </label>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-700">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                  Processing...
                </>
              ) : (
                <>Continue to Download</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LeadCaptureModal;
