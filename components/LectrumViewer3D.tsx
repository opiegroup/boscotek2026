import React, { useRef, Suspense, forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Html } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { ConfigurationState, ProductDefinition } from '../types';
import { FRAME_COLOURS, PANEL_COLOURS } from '../services/products/lectrumConstants';
import { getLectrumModelInfo } from '../services/products/lectrumCatalog';

type BgMode = 'dark' | 'light' | 'photo';

// ============================================================================
// Types
// ============================================================================

interface LectrumViewer3DProps {
  config: ConfigurationState;
  product: ProductDefinition;
}

export interface LectrumViewer3DRef {
  captureThumbnail: () => string | null;
}

// ============================================================================
// Material Mapping per Model
// ============================================================================

interface MaterialMapping {
  frame: string[];      // Materials that get Frame Colour
  panel: string[];      // Materials that get Panel Colour
  silver: string[];     // Materials that stay silver/metallic
  black: string[];      // Materials that stay black
  logo: string[];       // Logo/badge areas
}

// Comprehensive material mappings based on actual MTL file contents
const MATERIAL_MAPPINGS: Record<string, MaterialMapping> = {
  'L2001': {
    frame: ['frame', 'toppanel', 'topplate'],
    panel: ['Front_panel', 'Toppanelfelt'],
    silver: ['siberfoort', 'Pins', 'Screws'],
    black: ['Blackpalstic', 'blackrubber', 'goosneck', 'wheel', 'Foam'],
    logo: ['logodisplay'],
  },
  'L2001C': {
    frame: ['Frame', 'Top_panel', 'topplate', 'lecterntop'],
    panel: ['Front_panel', 'Toppanelfelt'],
    silver: ['Silverpins', 'Silver_Screws', 'feet', 'XLR'],
    black: ['Foam', 'Gooseneck', 'Wheel_', 'blackpasic', '_lightneck', 'feet_rubber', 'frame_buttons', 'clcokface', 'clockbuttons'],
    logo: ['logo_panel', 'Boarder_Print'],
  },
  'L2001-CTL': {
    frame: ['Frame', 'Top_panel', 'topplate', 'lecterntop'],
    panel: ['Front_panel', 'Toppanelfelt', 'frontpanel', 'Frontpanel'],
    silver: ['Silverpins', 'Silver_Screws', 'feet', 'XLR', 'metal'],
    black: ['Foam', 'Gooseneck', 'Wheel_', 'blackpasic', '_lightneck', 'feet_rubber', 'frame_buttons', 'screen'],
    logo: ['logo_panel', 'Boarder_Print'],
  },
  'L20': {
    frame: ['Frame', 'Top_panel'],
    panel: ['frontttpanel'],
    silver: ['Sttelfeet', 'Screw'],
    black: ['black_rubber'],
    logo: ['Lectrumbabadge', 'lectrumlogotext'],
  },
  'L20S': {
    frame: ['Frame', 'toppanel'],
    panel: ['Frontbackpanel'],
    silver: ['Siver', 'Sivermetal', 'feetsilevr', 'Screws'],
    black: ['BlackPastic', 'Gooseneck', 'blackfoam', 'feetrubber'],
    logo: ['logoplate'],
  },
  'L20S-NCTL': {
    frame: ['Frame', 'toppanel'],
    panel: ['Frontbackpanel'],
    silver: ['Siver', 'Sivermetal', 'feetsilevr', 'Screws'],
    black: ['BlackPastic', 'Gooseneck', 'blackfoam', 'feetrubber'],
    logo: ['logoplate'],
  },
  'L900': {
    frame: ['Black_Frame'],
    panel: ['Customisable_Panel', 'Felt_top'],
    silver: ['Mikepins', 'Screws', 'feet'],
    black: ['black_rubber_', 'Mic_Gooseneck'],
    logo: ['Logo'],
  },
  'L101': {
    frame: ['Frame', 'Toppanel', 'toppanel'],
    panel: ['Front_Panel', 'frontpanel'],
    silver: ['Screws', 'SiverfeetScrewa', 'Sileverpins', 'XLRtabs', 'Controlpanel'],
    black: ['BlackPlastic', 'Goosnect_gloss', 'rubberfeet', 'Badge1', 'Diplaypanel3', 'diplaypanel2', 'clockOuter', 'Glass_plate'],
    logo: ['Whitetopetext', 'white_boarder', 'XLRplate'],
  },
};

// Default mapping for unknown models
const DEFAULT_MAPPING: MaterialMapping = {
  frame: ['frame', 'Frame', 'toppanel', 'topplate', 'Top_panel'],
  panel: ['Front_panel', 'frontpanel', 'Frontpanel', 'panel', 'Panel', 'Customisable'],
  silver: ['silver', 'Silver', 'Siver', 'metal', 'Metal', 'Screws', 'feet', 'pins'],
  black: ['black', 'Black', 'rubber', 'Rubber', 'plastic', 'Plastic', 'foam', 'Foam', 'gooseneck', 'Gooseneck'],
  logo: ['logo', 'Logo', 'badge', 'Badge'],
};

// ============================================================================
// Colour Helpers
// ============================================================================

function getFrameColourHex(colourId: string): string {
  const colour = FRAME_COLOURS.find(c => c.id === colourId);
  return colour?.hex || '#1a1a1a';
}

function getPanelColourHex(colourId: string): string {
  const colour = PANEL_COLOURS.find(c => c.id === colourId);
  return colour?.hex || '#0C0C0C'; // Default to Petronas (true black)
}

// ============================================================================
// OBJ Model Component
// ============================================================================

interface LecternModelProps {
  modelId: string;
  frameColour: string;
  panelColour: string;
}

const LecternModel: React.FC<LecternModelProps> = ({ modelId, frameColour, panelColour }) => {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { invalidate } = useThree();
  
  const frameHex = getFrameColourHex(frameColour);
  const panelHex = getPanelColourHex(panelColour);
  
  // Get material mapping for this model
  const mapping = MATERIAL_MAPPINGS[modelId] || DEFAULT_MAPPING;
  
  // Create materials with current colors - recreated when colors change
  const materials = React.useMemo(() => ({
    frame: new THREE.MeshStandardMaterial({
      color: frameHex,
      metalness: 0.6,
      roughness: 0.3,
    }),
    panel: new THREE.MeshStandardMaterial({
      color: panelHex,
      metalness: 0.05,
      roughness: 0.85, // Fabric-like roughness
    }),
    silver: new THREE.MeshStandardMaterial({
      color: '#c0c0c0',
      metalness: 0.8,
      roughness: 0.2,
    }),
    black: new THREE.MeshStandardMaterial({
      color: '#1a1a1a',
      metalness: 0.1,
      roughness: 0.8,
    }),
    logo: new THREE.MeshStandardMaterial({
      color: '#ffffff',
      metalness: 0.3,
      roughness: 0.5,
    }),
  }), [frameHex, panelHex]); // Recreate when colors change
  
  // Update existing model's materials when colors change
  useEffect(() => {
    if (model) {
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const materialName = child.userData.originalMaterialName || '';
          
          if (matchesMaterial(materialName, mapping.frame)) {
            child.material = materials.frame;
          } else if (matchesMaterial(materialName, mapping.panel)) {
            child.material = materials.panel;
          }
        }
      });
      invalidate();
    }
  }, [model, materials, mapping, invalidate]);
  
  // Load the OBJ file
  useEffect(() => {
    let isCancelled = false;
    const objLoader = new OBJLoader();
    const mtlLoader = new MTLLoader();
    
    const modelPath = `/models/lectrum/${modelId}.obj`;
    const mtlPath = `/models/lectrum/${modelId}.mtl`;
    
    // First try to load with MTL
    mtlLoader.load(
      mtlPath,
      (mtl) => {
        if (isCancelled) return;
        mtl.preload();
        objLoader.setMaterials(mtl);
        
        objLoader.load(
          modelPath,
          (obj) => {
            if (isCancelled) return;
            // Apply custom materials based on mapping
            applyMaterialsShared(obj, mapping, materials);
            setModel(obj);
          },
          undefined,
          (err) => {
            if (isCancelled) return;
            console.error('Error loading OBJ:', err);
            setError('Failed to load model');
          }
        );
      },
      undefined,
      () => {
        if (isCancelled) return;
        // MTL failed, try loading OBJ without materials
        console.warn('MTL not found, loading OBJ without materials');
        objLoader.load(
          modelPath,
          (obj) => {
            if (isCancelled) return;
            applyMaterialsShared(obj, mapping, materials);
            setModel(obj);
          },
          undefined,
          (err) => {
            if (isCancelled) return;
            console.error('Error loading OBJ:', err);
            setError('Failed to load model');
          }
        );
      }
    );
    
    // Cleanup
    return () => {
      isCancelled = true;
    };
  }, [modelId]); // Only reload model when modelId changes, not materials
  
  if (error) {
    return (
      <Html center>
        <div className="text-red-400 text-center bg-black/50 p-4 rounded">
          <p>Failed to load {modelId}</p>
        </div>
      </Html>
    );
  }
  
  if (!model) {
    return null;
  }
  
  return <primitive object={model} />;
};

/**
 * Apply shared materials to the loaded OBJ based on mapping
 * Using shared materials allows color updates without recreating
 */
function applyMaterialsShared(
  obj: THREE.Group,
  mapping: MaterialMapping,
  materials: {
    frame: THREE.MeshStandardMaterial;
    panel: THREE.MeshStandardMaterial;
    silver: THREE.MeshStandardMaterial;
    black: THREE.MeshStandardMaterial;
    logo: THREE.MeshStandardMaterial;
  }
) {
  // Traverse and apply materials
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      // Get original material name (stored in userData during MTL load, or from material.name)
      const originalMaterial = Array.isArray(child.material) ? child.material[0] : child.material;
      const materialName = originalMaterial?.name || child.name || '';
      
      // Store original material name for debugging
      child.userData.originalMaterialName = materialName;
      
      // Check each mapping category
      if (matchesMaterial(materialName, mapping.frame)) {
        child.material = materials.frame;
      } else if (matchesMaterial(materialName, mapping.panel)) {
        child.material = materials.panel;
      } else if (matchesMaterial(materialName, mapping.silver)) {
        child.material = materials.silver;
      } else if (matchesMaterial(materialName, mapping.black)) {
        child.material = materials.black;
      } else if (matchesMaterial(materialName, mapping.logo)) {
        child.material = materials.logo;
      }
      
      // Enable shadows
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

/**
 * Normalize a material name for comparison (remove underscores, lowercase)
 */
function normalizeMaterialName(name: string): string {
  return name.toLowerCase().replace(/_/g, '').replace(/-/g, '').replace(/\s+/g, '');
}

/**
 * Check if a material name matches any in the list
 * Uses exact match first, then normalized match, then partial match
 */
function matchesMaterial(name: string, patterns: string[]): boolean {
  if (!name) return false;
  
  const lowerName = name.toLowerCase();
  const normalizedName = normalizeMaterialName(name);
  
  return patterns.some(pattern => {
    const lowerPattern = pattern.toLowerCase();
    const normalizedPattern = normalizeMaterialName(pattern);
    
    // Exact match (case-insensitive)
    if (lowerName === lowerPattern) return true;
    
    // Normalized exact match (ignoring underscores, dashes, spaces)
    if (normalizedName === normalizedPattern) return true;
    
    // Partial match - pattern is contained in name
    if (lowerName.includes(lowerPattern)) return true;
    
    // Partial match - name is contained in pattern (for longer patterns)
    if (lowerPattern.includes(lowerName) && lowerName.length > 3) return true;
    
    // Normalized partial match
    if (normalizedName.includes(normalizedPattern)) return true;
    
    return false;
  });
}

// ============================================================================
// Scene Components
// ============================================================================

interface LecternSceneProps {
  config: ConfigurationState;
  product: ProductDefinition;
}

const LecternScene: React.FC<LecternSceneProps> = ({ config, product }) => {
  // Get model ID from product ID (e.g., 'lectrum-l2001' -> 'L2001')
  const modelId = product.id.replace('lectrum-', '').toUpperCase();
  
  // Get selected colours (defaults match lectrumCatalog.ts)
  const frameColour = config.selections['frame-colour'] || 'black';
  const panelColour = config.selections['panel-colour'] || 'petronas';
  
  // Scale: models are in cm, height is ~70cm, we want ~1.5 units tall
  // Scale of 0.02 gives: 70 * 0.02 = 1.4 units tall
  const modelScale = 0.02;
  
  return (
    <group position={[0, 0, 0]}>
      <group scale={modelScale} rotation={[0, Math.PI, 0]}>
        <Suspense fallback={<LoadingFallback />}>
          <LecternModel
            modelId={modelId}
            frameColour={frameColour}
            panelColour={panelColour}
          />
        </Suspense>
      </group>
    </group>
  );
};

// ============================================================================
// Loading Fallback
// ============================================================================

const LoadingFallback: React.FC = () => (
  <Html center>
    <div className="text-white text-center">
      <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-2" />
      <p className="text-sm text-zinc-400">Loading lectern model...</p>
    </div>
  </Html>
);

// ============================================================================
// Main Component
// ============================================================================

const LectrumViewer3D = forwardRef<LectrumViewer3DRef, LectrumViewer3DProps>(
  ({ config, product }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const controlsRef = useRef<any>(null);
    const [bgMode, setBgMode] = useState<BgMode>('dark');
    
    // Expose thumbnail capture method
    useImperativeHandle(ref, () => ({
      captureThumbnail: () => {
        if (canvasRef.current) {
          return canvasRef.current.toDataURL('image/png');
        }
        return null;
      },
    }));
    
    // Get model info for display
    const modelId = product.id.replace('lectrum-', '').toUpperCase();
    const modelInfo = getLectrumModelInfo(modelId);
    
    return (
      <div className="w-full h-full bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 shadow-inner relative group">
        <Canvas
          ref={canvasRef}
          camera={{ position: [3, 2, 3], fov: 40 }}
          shadows
          gl={{ preserveDrawingBuffer: true, antialias: true }}
        >
          {/* Background */}
          {bgMode === 'photo' ? (
            <Environment preset="warehouse" background blur={0.6} />
          ) : (
            <Environment preset="city" />
          )}
          {bgMode === 'dark' && <color attach="background" args={['#18181b']} />}
          {bgMode === 'light' && <color attach="background" args={['#e4e4e7']} />}
          
          {/* Lighting */}
          <ambientLight intensity={bgMode === 'photo' ? 1.0 : 0.8} />
          <directionalLight
            position={[5, 8, 5]}
            intensity={bgMode === 'photo' ? 2.0 : 1.5}
            castShadow
            shadow-bias={-0.0001}
          />
          <directionalLight position={[-3, 5, -3]} intensity={0.4} />
          <directionalLight position={[0, 3, 5]} intensity={0.3} />
          
          {/* Scene */}
          <Suspense fallback={<LoadingFallback />}>
            <LecternScene config={config} product={product} />
          </Suspense>
          
          {/* Ground Shadow */}
          <ContactShadows
            position={[0, -0.02, 0]}
            opacity={0.4}
            scale={4}
            blur={2}
            far={4}
          />
          
          {/* Controls */}
          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            minDistance={2}
            maxDistance={8}
            minPolarAngle={Math.PI * 0.15}
            maxPolarAngle={Math.PI * 0.48}
            target={[0, 0.6, 0]}
          />
        </Canvas>
        
        {/* Live Preview Badge */}
        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded border border-zinc-700 text-xs text-zinc-300 font-mono pointer-events-none select-none z-10">
          <span className="text-emerald-500 font-bold">LIVE PREVIEW</span>
          <span className="mx-2">|</span>
          {modelInfo?.name || modelId}
        </div>
        
        {/* Background Mode Toggle */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex bg-black/50 backdrop-blur-md rounded border border-zinc-700 p-1 gap-1 z-10 shadow-lg">
          <button 
            onClick={() => setBgMode('dark')} 
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${bgMode === 'dark' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Dark
          </button>
          <button 
            onClick={() => setBgMode('light')} 
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${bgMode === 'light' ? 'bg-zinc-200 text-black' : 'text-zinc-400 hover:text-white'}`}
          >
            Light
          </button>
          <button 
            onClick={() => setBgMode('photo')} 
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${bgMode === 'photo' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Photo
          </button>
          <div className="w-px bg-zinc-600 mx-1"></div>
          <button 
            onClick={() => controlsRef.current?.reset()} 
            className="px-3 py-1 text-xs font-medium rounded transition-colors text-zinc-300 hover:text-white hover:bg-zinc-700" 
            title="Reset Camera View"
          >
            Recenter
          </button>
        </div>
        
        {/* Model Info Badge (bottom) */}
        <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-zinc-400">
          <span className="text-emerald-400">●</span> {product.name}
        </div>
      </div>
    );
  }
);

LectrumViewer3D.displayName = 'LectrumViewer3D';

export default LectrumViewer3D;
