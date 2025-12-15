import React, { useState } from 'react';
import { ConfigurationState, ProductDefinition, PricingResult, ExportType } from '../types';
import LeadCaptureModal from './LeadCaptureModal';
import { requestExport, getCachedLead, initializeSession } from '../services/bimExportApi';

interface ExportButtonsProps {
  configuration: ConfigurationState;
  product: ProductDefinition;
  pricing: PricingResult;
  referenceCode: string;
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({
  configuration,
  product,
  pricing,
  referenceCode
}) => {
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [currentExportType, setCurrentExportType] = useState<ExportType>('BIM');
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Initialize session on mount
  React.useEffect(() => {
    initializeSession();
  }, []);

  const handleExportRequest = (exportType: ExportType) => {
    // Always show modal for now to ensure it works
    // TODO: Re-enable caching after testing
    setCurrentExportType(exportType);
    setShowLeadModal(true);
    
    /* Cache logic disabled for testing
    // Check if lead was recently captured
    const cachedLead = getCachedLead();
    
    if (cachedLead) {
      // Lead exists, proceed directly to export
      handleExport(exportType, cachedLead);
    } else {
      // Show lead capture modal
      setCurrentExportType(exportType);
      setShowLeadModal(true);
    }
    */
  };

  const handleExport = async (exportType: ExportType, leadData?: any) => {
    setIsExporting(true);
    setExportStatus(null);
    
    try {
      const response = await requestExport({
        configuration,
        product,
        pricing,
        referenceCode,
        lead: leadData,
        exportType
      });

      if (response.success) {
        // Check if expected URLs are present
        const expectedUrl = exportType === 'IFC' ? response.ifcUrl : 
                           exportType === 'OBJ' ? response.objUrl :
                           exportType === 'BLENDER_SCRIPT' ? response.blenderScriptUrl :
                           exportType === 'DATA' ? response.dataUrls : response.ifcUrl;
        
        if (!expectedUrl && exportType !== 'SPEC_PACK') {
          console.warn('Export succeeded but no download URL returned:', response);
          setExportStatus({ success: false, message: 'File generated but download URL not available. Check console for details.' });
          return;
        }
        
        setExportStatus({ success: true, message: 'Export generated successfully! Files downloading...' });
        
        // Helper to trigger download - handles both blob URLs and cross-origin signed URLs
        const downloadFile = async (url: string, filename: string) => {
          try {
            // For blob URLs, use direct download
            if (url.startsWith('blob:')) {
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            } else {
              // For cross-origin URLs (like Supabase signed URLs), fetch and create blob
              const response = await fetch(url);
              if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);
              const blob = await response.blob();
              const blobUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = blobUrl;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            }
          } catch (error) {
            console.error('Download failed:', error);
            // Fallback: open in new tab
            window.open(url, '_blank');
          }
        };
        
        const baseFilename = `Boscotek_${product.id}_${referenceCode}`;
        
        // Download files (using Promise.all for parallel downloads where appropriate)
        if (exportType === 'IFC' && response.ifcUrl) {
          await downloadFile(response.ifcUrl, `${baseFilename}.ifc`);
        } else if (exportType === 'OBJ') {
          const downloads = [];
          if (response.objUrl) downloads.push(downloadFile(response.objUrl, `${baseFilename}.obj`));
          if (response.mtlUrl) downloads.push(downloadFile(response.mtlUrl, `${baseFilename}.mtl`));
          await Promise.all(downloads);
        } else if (exportType === 'BLENDER_SCRIPT' && response.blenderScriptUrl) {
          await downloadFile(response.blenderScriptUrl, `${baseFilename}_blender.py`);
        } else if (exportType === 'DATA' && response.dataUrls) {
          const downloads = [];
          if (response.dataUrls.csv) downloads.push(downloadFile(response.dataUrls.csv, `${baseFilename}.csv`));
          if (response.dataUrls.json) downloads.push(downloadFile(response.dataUrls.json, `${baseFilename}.json`));
          if (response.dataUrls.txt) downloads.push(downloadFile(response.dataUrls.txt, `${baseFilename}.txt`));
          await Promise.all(downloads);
        } else if (exportType === 'SPEC_PACK') {
          const downloads = [];
          if (response.ifcUrl) downloads.push(downloadFile(response.ifcUrl, `${baseFilename}.ifc`));
          if (response.dataUrls?.csv) downloads.push(downloadFile(response.dataUrls.csv, `${baseFilename}.csv`));
          if (response.dataUrls?.json) downloads.push(downloadFile(response.dataUrls.json, `${baseFilename}.json`));
          if (response.dataUrls?.txt) downloads.push(downloadFile(response.dataUrls.txt, `${baseFilename}.txt`));
          await Promise.all(downloads);
        }
      } else {
        setExportStatus({ success: false, message: response.error || 'Export failed' });
      }
    } catch (error: any) {
      setExportStatus({ success: false, message: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleLeadSubmit = async (leadData: any) => {
    // Close modal first
    setShowLeadModal(false);
    // Small delay to let modal close gracefully
    await new Promise(resolve => setTimeout(resolve, 300));
    // Then proceed with export
    await handleExport(currentExportType, leadData);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold uppercase text-zinc-400 border-b border-zinc-800 pb-1">
        Export Options
      </h3>

      {/* Status Message */}
      {exportStatus && (
        <div className={`p-3 rounded border text-xs ${exportStatus.success ? 'bg-green-900/20 border-green-500 text-green-400' : 'bg-red-900/20 border-red-500 text-red-400'}`}>
          {exportStatus.message}
        </div>
      )}

      {/* Export Buttons */}
      <div className="space-y-2">
        {/* BIM (IFC) Export */}
        <button
          onClick={() => handleExportRequest('IFC')}
          disabled={isExporting}
          className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <div className="text-left">
              <div className="font-bold text-sm">Download BIM (IFC)</div>
              <div className="text-xs text-blue-200">3D model for Revit, ArchiCAD, Navisworks</div>
            </div>
          </div>
          <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Data Export */}
        <button
          onClick={() => handleExportRequest('DATA')}
          disabled={isExporting}
          className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="text-left">
              <div className="font-bold text-sm">Export Data</div>
              <div className="text-xs text-green-200">CSV, JSON, Excel formats</div>
            </div>
          </div>
          <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Complete Spec Pack */}
        <button
          onClick={() => handleExportRequest('SPEC_PACK')}
          disabled={isExporting}
          className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed group font-bold"
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
            <div className="text-left">
              <div className="font-bold text-sm">Complete Specification Pack</div>
              <div className="text-xs text-black/70">BIM + Data + Spec Sheet</div>
            </div>
          </div>
          <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* OBJ Export (for Blender) */}
        <button
          onClick={() => handleExportRequest('OBJ')}
          disabled={isExporting}
          className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div className="text-left">
              <div className="font-bold text-sm">Download OBJ Model</div>
              <div className="text-xs text-purple-200">3D model for Blender, 3ds Max, Maya</div>
            </div>
          </div>
          <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Blender Script Export */}
        <button
          onClick={() => handleExportRequest('BLENDER_SCRIPT')}
          disabled={isExporting}
          className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 text-white rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <div className="text-left">
              <div className="font-bold text-sm">Blender Python Script</div>
              <div className="text-xs text-orange-200">Auto-generate model in Blender</div>
            </div>
          </div>
          <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Loading Indicator */}
      {isExporting && (
        <div className="flex items-center justify-center gap-2 p-3 bg-zinc-800/50 rounded border border-zinc-700">
          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-zinc-400">Generating export...</span>
        </div>
      )}

      {/* Info Text */}
      <div className="bg-zinc-800/30 border border-zinc-700/50 rounded p-3 text-[10px] text-zinc-500 leading-relaxed">
        <strong className="text-zinc-400">Note:</strong> All exports include complete product specifications, dimensions, materials, and pricing information. IFC files work with Revit/ArchiCAD. OBJ files and Blender scripts are perfect for testing geometry in Blender.
      </div>

      {/* Lead Capture Modal */}
      <LeadCaptureModal
        isOpen={showLeadModal}
        onClose={() => setShowLeadModal(false)}
        onSubmit={handleLeadSubmit}
        exportType={
          currentExportType === 'IFC' ? 'BIM' : 
          currentExportType === 'OBJ' ? 'BIM' : 
          currentExportType === 'BLENDER_SCRIPT' ? 'BIM' : 
          currentExportType === 'DATA' ? 'DATA' : 
          'SPEC_PACK'
        }
      />
    </div>
  );
};

export default ExportButtons;
