/**
 * DataCageConfigurator
 * 
 * Plan-based configurator for Argent Commercial Data Cage.
 * Includes plan view, elevation view, and isometric 3D view.
 */
import React, { useState, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Grid, ContactShadows } from '@react-three/drei';
import SceneControlsOverlay from './SceneControlsOverlay';
import { LeadCaptureModal } from './LeadCaptureModal';
import { BIMLeadData } from '../types';
import {
  CageConfiguration,
  CageFace,
  calculateCageBOM,
  calculateInfillHeight,
  calculatePanelLayout,
  validateCageConfiguration,
  PANEL_WIDTHS,
  PANEL_HEIGHTS,
  HEIGHT_CALCULATION,
  DOORS,
  CAGE_LOCKS,
  CAGE_COMMERCIAL_RULES,
  CageBOM,
} from '../services/products/argentDataCageConstants';

interface DataCageConfiguratorProps {
  onConfigChange: (config: CageConfiguration) => void;
  onRequestQuote: (config: CageConfiguration, bom: CageBOM) => void;
  onBack: () => void;
}

// ============================================================================
// DATA CAGE IFC GENERATOR
// ============================================================================

function generateDataCageIFC(config: CageConfiguration, includeRoof: boolean): string {
  const timestamp = new Date().toISOString();
  const referenceCode = `CAGE.${config.lengthMm}.${config.widthMm}.${config.ceilingHeightMm}`;
  
  // Dimensions in meters
  const length = config.lengthMm / 1000;
  const width = config.widthMm / 1000;
  const height = config.ceilingHeightMm / 1000;
  const postSize = 0.05; // 50mm posts
  const panelThickness = 0.02; // 20mm panel thickness
  
  // IFC Header
  const ifcHeader = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView4]'), '2;1');
FILE_NAME('${referenceCode}.ifc', '${timestamp}', ('Boscotek Configurator'), ('Opie Manufacturing Group'), 'Boscotek Configurator v1.0', 'Boscotek Configurator', 'IFC4');
FILE_SCHEMA(('IFC4'));
ENDSEC;

DATA;`;

  let entityId = 1;
  const entities: string[] = [];
  
  // Helper for IFC enum values
  const E = (value: string) => `.${value}.`;
  
  // Helper to create entity
  const createEntity = (type: string, ...params: any[]): number => {
    const id = entityId++;
    const paramsStr = params.map(p => {
      if (p === null || p === undefined) return '$';
      if (typeof p === 'string' && p.startsWith('.') && p.endsWith('.')) return p;
      if (p === '*') return '*';
      if (typeof p === 'string') return `'${p}'`;
      if (Array.isArray(p)) {
        if (p.length === 0) return '()';
        const hasZeroOrNeg = p.some((n: number) => typeof n === 'number' && (n === 0 || n < 0 || n % 1 !== 0));
        if (hasZeroOrNeg || p.every((n: number) => typeof n === 'number')) {
          return `(${p.map(n => typeof n === 'number' ? (n.toString().includes('.') ? n.toString() : `${n}.`) : `#${n}`).join(',')})`;
        }
        return `(${p.map(item => typeof item === 'number' ? `#${item}` : item).join(',')})`;
      }
      if (typeof p === 'number') {
        if (p === 0 || p < 0 || p % 1 !== 0) {
          const str = p.toString();
          return str.includes('.') ? str : `${str}.`;
        }
        return `#${p}`;
      }
      return String(p);
    }).join(',');
    entities.push(`#${id}=${type}(${paramsStr});`);
    return id;
  };

  // Create basic IFC structure
  // Person and Organization
  const person = createEntity('IFCPERSON', null, null, null, null, null, null, null, null);
  const org = createEntity('IFCORGANIZATION', null, 'Opie Manufacturing Group', 'Argent Commercial', null, null);
  const personOrg = createEntity('IFCPERSONANDORGANIZATION', person, org, null);
  const app = createEntity('IFCAPPLICATION', org, '1.0', 'Boscotek Configurator', 'BOS');
  const ownerHistory = createEntity('IFCOWNERHISTORY', personOrg, app, null, E('READWRITE'), null, null, null, Math.floor(Date.now() / 1000));
  
  // Units
  const lengthUnit = createEntity('IFCSIUNIT', '*', E('LENGTHUNIT'), E('MILLI'), E('METRE'));
  const areaUnit = createEntity('IFCSIUNIT', '*', E('AREAUNIT'), null, E('SQUARE_METRE'));
  const volumeUnit = createEntity('IFCSIUNIT', '*', E('VOLUMEUNIT'), null, E('CUBIC_METRE'));
  const unitAssignment = createEntity('IFCUNITASSIGNMENT', [lengthUnit, areaUnit, volumeUnit]);
  
  // Geometric context
  const origin = createEntity('IFCCARTESIANPOINT', [0., 0., 0.]);
  const dirZ = createEntity('IFCDIRECTION', [0., 0., 1.]);
  const dirX = createEntity('IFCDIRECTION', [1., 0., 0.]);
  const axis2d = createEntity('IFCAXIS2PLACEMENT3D', origin, dirZ, dirX);
  const geoContext = createEntity('IFCGEOMETRICREPRESENTATIONCONTEXT', null, 'Model', 3, 1.0E-5, axis2d, null);
  const bodyContext = createEntity('IFCGEOMETRICREPRESENTATIONSUBCONTEXT', 'Body', 'Model', '*', '*', '*', '*', geoContext, null, E('MODEL_VIEW'), null);
  
  // Project
  const project = createEntity('IFCPROJECT', 'project-001', ownerHistory, `Data Cage ${referenceCode}`, 'Argent Commercial Data Cage', null, null, null, [geoContext], unitAssignment);
  
  // Site, Building, Storey
  const sitePlacement = createEntity('IFCLOCALPLACEMENT', null, axis2d);
  const site = createEntity('IFCSITE', 'site-001', ownerHistory, 'Site', null, null, sitePlacement, null, null, E('ELEMENT'), null, null, null, null, null);
  
  const buildingPlacement = createEntity('IFCLOCALPLACEMENT', sitePlacement, axis2d);
  const building = createEntity('IFCBUILDING', 'building-001', ownerHistory, 'Building', null, null, buildingPlacement, null, null, E('ELEMENT'), null, null, null);
  
  const storeyPlacement = createEntity('IFCLOCALPLACEMENT', buildingPlacement, axis2d);
  const storey = createEntity('IFCBUILDINGSTOREY', 'storey-001', ownerHistory, 'Ground Floor', null, null, storeyPlacement, null, null, E('ELEMENT'), 0.);
  
  // Aggregation relationships
  createEntity('IFCRELAGGREGATES', 'rel-site', ownerHistory, null, null, project, [site]);
  createEntity('IFCRELAGGREGATES', 'rel-building', ownerHistory, null, null, site, [building]);
  createEntity('IFCRELAGGREGATES', 'rel-storey', ownerHistory, null, null, building, [storey]);
  
  const products: number[] = [];
  
  // Helper to create a box geometry
  const createBox = (w: number, h: number, d: number, x: number, y: number, z: number, name: string): number => {
    const boxPoint = createEntity('IFCCARTESIANPOINT', [x * 1000, y * 1000, z * 1000]);
    const boxAxis = createEntity('IFCAXIS2PLACEMENT3D', boxPoint, dirZ, dirX);
    const boxPlacement = createEntity('IFCLOCALPLACEMENT', storeyPlacement, boxAxis);
    
    const profilePoint = createEntity('IFCCARTESIANPOINT', [0., 0.]);
    const profileAxis = createEntity('IFCAXIS2PLACEMENT2D', profilePoint, null);
    const profile = createEntity('IFCRECTANGLEPROFILEDEF', E('AREA'), null, profileAxis, w * 1000, d * 1000);
    const extrudeDir = createEntity('IFCDIRECTION', [0., 0., 1.]);
    const solid = createEntity('IFCEXTRUDEDAREASOLID', profile, axis2d, extrudeDir, h * 1000);
    
    const shape = createEntity('IFCSHAPEREPRESENTATION', bodyContext, 'Body', 'SweptSolid', [solid]);
    const prodDef = createEntity('IFCPRODUCTDEFINITIONSHAPE', null, null, [shape]);
    
    const element = createEntity('IFCBUILDINGELEMENTPROXY', name, ownerHistory, name, 'Data Cage Component', null, boxPlacement, prodDef, null, E('USERDEFINED'));
    return element;
  };
  
  // Create corner posts
  products.push(createBox(postSize, height, postSize, 0, 0, 0, 'Corner-Post-FL'));
  products.push(createBox(postSize, height, postSize, length - postSize, 0, 0, 'Corner-Post-FR'));
  products.push(createBox(postSize, height, postSize, 0, 0, width - postSize, 'Corner-Post-RL'));
  products.push(createBox(postSize, height, postSize, length - postSize, 0, width - postSize, 'Corner-Post-RR'));
  
  // Create wall panels (simplified as solid boxes)
  const panelH = height;
  // Front wall
  products.push(createBox(length - postSize * 2, panelH, panelThickness, postSize, 0, 0, 'Wall-Front'));
  // Rear wall
  products.push(createBox(length - postSize * 2, panelH, panelThickness, postSize, 0, width - panelThickness, 'Wall-Rear'));
  // Left wall
  products.push(createBox(panelThickness, panelH, width - postSize * 2, 0, 0, postSize, 'Wall-Left'));
  // Right wall
  products.push(createBox(panelThickness, panelH, width - postSize * 2, length - panelThickness, 0, postSize, 'Wall-Right'));
  
  // Roof if included
  if (includeRoof) {
    products.push(createBox(length, panelThickness, width, 0, height, 0, 'Roof-Panel'));
  }
  
  // Spatial containment
  createEntity('IFCRELCONTAINEDINSPATIALSTRUCTURE', 'rel-contain', ownerHistory, null, null, products, storey);
  
  // Property set for cage
  const propLength = createEntity('IFCPROPERTYSINGLEVALUE', 'Length', null, createEntity('IFCLENGTHMEASURE', config.lengthMm), null);
  const propWidth = createEntity('IFCPROPERTYSINGLEVALUE', 'Width', null, createEntity('IFCLENGTHMEASURE', config.widthMm), null);
  const propHeight = createEntity('IFCPROPERTYSINGLEVALUE', 'Height', null, createEntity('IFCLENGTHMEASURE', config.ceilingHeightMm), null);
  const propDoors = createEntity('IFCPROPERTYSINGLEVALUE', 'DoorCount', null, createEntity('IFCINTEGER', config.doors.length), null);
  const propRoof = createEntity('IFCPROPERTYSINGLEVALUE', 'HasRoof', null, includeRoof ? '.T.' : '.F.', null);
  
  const pset = createEntity('IFCPROPERTYSET', 'pset-cage', ownerHistory, 'Pset_DataCage', null, [propLength, propWidth, propHeight, propDoors, propRoof]);
  createEntity('IFCRELDEFINESBYPROPERTIES', 'rel-pset', ownerHistory, null, null, products, pset);

  // Build final IFC content
  const ifcFooter = `ENDSEC;
END-ISO-10303-21;`;

  return `${ifcHeader}\n${entities.join('\n')}\n${ifcFooter}`;
}

// ============================================================================
// DATA CAGE EXPORT BUTTONS COMPONENT
// ============================================================================

interface DataCageExportButtonsProps {
  config: CageConfiguration;
  bom: CageBOM;
  includeRoof: boolean;
  cageLength: number;
  cageWidth: number;
}

const DataCageExportButtons: React.FC<DataCageExportButtonsProps> = ({ 
  config, bom, includeRoof, cageLength, cageWidth 
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [pendingExportType, setPendingExportType] = useState<'BIM' | 'DATA' | 'SPEC_PACK' | null>(null);

  // Generate reference code for cage
  const referenceCode = `CAGE.${config.lengthMm}.${config.widthMm}.${config.ceilingHeightMm}`;

  // Calculate total price including roof
  const calculateTotalWithRoof = () => {
    let roofCost = 0;
    if (includeRoof) {
      const panelModule = 950;
      const postSz = 50;
      const xFullPanels = Math.floor((cageLength - postSz) / panelModule);
      const xRemainder = cageLength - postSz - (xFullPanels * panelModule);
      const xHasFiller = xRemainder > 100;
      const zFullPanels = Math.floor((cageWidth - postSz) / panelModule);
      const zRemainder = cageWidth - postSz - (zFullPanels * panelModule);
      const zHasFiller = zRemainder > 100;
      const fullPanels = xFullPanels * zFullPanels;
      const xFillerPanels = xHasFiller ? zFullPanels : 0;
      const zFillerPanels = zHasFiller ? xFullPanels : 0;
      const cornerFiller = (xHasFiller && zHasFiller) ? 1 : 0;
      const totalFillers = xFillerPanels + zFillerPanels + cornerFiller;
      roofCost = (fullPanels * 185) + (totalFillers * 95);
    }
    return bom.totalPrice + roofCost;
  };

  // Generate CSV data
  const generateCSV = () => {
    const lines = [
      'Category,Code,Description,Quantity,Unit Price,Total',
      ...bom.posts.map(p => `Posts,${p.item.code},${p.item.name},${p.quantity},${p.item.price},${p.quantity * p.item.price}`),
      ...bom.panels.map(p => `Panels,${p.item.code},${p.item.name},${p.quantity},${p.item.price},${p.quantity * p.item.price}`),
      ...bom.doors.map(d => `Doors,${d.item.code},${d.item.name},${d.quantity},${d.item.price},${d.quantity * d.item.price}`),
      ...bom.locks.map(l => `Locks,${l.item.id},${l.item.name},${l.quantity},${l.item.price},${l.quantity * l.item.price}`),
    ];
    if (includeRoof) {
      const panelModule = 950;
      const postSz = 50;
      const xFullPanels = Math.floor((cageLength - postSz) / panelModule);
      const xRemainder = cageLength - postSz - (xFullPanels * panelModule);
      const xHasFiller = xRemainder > 100;
      const zFullPanels = Math.floor((cageWidth - postSz) / panelModule);
      const zRemainder = cageWidth - postSz - (zFullPanels * panelModule);
      const zHasFiller = zRemainder > 100;
      const fullPanels = xFullPanels * zFullPanels;
      const xFillerPanels = xHasFiller ? zFullPanels : 0;
      const zFillerPanels = zHasFiller ? xFullPanels : 0;
      const cornerFiller = (xHasFiller && zHasFiller) ? 1 : 0;
      const totalFillers = xFillerPanels + zFillerPanels + cornerFiller;
      if (fullPanels > 0) lines.push(`Roof,9TAT DCR.900.900,Roof Panel 900×900,${fullPanels},185,${fullPanels * 185}`);
      if (totalFillers > 0) lines.push(`Roof,9TAT DCR.FILLER,Roof Panel Filler,${totalFillers},95,${totalFillers * 95}`);
    }
    lines.push(`,,TOTAL,,,${calculateTotalWithRoof()}`);
    return lines.join('\n');
  };

  // Generate JSON data
  const generateJSON = () => {
    return JSON.stringify({
      referenceCode,
      configuration: config,
      dimensions: {
        lengthMm: config.lengthMm,
        widthMm: config.widthMm,
        heightMm: config.ceilingHeightMm,
      },
      billOfMaterials: {
        posts: bom.posts.map(p => ({ code: p.item.code, name: p.item.name, quantity: p.quantity, unitPrice: p.item.price })),
        panels: bom.panels.map(p => ({ code: p.item.code, name: p.item.name, quantity: p.quantity, unitPrice: p.item.price })),
        doors: bom.doors.map(d => ({ code: d.item.code, name: d.item.name, quantity: d.quantity, unitPrice: d.item.price })),
        locks: bom.locks.map(l => ({ code: l.item.id, name: l.item.name, quantity: l.quantity, unitPrice: l.item.price })),
        includesRoof: includeRoof,
      },
      pricing: {
        subtotal: bom.totalPrice,
        roofCost: calculateTotalWithRoof() - bom.totalPrice,
        total: calculateTotalWithRoof(),
      },
      generatedAt: new Date().toISOString(),
    }, null, 2);
  };

  // Download helper
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportData = () => {
    setIsExporting(true);
    setExportStatus(null);
    try {
      downloadFile(generateCSV(), `DataCage_${referenceCode}.csv`, 'text/csv');
      downloadFile(generateJSON(), `DataCage_${referenceCode}.json`, 'application/json');
      setExportStatus({ success: true, message: 'Data exported successfully!' });
    } catch (error: any) {
      setExportStatus({ success: false, message: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  // Button click handlers - show lead capture modal
  const handleBIMClick = () => {
    setPendingExportType('BIM');
    setShowLeadModal(true);
  };

  const handleDataClick = () => {
    setPendingExportType('DATA');
    setShowLeadModal(true);
  };

  const handleSpecPackClick = () => {
    setPendingExportType('SPEC_PACK');
    setShowLeadModal(true);
  };

  // Actual export functions (called after lead capture)
  const handleExportBIM = () => {
    setIsExporting(true);
    setExportStatus(null);
    try {
      const ifcContent = generateDataCageIFC(config, includeRoof);
      downloadFile(ifcContent, `DataCage_${referenceCode}.ifc`, 'application/x-step');
      setExportStatus({ success: true, message: 'BIM (IFC) file exported!' });
    } catch (error: any) {
      setExportStatus({ success: false, message: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSpecPack = () => {
    setIsExporting(true);
    setExportStatus(null);
    try {
      // Generate spec sheet as text
      const specSheet = `
ARGENT COMMERCIAL DATA CAGE SPECIFICATION
==========================================
Reference: ${referenceCode}
Generated: ${new Date().toLocaleString()}

DIMENSIONS
----------
Length (Front-to-Rear): ${config.lengthMm}mm
Width (Left-to-Right): ${config.widthMm}mm
Height (Ceiling): ${config.ceilingHeightMm}mm
Floor Area: ${((config.lengthMm * config.widthMm) / 1000000).toFixed(2)} m²

DOORS
-----
${config.doors.map((d, i) => `Door ${i+1}: ${d.face} face, ${d.doorId}`).join('\n')}

BILL OF MATERIALS
-----------------
POSTS:
${bom.posts.map(p => `  ${p.item.code} - ${p.item.name} × ${p.quantity}`).join('\n')}

PANELS:
${bom.panels.map(p => `  ${p.item.code} - ${p.item.name} × ${p.quantity}`).join('\n')}

DOORS:
${bom.doors.map(d => `  ${d.item.code} - ${d.item.name} × ${d.quantity}`).join('\n')}

LOCKS:
${bom.locks.map(l => `  ${l.item.id} - ${l.item.name} × ${l.quantity}`).join('\n')}

${includeRoof ? 'ROOF: Included\n' : ''}

PRICING
-------
Subtotal: $${bom.totalPrice.toLocaleString()}
${includeRoof ? `Roof: $${(calculateTotalWithRoof() - bom.totalPrice).toLocaleString()}\n` : ''}
TOTAL: $${calculateTotalWithRoof().toLocaleString()}

==========================================
Opie Manufacturing Group | Argent
www.argent.com.au | sales@argent.com.au
`.trim();

      downloadFile(specSheet, `DataCage_${referenceCode}_Spec.txt`, 'text/plain');
      downloadFile(generateCSV(), `DataCage_${referenceCode}.csv`, 'text/csv');
      downloadFile(generateJSON(), `DataCage_${referenceCode}.json`, 'application/json');
      downloadFile(generateDataCageIFC(config, includeRoof), `DataCage_${referenceCode}.ifc`, 'application/x-step');
      setExportStatus({ success: true, message: 'Specification pack exported!' });
    } catch (error: any) {
      setExportStatus({ success: false, message: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <h3 className="text-xs font-bold uppercase text-zinc-400 border-b border-zinc-700 pb-1">
        Export Options
      </h3>

      {exportStatus && (
        <div className={`p-2 rounded border text-xs ${exportStatus.success ? 'bg-green-900/20 border-green-500 text-green-400' : 'bg-red-900/20 border-red-500 text-red-400'}`}>
          {exportStatus.message}
        </div>
      )}

      <div className="space-y-2">
        {/* BIM (IFC) Export */}
        <button
          onClick={handleBIMClick}
          disabled={isExporting}
          className="w-full flex items-center justify-between p-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded transition-all disabled:opacity-50 group"
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <div className="text-left">
              <div className="font-bold text-xs">Download BIM (IFC)</div>
              <div className="text-[10px] text-blue-200">3D model for Revit, ArchiCAD</div>
            </div>
          </div>
          <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Data Export */}
        <button
          onClick={handleDataClick}
          disabled={isExporting}
          className="w-full flex items-center justify-between p-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded transition-all disabled:opacity-50 group"
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="text-left">
              <div className="font-bold text-xs">Export Data</div>
              <div className="text-[10px] text-green-200">CSV, JSON formats</div>
            </div>
          </div>
          <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Complete Spec Pack */}
        <button
          onClick={handleSpecPackClick}
          disabled={isExporting}
          className="w-full flex items-center justify-between p-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black rounded transition-all disabled:opacity-50 group font-bold"
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
            <div className="text-left">
              <div className="font-bold text-xs">Complete Specification Pack</div>
              <div className="text-[10px] text-black/70">BIM + Data + Spec Sheet</div>
            </div>
          </div>
          <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {isExporting && (
        <div className="flex items-center justify-center gap-2 p-2 bg-zinc-800/50 rounded border border-zinc-700">
          <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[10px] text-zinc-400">Generating export...</span>
        </div>
      )}

      <div className="bg-zinc-800/30 border border-zinc-700/50 rounded p-2 text-[9px] text-zinc-500 leading-relaxed">
        <strong className="text-zinc-400">Note:</strong> All exports include complete product specifications, dimensions, and pricing. IFC files are compatible with Revit, ArchiCAD, Navisworks, and other BIM software.
      </div>

      {/* Lead Capture Modal */}
      <LeadCaptureModal
        isOpen={showLeadModal}
        onClose={() => {
          setShowLeadModal(false);
          setPendingExportType(null);
        }}
        onSubmit={async (lead: BIMLeadData) => {
          // Log lead data (in production, send to backend)
          console.log('Lead captured for Data Cage export:', lead);
          
          // Perform the actual export based on pending type
          if (pendingExportType === 'BIM') {
            handleExportBIM();
          } else if (pendingExportType === 'DATA') {
            handleExportData();
          } else if (pendingExportType === 'SPEC_PACK') {
            handleExportSpecPack();
          }
          
          setShowLeadModal(false);
          setPendingExportType(null);
        }}
        exportType={pendingExportType || 'BIM'}
      />
    </div>
  );
};

const DataCageConfigurator: React.FC<DataCageConfiguratorProps> = ({
  onConfigChange,
  onRequestQuote,
  onBack,
}) => {
  // Configuration state
  const [ceilingHeight, setCeilingHeight] = useState(3500);
  const [cageLength, setCageLength] = useState(3600);
  const [cageWidth, setCageWidth] = useState(2700);
  const [primaryDoorFace, setPrimaryDoorFace] = useState<CageFace>('front');
  const [additionalDoors, setAdditionalDoors] = useState(0);
  const [lockType, setLockType] = useState('lock-keyed-standard');
  const [includeRoof, setIncludeRoof] = useState(false);
  const [installationNotes, setInstallationNotes] = useState('');
  const [viewMode, setViewMode] = useState<'plan' | 'elevation' | '3d'>('plan');
  const [doorPosition, setDoorPosition] = useState<'left' | 'center' | 'right'>('center');
  
  // Build configuration object - ensure additional doors don't conflict with primary door face
  const config: CageConfiguration = useMemo(() => {
    // Get available faces for additional doors (excluding primary door face)
    const availableFaces: CageFace[] = (['front', 'rear', 'left', 'right'] as CageFace[]).filter(f => f !== primaryDoorFace);
    
    // Calculate door position based on face dimension and position choice
    const getFaceLength = (face: CageFace) => (face === 'front' || face === 'rear') ? cageWidth : cageLength;
    
    // Door opening is 1200mm
    const doorOpeningWidth = 1200;
    const postSize = 50; // Corner post size
    
    const getDoorPositionMm = (face: CageFace, pos: 'left' | 'center' | 'right') => {
      const faceLength = getFaceLength(face);
      // Available space for door (wall length minus corner posts)
      const availableSpace = faceLength - postSize * 2;
      
      // Ensure door fits - if wall is too short, center it
      if (availableSpace < doorOpeningWidth) {
        return postSize; // Just place it after corner post
      }
      
      switch (pos) {
        case 'left': 
          // Door starts just after corner post
          return postSize;
        case 'right': 
          // Door ends just before corner post
          return faceLength - doorOpeningWidth - postSize;
        case 'center': 
        default: 
          // Center the door on the wall
          return (faceLength - doorOpeningWidth) / 2;
      }
    };
    
    return {
      lengthMm: cageLength,
      widthMm: cageWidth,
      ceilingHeightMm: ceilingHeight,
      doors: [
        // Primary door
        { 
          face: primaryDoorFace, 
          positionMm: getDoorPositionMm(primaryDoorFace, doorPosition),
          doorId: 'door-sliding', 
          lockId: lockType,
          slideDirection: doorPosition === 'left' ? 'right' : 'left' as 'left' | 'right', // Slide away from nearest wall
        },
        // Additional doors - placed on different faces, avoiding primary
        ...Array.from({ length: additionalDoors }, (_, i) => {
          const face = availableFaces[i % availableFaces.length];
          return {
            face,
            positionMm: getDoorPositionMm(face, 'center'), // Additional doors always centered
            doorId: 'door-sliding',
            lockId: lockType,
            slideDirection: 'left' as 'left' | 'right',
          };
        }),
      ],
      installationNotes,
    };
  }, [ceilingHeight, cageLength, cageWidth, primaryDoorFace, additionalDoors, lockType, installationNotes, doorPosition]);
  
  // Calculate BOM and validation
  const bom = useMemo(() => calculateCageBOM(config), [config]);
  const validation = useMemo(() => validateCageConfiguration(config), [config]);
  const infillCalc = useMemo(() => calculateInfillHeight(ceilingHeight), [ceilingHeight]);
  
  // Notify parent of config changes
  React.useEffect(() => {
    onConfigChange(config);
  }, [config, onConfigChange]);
  
  // Dimension presets
  const lengthPresets = [1800, 2700, 3600, 4500, 5400, 6300, 7200];
  const widthPresets = [1800, 2700, 3600, 4500, 5400, 6300, 7200];
  const ceilingPresets = [2500, 2700, 3000, 3200, 3500, 3800, 4000];
  
  return (
    <div className="h-full flex flex-col bg-zinc-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <button onClick={onBack} className="text-sm text-zinc-400 hover:text-white mb-2">
          ← Back to Products
        </button>
        <h1 className="text-xl font-bold">Argent Commercial Data Cage</h1>
        <p className="text-sm text-zinc-400">Plan-based modular enclosure configurator</p>
        <div className="mt-2 px-3 py-1.5 bg-amber-900/30 border border-amber-500/50 rounded text-xs text-amber-400">
          {CAGE_COMMERCIAL_RULES.message}
        </div>
      </div>
      
      {/* Main content - three column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Configuration controls */}
        <div className="w-[320px] overflow-y-auto p-4 border-r border-zinc-800 space-y-5">
          
          {/* Step 1: Ceiling Height */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              1. Site Ceiling Height
            </label>
            <div className="flex flex-wrap gap-2">
              {ceilingPresets.map(h => (
                <button
                  key={h}
                  onClick={() => setCeilingHeight(h)}
                  className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                    ceilingHeight === h 
                      ? 'bg-amber-600 border-amber-500 text-white' 
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  {h}mm
                </button>
              ))}
            </div>
            {infillCalc.requiresInfill && (
              <p className="text-xs text-emerald-400">
                Requires {infillCalc.infillHeightMm}mm infill panels
              </p>
            )}
          </div>
          
          {/* Step 2: Cage Length */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              2. Cage Length (Front-to-Rear)
            </label>
            <div className="flex flex-wrap gap-2">
              {lengthPresets.map(l => (
                <button
                  key={l}
                  onClick={() => setCageLength(l)}
                  className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                    cageLength === l 
                      ? 'bg-amber-600 border-amber-500 text-white' 
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  {l}mm
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500">{Math.round(cageLength / 900)} standard panels</p>
          </div>
          
          {/* Step 3: Cage Width */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              3. Cage Width (Left-to-Right)
            </label>
            <div className="flex flex-wrap gap-2">
              {widthPresets.map(w => (
                <button
                  key={w}
                  onClick={() => setCageWidth(w)}
                  className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                    cageWidth === w 
                      ? 'bg-amber-600 border-amber-500 text-white' 
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  {w}mm
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500">{Math.round(cageWidth / 900)} standard panels</p>
          </div>
          
          {/* Step 4: Primary Door Location */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              4. Primary Door Face
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['front', 'rear', 'left', 'right'] as CageFace[]).map(face => (
                <button
                  key={face}
                  onClick={() => setPrimaryDoorFace(face)}
                  className={`px-3 py-2 text-sm rounded border transition-colors capitalize ${
                    primaryDoorFace === face 
                      ? 'bg-amber-600 border-amber-500 text-white' 
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  {face}
                </button>
              ))}
            </div>
          </div>
          
          {/* Step 4b: Door Position on Face */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              Door Position on Face
            </label>
            <div className="flex gap-2">
              {(['left', 'center', 'right'] as const).map(pos => (
                <button
                  key={pos}
                  onClick={() => setDoorPosition(pos)}
                  className={`flex-1 px-3 py-2 text-sm rounded border transition-colors capitalize ${
                    doorPosition === pos 
                      ? 'bg-amber-600 border-amber-500 text-white' 
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500">Door slides away from nearest wall</p>
          </div>
          
          {/* Step 5: Additional Doors */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              5. Additional Doors
            </label>
            <div className="flex gap-2">
              {[0, 1, 2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => setAdditionalDoors(n)}
                  className={`px-4 py-2 text-sm rounded border transition-colors ${
                    additionalDoors === n 
                      ? 'bg-amber-600 border-amber-500 text-white' 
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  {n === 0 ? 'None' : `+${n}`}
                </button>
              ))}
            </div>
            {additionalDoors > 0 && (
              <p className="text-xs text-amber-400">
                +${DOORS[0].price * additionalDoors} for {additionalDoors} additional door(s)
              </p>
            )}
          </div>
          
          {/* Step 6: Lock Type */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              6. Lock Type
            </label>
            <div className="space-y-2">
              {CAGE_LOCKS.map(lock => (
                <button
                  key={lock.id}
                  onClick={() => setLockType(lock.id)}
                  className={`w-full px-3 py-2 text-left text-sm rounded border transition-colors ${
                    lockType === lock.id 
                      ? 'bg-amber-600/20 border-amber-500 text-white' 
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  <div className="font-medium">{lock.name}</div>
                  <div className="text-xs text-zinc-400">{lock.description}</div>
                  {lock.price > 0 && (
                    <div className="text-xs text-amber-400 mt-1">${lock.price} per door</div>
                  )}
                </button>
              ))}
            </div>
          </div>
          
          {/* Step 7: Roof Option */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              7. Roof Panels
            </label>
            <button
              onClick={() => setIncludeRoof(!includeRoof)}
              className={`w-full px-3 py-2 text-left text-sm rounded border transition-colors ${
                includeRoof 
                  ? 'bg-amber-600/20 border-amber-500 text-white' 
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{includeRoof ? 'Include Roof Panels' : 'No Roof Panels'}</div>
                  <div className="text-xs text-zinc-400">Mesh panels on top of cage enclosure</div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors ${includeRoof ? 'bg-amber-500' : 'bg-zinc-600'}`}>
                  <div className={`w-4 h-4 mt-1 rounded-full bg-white transition-transform ${includeRoof ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
              </div>
            </button>
          </div>
          
          {/* Step 8: Installation Notes */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              8. Site & Installation Notes
            </label>
            <textarea
              value={installationNotes}
              onChange={(e) => setInstallationNotes(e.target.value)}
              placeholder="Site constraints, access requirements, power requirements..."
              className="w-full h-24 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder:text-zinc-500 resize-none"
            />
          </div>
          
        </div>
        
        {/* Center: Visualization */}
        <div className="flex-1 flex flex-col">
          {/* View mode tabs */}
          <div className="flex border-b border-zinc-800">
            {(['plan', 'elevation', '3d'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  viewMode === mode 
                    ? 'text-amber-500 border-b-2 border-amber-500' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {mode === '3d' ? '3D View' : `${mode} View`}
              </button>
            ))}
          </div>
          
          {/* Visualization area */}
          <div className="flex-1 bg-zinc-950 relative overflow-hidden">
            {viewMode === 'plan' && (
              <PlanView config={config} />
            )}
            {viewMode === 'elevation' && (
              <ElevationView 
                config={config} 
                infillHeight={infillCalc.infillHeightMm} 
                bottomHeight={infillCalc.bottomHeightMm}
                upperHeight={infillCalc.upperHeightMm}
              />
            )}
            {viewMode === '3d' && (
              <IsometricView 
                config={config} 
                infillHeight={infillCalc.infillHeightMm}
                bottomHeight={infillCalc.bottomHeightMm}
                upperHeight={infillCalc.upperHeightMm}
                includeRoof={includeRoof}
              />
            )}
          </div>
        </div>
        
        {/* Right: Quote Summary Panel */}
        <div className="w-[320px] border-l border-zinc-800 bg-zinc-900 flex flex-col overflow-hidden">
          {/* Quote header */}
          <div className="p-4 border-b border-zinc-800">
            <h2 className="text-lg font-semibold text-white">Quote Summary</h2>
            <p className="text-xs text-zinc-500">Indicative pricing • Final quote on request</p>
          </div>
          
          {/* Validation messages */}
          <div className="px-4 pt-3">
            {validation.errors.length > 0 && (
              <div className="mb-3 p-2 bg-red-900/30 border border-red-500/50 rounded">
                {validation.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-400">{e}</p>
                ))}
              </div>
            )}
            {validation.warnings.length > 0 && (
              <div className="mb-3 p-2 bg-amber-900/30 border border-amber-500/50 rounded">
                {validation.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-400">{w}</p>
                ))}
              </div>
            )}
          </div>
          
          {/* Scrollable BOM details */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Dimensions summary */}
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Dimensions</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Length:</span>
                  <span className="text-white font-medium">{cageLength}mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Width:</span>
                  <span className="text-white font-medium">{cageWidth}mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Height:</span>
                  <span className="text-white font-medium">{ceilingHeight}mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Floor Area:</span>
                  <span className="text-white font-medium">{bom.summary.areaSqM.toFixed(1)}m²</span>
                </div>
              </div>
            </div>
            
            {/* Components summary */}
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Components</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Posts</span>
                  <span className="text-white">{bom.posts.reduce((s, p) => s + p.quantity, 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Panels</span>
                  <span className="text-white">{bom.panels.reduce((s, p) => s + p.quantity, 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Doors</span>
                  <span className="text-white">{bom.doors.reduce((s, d) => s + d.quantity, 0)}</span>
                </div>
                {bom.spigots.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Spigots</span>
                    <span className="text-white">{bom.spigots.reduce((s, sp) => s + sp.quantity, 0)}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Doors detail */}
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Door Configuration</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Primary Door:</span>
                  <span className="text-white capitalize">{primaryDoorFace} Face</span>
                </div>
                {additionalDoors > 0 && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Additional:</span>
                    <span className="text-white">{additionalDoors} door{additionalDoors > 1 ? 's' : ''}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-zinc-400">Lock Type:</span>
                  <span className="text-white">{CAGE_LOCKS.find(l => l.id === lockType)?.name || 'Standard'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Roof Panels:</span>
                  <span className={includeRoof ? 'text-emerald-400' : 'text-zinc-500'}>{includeRoof ? 'Included' : 'None'}</span>
                </div>
              </div>
            </div>
            
            {/* Line items breakdown with product codes */}
            <div className="border-t border-zinc-700 pt-3">
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Bill of Materials</h3>
              <div className="space-y-2 text-xs">
                {/* Posts */}
                {bom.posts.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-zinc-500 uppercase font-medium">Posts</div>
                    {bom.posts.map((bomItem, i) => (
                      <div key={`post-${i}`} className="flex justify-between text-zinc-400 pl-2">
                        <div className="flex-1">
                          <span className="font-mono text-amber-500/80">{bomItem.item.code}</span>
                          <span className="mx-1.5">×{bomItem.quantity}</span>
                        </div>
                        <span>${(bomItem.item.price * bomItem.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Panels */}
                {bom.panels.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-zinc-500 uppercase font-medium">Panels</div>
                    {bom.panels.map((bomItem, i) => (
                      <div key={`panel-${i}`} className="flex justify-between text-zinc-400 pl-2">
                        <div className="flex-1">
                          <span className="font-mono text-amber-500/80">{bomItem.item.code}</span>
                          <span className="mx-1.5">×{bomItem.quantity}</span>
                        </div>
                        <span>${(bomItem.item.price * bomItem.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Doors */}
                {bom.doors.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-zinc-500 uppercase font-medium">Doors</div>
                    {bom.doors.map((bomItem, i) => (
                      <div key={`door-${i}`} className="flex justify-between text-zinc-400 pl-2">
                        <div className="flex-1">
                          <span className="font-mono text-amber-500/80">{bomItem.item.code}</span>
                          <span className="mx-1.5">×{bomItem.quantity}</span>
                        </div>
                        <span>${(bomItem.item.price * bomItem.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Locks */}
                {bom.locks.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-zinc-500 uppercase font-medium">Locks</div>
                    {bom.locks.map((bomItem, i) => (
                      <div key={`lock-${i}`} className="flex justify-between text-zinc-400 pl-2">
                        <div className="flex-1">
                          <span className="text-zinc-300">{bomItem.item.name}</span>
                          <span className="mx-1.5">×{bomItem.quantity}</span>
                        </div>
                        <span>${(bomItem.item.price * bomItem.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Roof Panels */}
                {includeRoof && (() => {
                  // Calculate roof panel count matching post grid exactly
                  const panelModule = 950; // 900mm panel + 50mm post
                  const postSz = 50;
                  
                  // Count full panels and fillers along each axis
                  const xFullPanels = Math.floor((cageLength - postSz) / panelModule);
                  const xRemainder = cageLength - postSz - (xFullPanels * panelModule);
                  const xHasFiller = xRemainder > 100; // More than 100mm remainder = filler panel
                  const xTotalCells = xFullPanels + (xHasFiller ? 1 : 0);
                  
                  const zFullPanels = Math.floor((cageWidth - postSz) / panelModule);
                  const zRemainder = cageWidth - postSz - (zFullPanels * panelModule);
                  const zHasFiller = zRemainder > 100;
                  const zTotalCells = zFullPanels + (zHasFiller ? 1 : 0);
                  
                  // Calculate panel types
                  const fullPanels = xFullPanels * zFullPanels; // Full 900×900
                  const xFillerPanels = xHasFiller ? zFullPanels : 0; // 900×filler
                  const zFillerPanels = zHasFiller ? xFullPanels : 0; // filler×900
                  const cornerFiller = (xHasFiller && zHasFiller) ? 1 : 0; // filler×filler
                  
                  const fullPrice = 185;
                  const fillerPrice = 95;
                  const totalFillers = xFillerPanels + zFillerPanels + cornerFiller;
                  const roofTotalPrice = (fullPanels * fullPrice) + (totalFillers * fillerPrice);
                  
                  return (
                    <div className="space-y-1">
                      <div className="text-[10px] text-zinc-500 uppercase font-medium">Roof Panels</div>
                      {fullPanels > 0 && (
                        <div className="flex justify-between text-zinc-400 pl-2">
                          <div className="flex-1">
                            <span className="font-mono text-amber-500/80">9TAT DCR.900.900</span>
                            <span className="mx-1.5">×{fullPanels}</span>
                          </div>
                          <span>${(fullPanels * fullPrice).toLocaleString()}</span>
                        </div>
                      )}
                      {totalFillers > 0 && (
                        <div className="flex justify-between text-zinc-400 pl-2">
                          <div className="flex-1">
                            <span className="font-mono text-amber-500/80">9TAT DCR.FILLER</span>
                            <span className="mx-1.5">×{totalFillers}</span>
                          </div>
                          <span>${(totalFillers * fillerPrice).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-zinc-300 pl-2 pt-1 border-t border-zinc-700/50">
                        <span className="text-xs">Roof subtotal ({xTotalCells}×{zTotalCells} grid)</span>
                        <span>${roofTotalPrice.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
          
          {/* Fixed bottom: Total + Request Quote */}
          <div className="p-4 border-t border-zinc-800 bg-zinc-900">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-zinc-300">Estimated Total</div>
                {includeRoof && (
                  <div className="text-xs text-zinc-500">Inc. roof panels</div>
                )}
              </div>
              <div className="text-2xl font-bold text-amber-500">
                ${(() => {
                  // Calculate roof cost if included - matching the BOM calculation
                  let roofCost = 0;
                  if (includeRoof) {
                    const panelModule = 950;
                    const postSz = 50;
                    const xFullPanels = Math.floor((cageLength - postSz) / panelModule);
                    const xRemainder = cageLength - postSz - (xFullPanels * panelModule);
                    const xHasFiller = xRemainder > 100;
                    const zFullPanels = Math.floor((cageWidth - postSz) / panelModule);
                    const zRemainder = cageWidth - postSz - (zFullPanels * panelModule);
                    const zHasFiller = zRemainder > 100;
                    
                    const fullPanels = xFullPanels * zFullPanels;
                    const xFillerPanels = xHasFiller ? zFullPanels : 0;
                    const zFillerPanels = zHasFiller ? xFullPanels : 0;
                    const cornerFiller = (xHasFiller && zHasFiller) ? 1 : 0;
                    const totalFillers = xFillerPanels + zFillerPanels + cornerFiller;
                    
                    roofCost = (fullPanels * 185) + (totalFillers * 95);
                  }
                  return (bom.totalPrice + roofCost).toLocaleString();
                })()}
              </div>
            </div>
            
            <button
              onClick={() => onRequestQuote(config, bom)}
              disabled={!validation.isValid}
              className={`w-full py-3 rounded font-medium transition-colors ${
                validation.isValid
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
              }`}
            >
              Request Quote
            </button>
            
            {/* Export Options */}
            <DataCageExportButtons 
              config={config} 
              bom={bom} 
              includeRoof={includeRoof}
              cageLength={cageLength}
              cageWidth={cageWidth}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PLAN VIEW COMPONENT
// ============================================================================

const PlanView: React.FC<{ config: CageConfiguration }> = ({ config }) => {
  const { lengthMm, widthMm, doors } = config;
  
  // Scale to fit viewport
  const maxDim = Math.max(lengthMm, widthMm);
  const scale = 300 / maxDim;
  const scaledLength = lengthMm * scale;
  const scaledWidth = widthMm * scale;
  
  const doorWidth = 1200 * scale;
  
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        {/* Grid background */}
        <div 
          className="absolute border-2 border-zinc-600 bg-zinc-900/50"
          style={{ width: scaledWidth, height: scaledLength }}
        >
          {/* Grid lines for 900mm modules */}
          {Array.from({ length: Math.floor(widthMm / 900) }).map((_, i) => (
            <div
              key={`v-${i}`}
              className="absolute top-0 bottom-0 border-l border-zinc-700/50"
              style={{ left: (i + 1) * 900 * scale }}
            />
          ))}
          {Array.from({ length: Math.floor(lengthMm / 900) }).map((_, i) => (
            <div
              key={`h-${i}`}
              className="absolute left-0 right-0 border-t border-zinc-700/50"
              style={{ top: (i + 1) * 900 * scale }}
            />
          ))}
        </div>
        
        {/* Cage outline */}
        <div 
          className="relative border-4 border-amber-500"
          style={{ width: scaledWidth, height: scaledLength }}
        >
          {/* Corner posts */}
          {[
            { x: 0, y: 0 },
            { x: scaledWidth - 8, y: 0 },
            { x: 0, y: scaledLength - 8 },
            { x: scaledWidth - 8, y: scaledLength - 8 },
          ].map((pos, i) => (
            <div
              key={`corner-${i}`}
              className="absolute w-2 h-2 bg-amber-600"
              style={{ left: pos.x, top: pos.y }}
            />
          ))}
          
          {/* Doors */}
          {doors.map((door, i) => {
            const doorDef = DOORS.find(d => d.id === door.doorId) || DOORS[0];
            const doorScaledWidth = doorDef.openingWidthMm * scale;
            
            let style: React.CSSProperties = {};
            switch (door.face) {
              case 'front':
                style = { left: door.positionMm * scale, top: -6, width: doorScaledWidth, height: 12 };
                break;
              case 'rear':
                style = { left: door.positionMm * scale, bottom: -6, width: doorScaledWidth, height: 12 };
                break;
              case 'left':
                style = { left: -6, top: door.positionMm * scale, width: 12, height: doorScaledWidth };
                break;
              case 'right':
                style = { right: -6, top: door.positionMm * scale, width: 12, height: doorScaledWidth };
                break;
            }
            
            return (
              <div
                key={`door-${i}`}
                className="absolute bg-emerald-500 border-2 border-emerald-400"
                style={style}
              >
                <div className="absolute inset-0 flex items-center justify-center text-[8px] text-white font-bold">
                  D{i + 1}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Dimension labels */}
        <div 
          className="absolute -bottom-8 left-0 right-0 text-center text-xs text-zinc-400"
        >
          {widthMm}mm
        </div>
        <div 
          className="absolute -right-12 top-0 bottom-0 flex items-center text-xs text-zinc-400"
          style={{ writingMode: 'vertical-rl' }}
        >
          {lengthMm}mm
        </div>
        
        {/* Face labels */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-zinc-500">FRONT</div>
        <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 text-xs text-zinc-500">REAR</div>
        <div className="absolute top-1/2 -left-10 -translate-y-1/2 text-xs text-zinc-500">LEFT</div>
        <div className="absolute top-1/2 -right-10 -translate-y-1/2 text-xs text-zinc-500">RIGHT</div>
      </div>
    </div>
  );
};

// ============================================================================
// ELEVATION VIEW COMPONENT
// ============================================================================

interface ElevationViewProps {
  config: CageConfiguration;
  infillHeight: number;
  bottomHeight: number;
  upperHeight: number;
}

const ElevationView: React.FC<ElevationViewProps> = ({ config, infillHeight, bottomHeight, upperHeight }) => {
  const [activeFace, setActiveFace] = useState<CageFace>('front');
  const { ceilingHeightMm, lengthMm, widthMm, doors } = config;
  
  // Get face dimension based on active face
  const faceWidth = (activeFace === 'front' || activeFace === 'rear') ? widthMm : lengthMm;
  
  // Get doors on this face
  const faceDoors = doors.filter(d => d.face === activeFace);
  
  // Scale to fit viewport
  const maxDim = Math.max(ceilingHeightMm, faceWidth);
  const scale = 260 / maxDim;
  const scaledHeight = ceilingHeightMm * scale;
  const scaledWidth = faceWidth * scale;
  
  const bottomHeightScaled = bottomHeight * scale;
  const upperHeightScaled = upperHeight * scale;
  const infillScaled = infillHeight * scale;
  const doorWidthScaled = 1200 * scale;
  const doorHeightScaled = 2260 * scale;
  
  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Face selector tabs */}
      <div className="flex justify-center gap-1 p-3 bg-zinc-900/50">
        {(['front', 'rear', 'left', 'right'] as CageFace[]).map(face => {
          const hasDoor = doors.some(d => d.face === face);
          return (
            <button
              key={face}
              onClick={() => setActiveFace(face)}
              className={`px-4 py-1.5 text-xs font-medium rounded transition-colors capitalize ${
                activeFace === face 
                  ? 'bg-amber-500 text-black' 
                  : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              {face} {hasDoor && '🚪'}
            </button>
          );
        })}
      </div>
      
      {/* Elevation drawing */}
      <div className="flex-1 flex items-center justify-center">
        <div className="relative">
          {/* Face label */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-sm font-medium text-zinc-400 uppercase tracking-wide">
            {activeFace} Elevation
          </div>
          
          {/* Dimension label */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-xs text-zinc-500">
            {faceWidth}mm
          </div>
          
          {/* Height dimension */}
          <div className="absolute -left-12 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-zinc-500 whitespace-nowrap">
            {ceilingHeightMm}mm
          </div>
          
          {/* Ground line */}
          <div 
            className="absolute -bottom-4 border-t-2 border-zinc-600"
            style={{ width: scaledWidth + 40, left: -20 }}
          />
          
          {/* Cage elevation */}
          <div 
            className="relative border-2 border-amber-500"
            style={{ width: scaledWidth, height: scaledHeight }}
          >
            {/* Panel sections */}
            {/* Bottom panels */}
            <div 
              className="absolute bottom-0 left-0 right-0 border-t-2 border-dashed border-zinc-600 bg-zinc-800/30"
              style={{ height: bottomHeightScaled }}
            >
              <div className="absolute -right-16 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">
                Bottom<br/>{bottomHeight}mm
              </div>
            </div>
            
            {/* Upper panels - only show if height > 0 */}
            {upperHeight > 0 && (
              <div 
                className="absolute left-0 right-0 border-t-2 border-dashed border-zinc-600 bg-zinc-700/30"
                style={{ bottom: bottomHeightScaled, height: upperHeightScaled }}
              >
                <div className="absolute -right-16 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">
                  Upper<br/>{upperHeight}mm
                </div>
              </div>
            )}
            
            {/* Infill panels (if needed) */}
            {infillHeight > 0 && (
              <div 
                className="absolute top-0 left-0 right-0 border-b-2 border-dashed border-emerald-600 bg-emerald-900/20"
                style={{ height: infillScaled }}
              >
                <div className="absolute -right-16 top-1/2 -translate-y-1/2 text-[10px] text-emerald-500">
                  Infill<br/>{infillHeight}mm
                </div>
              </div>
            )}
            
            {/* Door openings on this face */}
            {faceDoors.map((door, idx) => {
              const doorPos = door.positionMm * scale;
              return (
                <div 
                  key={idx}
                  className="absolute bottom-0 bg-emerald-500/30 border-2 border-emerald-500"
                  style={{ 
                    left: doorPos, 
                    width: doorWidthScaled,
                    height: doorHeightScaled,
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-emerald-400">
                    Door {idx + 1}
                  </div>
                </div>
              );
            })}
            
            {/* No door indicator */}
            {faceDoors.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-600">
                No doors on this face
              </div>
            )}
            
            {/* Posts at corners */}
            <div className="absolute bottom-0 left-0 w-2 bg-amber-600" style={{ height: scaledHeight }} />
            <div className="absolute bottom-0 right-0 w-2 bg-amber-600" style={{ height: scaledHeight }} />
          </div>
          
          {/* Ceiling line */}
          <div className="absolute -top-2 left-0 right-0 border-t border-dashed border-zinc-500" style={{ width: scaledWidth + 20, left: -10 }} />
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-zinc-500">CEILING</div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PERFORATED MESH PANEL COMPONENT
// ============================================================================

interface MeshPanelProps {
  panelWidth: number;
  panelHeight: number;
  position: [number, number, number];
}

const PerforatedMeshPanel: React.FC<MeshPanelProps> = ({ panelWidth, panelHeight, position }) => {
  // Panel frame thickness
  const frameThickness = 0.02; // 20mm frame
  const innerWidth = panelWidth - frameThickness * 2;
  const innerHeight = panelHeight - frameThickness * 2;
  
  // Grid pattern - more visible mesh
  const cols = Math.max(3, Math.floor(innerWidth / 0.08)); // ~80mm spacing
  const rows = Math.max(3, Math.floor(innerHeight / 0.08));
  
  return (
    <group position={position}>
      {/* Panel frame - dark steel color */}
      {/* Top frame */}
      <mesh position={[0, panelHeight / 2 - frameThickness / 2, 0]}>
        <boxGeometry args={[panelWidth, frameThickness, 0.008]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Bottom frame */}
      <mesh position={[0, -panelHeight / 2 + frameThickness / 2, 0]}>
        <boxGeometry args={[panelWidth, frameThickness, 0.008]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Left frame */}
      <mesh position={[-panelWidth / 2 + frameThickness / 2, 0, 0]}>
        <boxGeometry args={[frameThickness, innerHeight, 0.008]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Right frame */}
      <mesh position={[panelWidth / 2 - frameThickness / 2, 0, 0]}>
        <boxGeometry args={[frameThickness, innerHeight, 0.008]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
      </mesh>
      
      {/* Mesh background - 80% transparent for see-through effect */}
      <mesh position={[0, 0, -0.002]}>
        <boxGeometry args={[innerWidth, innerHeight, 0.001]} />
        <meshStandardMaterial 
          color="#1a1a1a" 
          transparent 
          opacity={0.2} 
          metalness={0.3} 
          roughness={0.6}
          side={2}
        />
      </mesh>
      
      {/* Grid lines - horizontal (wire mesh effect) */}
      {Array.from({ length: rows + 1 }).map((_, i) => {
        const y = -innerHeight / 2 + (i * innerHeight / rows);
        return (
          <mesh key={`h-${i}`} position={[0, y, 0]}>
            <boxGeometry args={[innerWidth, 0.003, 0.003]} />
            <meshStandardMaterial color="#3a3a3a" metalness={0.6} roughness={0.4} />
          </mesh>
        );
      })}
      
      {/* Grid lines - vertical (wire mesh effect) */}
      {Array.from({ length: cols + 1 }).map((_, i) => {
        const x = -innerWidth / 2 + (i * innerWidth / cols);
        return (
          <mesh key={`v-${i}`} position={[x, 0, 0]}>
            <boxGeometry args={[0.003, innerHeight, 0.003]} />
            <meshStandardMaterial color="#3a3a3a" metalness={0.6} roughness={0.4} />
          </mesh>
        );
      })}
    </group>
  );
};

interface MeshPanelWallProps {
  wallWidth: number;
  wallHeight: number;
  bottomH: number;
  upperH: number;
  infillH: number;
  position: [number, number, number];
  rotation: [number, number, number];
  doors: { face: CageFace; positionMm: number; doorId: string }[];
  doorsOpen?: boolean;
  face: CageFace; // Which face this wall represents
}

const MeshPanelWall: React.FC<MeshPanelWallProps> = ({ 
  wallWidth, wallHeight, bottomH, upperH, infillH, position, rotation, doors, doorsOpen = false, face 
}) => {
  // Note: wallHeight is available but not directly used - height comes from bottomH + upperH + infillH
  void wallHeight; // Suppress unused warning
  const totalHeight = bottomH + upperH + infillH;
  
  // Panel dimensions from PDF spec
  const standardPanelWidth = 0.9; // 900mm standard panel
  const fillerPanelWidth = 0.25; // 250mm filler panel
  const postSize = 0.05; // 50mm × 50mm RHS posts
  
  // Calculate how many standard panels fit, then add filler if needed
  // Wall layout: [Panel 900][Post 50][Panel 900][Post 50]...[Filler 250 if needed]
  const availableWidth = wallWidth; // Width between corner posts
  const moduleWidth = standardPanelWidth + postSize; // Each panel + following post = 950mm
  const standardPanelCount = Math.floor((availableWidth + postSize) / moduleWidth); // +postSize because last panel has no post
  const usedWidth = standardPanelCount * standardPanelWidth + (standardPanelCount - 1) * postSize;
  const remainingWidth = availableWidth - usedWidth;
  const needsFiller = remainingWidth > 0.1; // Need filler if > 100mm remaining
  const fillerWidth = needsFiller ? remainingWidth - postSize : 0; // Filler panel width
  
  // Door opening dimensions
  const doorOpeningWidth = 1.2; // 1200mm opening
  
  // Check if a panel position is in door area (for bottom tier only)
  // Only remove panel if its CENTER is within the door opening
  const isInDoorArea = (panelCenterX: number) => {
    for (const door of doors) {
      const doorLeft = (door.positionMm / 1000) - wallWidth / 2;
      const doorRight = doorLeft + doorOpeningWidth;
      // Only remove if panel CENTER is within door opening (with small margin)
      if (panelCenterX > doorLeft + 0.05 && panelCenterX < doorRight - 0.05) return true;
    }
    return false;
  };
  
  // Build panel positions array
  const panels: { x: number; width: number; isLast: boolean }[] = [];
  let currentX = -wallWidth / 2;
  
  for (let i = 0; i < standardPanelCount; i++) {
    panels.push({
      x: currentX + standardPanelWidth / 2,
      width: standardPanelWidth,
      isLast: !needsFiller && i === standardPanelCount - 1
    });
    currentX += standardPanelWidth + postSize;
  }
  
  // Add filler panel if needed
  if (needsFiller && fillerWidth > 0.05) {
    panels.push({
      x: currentX + fillerWidth / 2,
      width: fillerWidth,
      isLast: true
    });
  }
  
  return (
    <group position={position} rotation={rotation}>
      {/* Generate panels and posts */}
      {panels.map((panel, i) => {
        const hasDoor = isInDoorArea(panel.x);
        
        return (
          <React.Fragment key={`panel-${i}`}>
            {/* Bottom panel (2300mm) - skip if door opening */}
            {!hasDoor && (
              <PerforatedMeshPanel
                panelWidth={panel.width - 0.01}
                panelHeight={bottomH - 0.01}
                position={[panel.x, bottomH / 2, 0]}
              />
            )}
            
            {/* Upper panel (1200mm) - always show */}
            <PerforatedMeshPanel
              panelWidth={panel.width - 0.01}
              panelHeight={upperH - 0.01}
              position={[panel.x, bottomH + upperH / 2, 0]}
            />
            
            {/* Infill panel (variable height) - show if > 50mm */}
            {infillH > 0.05 && (
              <PerforatedMeshPanel
                panelWidth={panel.width - 0.01}
                panelHeight={infillH - 0.01}
                position={[panel.x, bottomH + upperH + infillH / 2, 0]}
              />
            )}
            
            {/* Repeat post AFTER this panel (except last panel - corner post handles that) */}
            {!panel.isLast && (
              <mesh position={[panel.x + panel.width / 2 + postSize / 2, totalHeight / 2, 0]}>
                <boxGeometry args={[postSize, totalHeight, postSize]} />
                <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.4} />
              </mesh>
            )}
          </React.Fragment>
        );
      })}
      
      {/* Horizontal rails at tier boundaries */}
      <mesh position={[0, bottomH, 0.01]}>
        <boxGeometry args={[wallWidth + postSize, 0.025, 0.025]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, bottomH + upperH, 0.01]}>
        <boxGeometry args={[wallWidth + postSize, 0.025, 0.025]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, totalHeight, 0.01]}>
        <boxGeometry args={[wallWidth + postSize, 0.025, 0.025]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[wallWidth + postSize, 0.025, 0.025]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Sliding Door Assemblies - positioned OUTSIDE the cage (in front of panels) */}
      {doors.map((door, i) => {
        // Door position - positionMm is left edge of door opening
        const doorLeftX = (door.positionMm / 1000) - wallWidth / 2;
        const doorWidth = 1.2; // 1200mm door panel width
        const doorHeight = 2.26; // 2260mm door height
        const framePost = 0.04; // 40mm frame posts
        const trackHeight = 0.04;
        const doorPanelWidth = doorWidth;
        const doorPanelHeight = doorHeight - 0.02;
        
        // Determine slide direction (default: slide left)
        const slideDir = (door as any).slideDirection || 'left';
        
        // Track length: door width + extension for door to slide clear
        // For center position, door slides to side, track only needs to extend by door width
        const trackTotalLength = doorWidth + framePost + 0.05; // Just enough for door to clear
        const trackOffset = slideDir === 'left' ? -trackTotalLength / 2 + doorWidth / 2 : trackTotalLength / 2 - doorWidth / 2;
        
        // Lock type from door config
        const lockId = (door as any).lockId || 'lock-keyed-standard';
        const isComboLock = lockId.includes('combination');
        
        // Door Z position - must be OUTSIDE the cage
        // The direction "outside" depends on which face and its rotation:
        // - Front wall (rotation 0): outside is -Z, so doorZ = -0.12
        // - Rear wall (rotation 180°): local +Z becomes world -Z, so to go outside (+Z world) need doorZ = -0.12
        // - Left wall (rotation -90°): local +Z becomes world -X, so to go outside (-X world) need doorZ = +0.12
        // - Right wall (rotation +90°): local +Z becomes world +X, so to go outside (+X world) need doorZ = +0.12
        const doorZ = (face === 'front' || face === 'rear') ? -0.12 : 0.12;
        
        return (
          <group key={`door-${i}`} position={[doorLeftX, 0, doorZ]}>
            {/* Frame posts on BOTH sides of door opening */}
            {/* Left frame post */}
            <mesh position={[-framePost / 2, doorHeight / 2, 0]}>
              <boxGeometry args={[framePost, doorHeight, 0.03]} />
              <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Right frame post */}
            <mesh position={[doorWidth + framePost / 2, doorHeight / 2, 0]}>
              <boxGeometry args={[framePost, doorHeight, 0.03]} />
              <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Top frame beam */}
            <mesh position={[doorWidth / 2, doorHeight + framePost / 2, 0]}>
              <boxGeometry args={[doorWidth + framePost * 2, framePost, 0.03]} />
              <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Bottom threshold */}
            <mesh position={[doorWidth / 2, framePost / 2, 0]}>
              <boxGeometry args={[doorWidth + framePost * 2, framePost, 0.03]} />
              <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
            </mesh>
            
            {/* Top track rail - extends in slide direction only */}
            <mesh position={[doorWidth / 2 + trackOffset, doorHeight + trackHeight / 2 + framePost, 0.015]}>
              <boxGeometry args={[trackTotalLength, trackHeight, 0.03]} />
              <meshStandardMaterial color="#3a3a3a" metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Bottom track/guide */}
            <mesh position={[doorWidth / 2 + trackOffset, 0.01, 0.015]}>
              <boxGeometry args={[trackTotalLength, 0.02, 0.015]} />
              <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.4} />
            </mesh>
            
            {/* The sliding door panel - slides based on doorsOpen state */}
            {/* Door panel fills the frame opening exactly, edges align with frame posts */}
            <group position={[
              doorWidth / 2 + (doorsOpen ? (slideDir === 'left' ? -doorWidth - framePost : doorWidth + framePost) : 0), 
              doorHeight / 2 + framePost / 2, 
              0.025
            ]}>
              {/* Door panel frame - sized to fill opening exactly */}
              {/* Top frame */}
              <mesh position={[0, doorPanelHeight / 2 - 0.015, 0]}>
                <boxGeometry args={[doorPanelWidth, 0.03, 0.02]} />
                <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
              </mesh>
              {/* Bottom frame */}
              <mesh position={[0, -doorPanelHeight / 2 + 0.015, 0]}>
                <boxGeometry args={[doorPanelWidth, 0.03, 0.02]} />
                <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
              </mesh>
              {/* Left frame */}
              <mesh position={[-doorPanelWidth / 2 + 0.015, 0, 0]}>
                <boxGeometry args={[0.03, doorPanelHeight - 0.03, 0.02]} />
                <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
              </mesh>
              {/* Right frame */}
              <mesh position={[doorPanelWidth / 2 - 0.015, 0, 0]}>
                <boxGeometry args={[0.03, doorPanelHeight - 0.03, 0.02]} />
                <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
              </mesh>
              
              {/* Door mesh panel - transparent */}
              <mesh position={[0, 0, -0.008]}>
                <boxGeometry args={[doorPanelWidth - 0.02, doorPanelHeight - 0.08, 0.005]} />
                <meshStandardMaterial color="#1a1a1a" transparent opacity={0.25} metalness={0.3} roughness={0.6} side={2} />
              </mesh>
              
              {/* Door mesh grid pattern */}
              {Array.from({ length: Math.floor(doorPanelHeight / 0.1) }).map((_, row) => (
                <mesh key={`dh-${row}`} position={[0, -doorPanelHeight / 2 + 0.1 + row * 0.1, 0]}>
                  <boxGeometry args={[doorPanelWidth - 0.06, 0.003, 0.003]} />
                  <meshStandardMaterial color="#3a3a3a" metalness={0.5} roughness={0.5} />
                </mesh>
              ))}
              {Array.from({ length: Math.floor(doorPanelWidth / 0.08) }).map((_, col) => (
                <mesh key={`dv-${col}`} position={[-doorPanelWidth / 2 + 0.06 + col * 0.08, 0, 0]}>
                  <boxGeometry args={[0.003, doorPanelHeight - 0.1, 0.003]} />
                  <meshStandardMaterial color="#3a3a3a" metalness={0.5} roughness={0.5} />
                </mesh>
              ))}
              
              {/* Central horizontal bar (structural) */}
              <mesh position={[0, 0, 0.01]}>
                <boxGeometry args={[doorPanelWidth - 0.02, 0.035, 0.015]} />
                <meshStandardMaterial color="#505050" metalness={0.6} roughness={0.4} />
              </mesh>
              
              {/* Lock ON THE DOOR - positioned at handle height */}
              <group position={[slideDir === 'left' ? doorPanelWidth / 2 - 0.08 : -doorPanelWidth / 2 + 0.08, 0, 0.02]}>
                {isComboLock ? (
                  /* Combination lock - like V50 */
                  <>
                    {/* Lock body */}
                    <mesh>
                      <boxGeometry args={[0.06, 0.1, 0.03]} />
                      <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.2} />
                    </mesh>
                    {/* Dial face */}
                    <mesh position={[0, 0.01, 0.018]} rotation={[0, 0, 0]}>
                      <cylinderGeometry args={[0.022, 0.022, 0.008, 24]} />
                      <meshStandardMaterial color="#333333" metalness={0.9} roughness={0.1} />
                    </mesh>
                    {/* Dial markings */}
                    <mesh position={[0, 0.01, 0.023]}>
                      <cylinderGeometry args={[0.018, 0.018, 0.002, 24]} />
                      <meshStandardMaterial color="#666666" metalness={0.7} roughness={0.3} />
                    </mesh>
                    {/* Handle */}
                    <mesh position={[0, -0.035, 0.015]}>
                      <boxGeometry args={[0.04, 0.015, 0.01]} />
                      <meshStandardMaterial color="#555555" metalness={0.8} roughness={0.2} />
                    </mesh>
                  </>
                ) : (
                  /* Keyed lock - standard */
                  <>
                    {/* Lock body */}
                    <mesh>
                      <boxGeometry args={[0.05, 0.08, 0.025]} />
                      <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
                    </mesh>
                    {/* Key cylinder */}
                    <mesh position={[0, 0.01, 0.015]} rotation={[Math.PI / 2, 0, 0]}>
                      <cylinderGeometry args={[0.012, 0.012, 0.015, 16]} />
                      <meshStandardMaterial color="#b8860b" metalness={0.9} roughness={0.1} />
                    </mesh>
                    {/* Keyhole plate */}
                    <mesh position={[0, 0.01, 0.014]}>
                      <cylinderGeometry args={[0.016, 0.016, 0.003, 16]} />
                      <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
                    </mesh>
                    {/* Handle bar */}
                    <mesh position={[0, -0.025, 0.015]}>
                      <boxGeometry args={[0.035, 0.012, 0.008]} />
                      <meshStandardMaterial color="#444444" metalness={0.7} roughness={0.3} />
                    </mesh>
                  </>
                )}
              </group>
            </group>
          </group>
        );
      })}
    </group>
  );
};

// ============================================================================
// ISOMETRIC 3D VIEW COMPONENT
// ============================================================================

type BgMode = 'dark' | 'light' | 'photo';

interface IsometricViewProps {
  config: CageConfiguration;
  infillHeight: number;
  bottomHeight: number;
  upperHeight: number;
  includeRoof: boolean;
}

const IsometricView: React.FC<IsometricViewProps> = ({ config, infillHeight, bottomHeight, upperHeight, includeRoof }) => {
  const [bgMode, setBgMode] = useState<BgMode>('photo');
  const [doorsOpen, setDoorsOpen] = useState(false);
  const controlsRef = useRef<any>(null);
  const { lengthMm, widthMm, ceilingHeightMm, doors } = config;
  
  // Convert mm to meters for 3D scene
  const length = lengthMm / 1000;
  const width = widthMm / 1000;
  const height = ceilingHeightMm / 1000;
  
  // Panel heights in meters (from calculated values, not fixed constants)
  const bottomH = bottomHeight / 1000;
  const upperH = upperHeight / 1000;
  const infillH = infillHeight / 1000;
  
  // Post dimensions
  const postSize = 0.05; // 50mm
  
  // Calculate camera distance based on cage size
  const maxDim = Math.max(length, width, height);
  const camDist = maxDim * 1.8;
  
  return (
    <div className="absolute inset-0">
      {/* Background Mode Toggle */}
      <div className="absolute top-4 left-4 z-20 flex gap-2">
        <div className="flex gap-1 bg-zinc-900/80 backdrop-blur-sm p-1 rounded-lg border border-zinc-700">
          {(['dark', 'light', 'photo'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setBgMode(mode)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors capitalize ${
                bgMode === mode 
                  ? 'bg-amber-500 text-black' 
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        
        {/* Door Open/Close Toggle */}
        <button
          onClick={() => setDoorsOpen(!doorsOpen)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
            doorsOpen 
              ? 'bg-emerald-600 text-white border-emerald-500' 
              : 'bg-zinc-900/80 text-zinc-400 border-zinc-700 hover:text-white hover:bg-zinc-700'
          }`}
        >
          🚪 {doorsOpen ? 'Close Door' : 'Open Door'}
        </button>
      </div>
      
      <Canvas shadows>
        {/* Perspective camera */}
        <PerspectiveCamera
          makeDefault
          fov={50}
          position={[camDist, camDist * 0.7, -camDist]}
          near={0.1}
          far={1000}
        />
        <OrbitControls 
          ref={controlsRef}
          makeDefault
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={50}
          target={[0, height / 2, 0]}
        />
        
        {/* Environment matching other viewers */}
        {bgMode === 'photo' ? <Environment preset="warehouse" background blur={0.6} /> : <Environment preset="city" />}
        {bgMode === 'dark' && <color attach="background" args={['#18181b']} />}
        {bgMode === 'light' && <color attach="background" args={['#e4e4e7']} />}
        
        {/* Lighting matching other viewers */}
        <ambientLight intensity={bgMode === 'photo' ? 1.0 : 0.8} />
        <directionalLight position={[5, 8, 5]} intensity={bgMode === 'photo' ? 2.0 : 1.5} castShadow shadow-bias={-0.0001} />
        <directionalLight position={[-3, 4, -2]} intensity={0.6} />
        
        {/* Grid matching other viewers */}
        {bgMode !== 'photo' && (
          <Grid 
            position={[0, -0.01, 0]} 
            args={[20, 20]} 
            cellSize={0.5} 
            cellThickness={0.5} 
            cellColor={bgMode === 'light' ? '#a1a1aa' : '#3f3f46'} 
            sectionSize={1} 
            sectionThickness={1} 
            sectionColor={bgMode === 'light' ? '#71717a' : '#52525b'} 
            fadeDistance={10} 
            fadeStrength={1} 
            infiniteGrid 
          />
        )}
        
        {/* Cage group - centered */}
        <group position={[-length / 2, 0, -width / 2]}>
          
          {/* Corner posts */}
          {[
            [0, 0],
            [length, 0],
            [0, width],
            [length, width],
          ].map(([x, z], i) => (
            <mesh key={`post-${i}`} position={[x, height / 2, z]}>
              <boxGeometry args={[postSize, height, postSize]} />
              <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
          
          {/* Perforated mesh panels with visible grid pattern */}
          {/* Repeat posts are created by MeshPanelWall between each panel */}
          {/* Front wall panels (at Z=0 edge, facing -Z direction) */}
          <MeshPanelWall 
            wallWidth={length - postSize} 
            wallHeight={height} 
            bottomH={bottomH} 
            upperH={upperH}
            infillH={infillH}
            position={[length / 2, 0, 0]} 
            rotation={[0, 0, 0]}
            doors={doors.filter(d => d.face === 'front')}
            doorsOpen={doorsOpen}
            face="front"
          />
          
          {/* Rear wall panels (at Z=width edge, facing +Z direction) */}
          <MeshPanelWall 
            wallWidth={length - postSize} 
            wallHeight={height} 
            bottomH={bottomH} 
            upperH={upperH}
            infillH={infillH}
            position={[length / 2, 0, width]} 
            rotation={[0, Math.PI, 0]}
            doors={doors.filter(d => d.face === 'rear')}
            doorsOpen={doorsOpen}
            face="rear"
          />
          
          {/* Left wall panels (at X=0 edge, facing -X direction) */}
          <MeshPanelWall 
            wallWidth={width - postSize} 
            wallHeight={height} 
            bottomH={bottomH} 
            upperH={upperH}
            infillH={infillH}
            position={[0, 0, width / 2]} 
            rotation={[0, -Math.PI / 2, 0]}
            doors={doors.filter(d => d.face === 'left')}
            doorsOpen={doorsOpen}
            face="left"
          />
          
          {/* Right wall panels (at X=length edge, facing +X direction) */}
          <MeshPanelWall 
            wallWidth={width - postSize} 
            wallHeight={height} 
            bottomH={bottomH} 
            upperH={upperH}
            infillH={infillH}
            position={[length, 0, width / 2]} 
            rotation={[0, Math.PI / 2, 0]}
            doors={doors.filter(d => d.face === 'right')}
            doorsOpen={doorsOpen}
            face="right"
          />
          
          {/* Top frame rails - perimeter */}
          <mesh position={[length / 2, height, 0]}>
            <boxGeometry args={[length, 0.025, postSize]} />
            <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[length / 2, height, width]}>
            <boxGeometry args={[length, 0.025, postSize]} />
            <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, height, width / 2]}>
            <boxGeometry args={[postSize, 0.025, width]} />
            <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[length, height, width / 2]}>
            <boxGeometry args={[postSize, 0.025, width]} />
            <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.4} />
          </mesh>
          
          {/* Roof system (optional) - aligned with wall post grid */}
          {includeRoof && (() => {
            // Calculate post positions along length (X axis)
            const panelModule = 0.9; // 900mm panel
            const xPostCount = Math.floor((length - postSize) / (panelModule + postSize));
            const xPosts: number[] = [0]; // Start with corner
            for (let i = 1; i <= xPostCount; i++) {
              xPosts.push(i * (panelModule + postSize));
            }
            xPosts.push(length); // End with corner
            
            // Calculate post positions along width (Z axis)
            const zPostCount = Math.floor((width - postSize) / (panelModule + postSize));
            const zPosts: number[] = [0]; // Start with corner
            for (let i = 1; i <= zPostCount; i++) {
              zPosts.push(i * (panelModule + postSize));
            }
            zPosts.push(width); // End with corner
            
            return (
              <>
                {/* Roof support rails along X axis (at each Z post position) */}
                {zPosts.map((z, zi) => (
                  <mesh key={`roof-rail-x-${zi}`} position={[length / 2, height + 0.015, z]}>
                    <boxGeometry args={[length, 0.02, 0.025]} />
                    <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.4} />
                  </mesh>
                ))}
                
                {/* Roof support rails along Z axis (at each X post position) */}
                {xPosts.map((x, xi) => (
                  <mesh key={`roof-rail-z-${xi}`} position={[x, height + 0.015, width / 2]}>
                    <boxGeometry args={[0.025, 0.02, width]} />
                    <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.4} />
                  </mesh>
                ))}
                
                {/* Roof mesh panels - fill each grid cell */}
                {xPosts.slice(0, -1).map((x, xi) => {
                  const nextX = xPosts[xi + 1];
                  const cellWidth = nextX - x - postSize;
                  
                  return zPosts.slice(0, -1).map((z, zi) => {
                    const nextZ = zPosts[zi + 1];
                    const cellDepth = nextZ - z - postSize;
                    
                    if (cellWidth > 0.05 && cellDepth > 0.05) {
                      return (
                        <group 
                          key={`roof-panel-${xi}-${zi}`}
                          position={[x + postSize / 2 + cellWidth / 2, height + 0.025, z + postSize / 2 + cellDepth / 2]}
                          rotation={[-Math.PI / 2, 0, 0]}
                        >
                          <PerforatedMeshPanel
                            panelWidth={cellWidth}
                            panelHeight={cellDepth}
                            position={[0, 0, 0]}
                          />
                        </group>
                      );
                    }
                    return null;
                  });
                })}
              </>
            );
          })()}
          
        </group>
        
        {/* Contact shadows */}
        <ContactShadows 
          position={[0, -0.001, 0]} 
          opacity={0.4} 
          scale={20} 
          blur={2.5} 
          far={6} 
        />
      </Canvas>
      
      {/* Pan controls overlay */}
      <SceneControlsOverlay controlsRef={controlsRef} />
      
      {/* View controls hint */}
      <div className="absolute bottom-4 left-4 text-xs text-zinc-500 bg-zinc-900/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-zinc-700">
        Drag to rotate • Scroll to zoom • Shift+drag to pan
      </div>
    </div>
  );
};

export default DataCageConfigurator;
