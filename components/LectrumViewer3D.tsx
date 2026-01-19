import React, { useRef, Suspense, forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Html } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { ConfigurationState, ProductDefinition, LogoTransform } from '../types';
import { FRAME_COLOURS, PANEL_COLOURS } from '../services/products/lectrumConstants';
import { getLectrumModelInfo } from '../services/products/lectrumCatalog';
import SceneControlsOverlay from './SceneControlsOverlay';

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
  frame: string[];   // Materials that get Frame Colour
  panel: string[];   // Materials that get Panel Colour  
  silver: string[];  // Materials that stay silver/metallic
  black: string[];   // Materials that stay black (including top felt)
  logo: string[];    // Logo panel - WHITE with logo when accessory selected, otherwise panel colour
}

// Comprehensive material mappings based on actual MTL file contents
// FRAME = metal frame legs only (painted metal finish - switchable)
// PANEL = front dress panel only (Autex fabric colour - switchable)
// BLACK = top panel, top felt, top piece (ALWAYS black)
// LOGO = logo display panel - white with logo when accessory selected, otherwise matches panel colour
const MATERIAL_MAPPINGS: Record<string, MaterialMapping> = {
  'L2001': {
    frame: ['frame', 'toppanel', 'topplate'],  // Metal frame - legs AND frame strips around logo panel
    panel: ['Front_panel'],  // Front dress panel only (fabric)
    silver: ['siberfoort', 'Pins', 'Screws'],
    black: ['Blackpalstic', 'blackrubber', 'goosneck', 'wheel', 'Foam', 'Toppanelfelt'],  // Black plastic, rubber, felt - ALWAYS black
    logo: ['logodisplay'],  // Logo panel - WHITE+logo when accessory selected, otherwise panel colour
  },
  'L2001C': {
    frame: ['Frame'],  // Metal frame legs only
    panel: ['Front_panel'],  // Front dress panel only
    silver: ['Silverpins', 'Silver_Screws', 'feet', 'XLR'],
    black: ['Foam', 'Gooseneck', 'Wheel_', 'blackpasic', '_lightneck', 'feet_rubber', 'frame_buttons', 'clcokface', 'clockbuttons', 'Top_panel', 'topplate', 'lecterntop', 'Toppanelfelt'],
    logo: ['logo_panel', 'Boarder_Print'],
  },
  'L2001-CTL': {
    frame: ['Frame'],  // Metal frame legs only
    panel: ['Front_panel', 'frontpanel', 'Frontpanel', 'FreontPAnel'],  // Front dress panel (note: FreontPAnel is a typo in the model)
    silver: ['silver', 'screw', 'xlr', 'steelwheel'],
    black: ['gooseneck', 'Blackrubber', 'blackrubberfoot', 'controlpanel', 'controlpanel2', '0,0,0_24', 'Top_Panel', 'green'],
    logo: ['logopanel', 'Whitereitomh'],
  },
  'L20': {
    frame: ['Frame'],  // Metal frame legs only
    panel: ['frontttpanel'],  // Front dress panel only
    silver: ['Sttelfeet', 'Screw'],
    black: ['black_rubber', 'Top_panel', 'toppanel', 'topplate', 'Toppanelfelt'],
    logo: ['Lectrumbabadge', 'lectrumlogotext'],
  },
  'L20S': {
    frame: ['Frame'],  // Metal frame legs only
    panel: ['Frontbackpanel'],  // Front/back dress panel
    silver: ['Siver', 'Sivermetal', 'feetsilevr', 'Screws'],
    black: ['BlackPastic', 'Gooseneck', 'blackfoam', 'feetrubber', 'toppanel', 'topplate', 'Toppanelfelt'],
    logo: ['logoplate'],
  },
  'L20S-NCTL': {
    frame: ['Frame'],  // Metal frame legs only
    panel: ['Frontbackpanel'],  // Front/back dress panel
    silver: ['Siver', 'Sivermetal', 'feetsilevr', 'Screws'],
    black: ['BlackPastic', 'Gooseneck', 'blackfoam', 'feetrubber', 'toppanel', 'topplate', 'Toppanelfelt'],
    logo: ['logoplate'],
  },
  'L900': {
    frame: ['Black_Frame'],  // Metal frame
    panel: ['Customisable_Panel'],  // Front dress panel only
    silver: ['Mikepins', 'Screws', 'feet'],
    black: ['black_rubber_', 'Mic_Gooseneck', 'toppanel', 'topplate', 'Felt_top'],
    logo: ['Logo'],
  },
  'L101': {
    frame: ['Frame'],  // Metal frame legs only
    panel: ['Front_Panel', 'frontpanel'],  // Front dress panel only
    silver: ['Screws', 'SiverfeetScrewa', 'Sileverpins', 'XLRtabs', 'Controlpanel'],
    black: ['BlackPlastic', 'Goosnect_gloss', 'rubberfeet', 'Badge1', 'Diplaypanel3', 'diplaypanel2', 'clockOuter', 'Glass_plate', 'Toppanel', 'toppanel', 'topplate', 'Toppanelfelt'],
    logo: ['Whitetopetext', 'white_boarder', 'XLRplate'],
  },
};

// Default mapping for unknown models
const DEFAULT_MAPPING: MaterialMapping = {
  frame: ['frame', 'Frame'],  // Metal frame legs only
  panel: ['Front_panel', 'frontpanel', 'Frontpanel', 'panel', 'Panel', 'Customisable'],  // Front dress panel only
  silver: ['silver', 'Silver', 'Siver', 'metal', 'Metal', 'Screws', 'feet', 'pins'],
  black: ['black', 'Black', 'rubber', 'Rubber', 'plastic', 'Plastic', 'foam', 'Foam', 'gooseneck', 'Gooseneck', 'wheel', 'toppanel', 'topplate', 'Top_panel', 'Toppanelfelt', 'felt', 'Felt', 'Felt_top'],  // Top + felt ALWAYS black
  logo: ['logo', 'Logo', 'badge', 'Badge', 'logodisplay'],  // Logo panel - white+logo when accessory selected
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
  logoImageUrl?: string; // Custom logo image URL
  hasLogoAccessory: boolean; // Whether a logo accessory is selected
  hasLogoAccessorySelected: boolean; // Whether a logo accessory is explicitly selected
  hasMicrophoneAccessory: boolean; // Whether a microphone accessory is selected (shows left/right goosenecks)
  hasCrystaliteLogo: boolean; // Whether the Crystalite logo accessory is selected
  hasClassicLogoPanel400: boolean; // Whether Logo Panel 400x300 (Classic) is selected
  hasClassicLogoPanelFull: boolean; // Whether Full Dress Panel Logo (Classic) is selected
  logoTransform?: LogoTransform; // Logo scale and position controls
}

// Info about where the logo panel is located on the model
interface LogoPanelInfo {
  position: THREE.Vector3;  // World position of panel center
  rotation: THREE.Euler;    // World rotation of panel
  width: number;
  height: number;
}

const LecternModel: React.FC<LecternModelProps> = ({ modelId, frameColour, panelColour, logoImageUrl, hasLogoAccessory, hasLogoAccessorySelected, hasMicrophoneAccessory, hasCrystaliteLogo, hasClassicLogoPanel400, hasClassicLogoPanelFull, logoTransform }) => {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoTexture, setLogoTexture] = useState<THREE.Texture | null>(null);
  const [logoPanelInfo, setLogoPanelInfo] = useState<LogoPanelInfo | null>(null); // Position of logo panel for procedural logo
  const logoPlaneRef = useRef<THREE.Mesh | null>(null);
  const { invalidate } = useThree();
  
  // Default logo transform values
  const transform = logoTransform || { scale: 0.3, offsetX: 0, offsetY: 0, offsetZ: 0, tilt: 0 };
  
  // Load logo texture when URL changes
  useEffect(() => {
    if (logoImageUrl && hasLogoAccessory) {
      console.log('=== LOADING LOGO TEXTURE ===');
      console.log('URL type:', logoImageUrl.startsWith('data:') ? 'data URL' : 'regular URL');
      
      const loader = new THREE.TextureLoader();
      loader.load(
        logoImageUrl,
        (texture) => {
          console.log('✅ Logo texture loaded!', texture.image?.width, 'x', texture.image?.height);
          texture.colorSpace = THREE.SRGBColorSpace;
          // Reset everything to defaults
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.repeat.set(1, 1);
          texture.offset.set(0, 0);
          texture.center.set(0, 0);
          texture.flipY = true;
          texture.needsUpdate = true;
          setLogoTexture(texture);
        },
        (progress) => {
          console.log('Loading logo texture...', progress);
        },
        (err) => {
          console.error('❌ Failed to load logo texture:', err);
          setLogoTexture(null);
        }
      );
    } else {
      console.log('No logo to load - hasLogoAccessory:', hasLogoAccessory, 'logoImageUrl:', logoImageUrl ? 'present' : 'none');
      setLogoTexture(null);
    }
  }, [logoImageUrl, hasLogoAccessory]);
  
  const frameHex = getFrameColourHex(frameColour);
  const panelHex = getPanelColourHex(panelColour);
  
  // Get material mapping for this model
  const mapping = MATERIAL_MAPPINGS[modelId] || DEFAULT_MAPPING;
  
  // Use refs to store current values so async loader can access latest values
  const frameHexRef = useRef(frameHex);
  const panelHexRef = useRef(panelHex);
  const logoTextureRef = useRef(logoTexture);
  const hasLogoAccessoryRef = useRef(hasLogoAccessory);
  const hasMicrophoneAccessoryRef = useRef(hasMicrophoneAccessory);
  const logoTransformRef = useRef(transform);
  
  // Keep refs updated
  useEffect(() => {
    frameHexRef.current = frameHex;
    panelHexRef.current = panelHex;
  }, [frameHex, panelHex]);
  
  useEffect(() => {
    logoTextureRef.current = logoTexture;
    hasLogoAccessoryRef.current = hasLogoAccessory;
    hasMicrophoneAccessoryRef.current = hasMicrophoneAccessory;
    logoTransformRef.current = transform;
  }, [logoTexture, hasLogoAccessory, hasMicrophoneAccessory, transform]);
  
  // Static materials for non-color parts (created once)
  const staticMaterials = React.useMemo(() => ({
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
  }), []);
  
  // Logo panel background material - WHITE when logo accessory selected, otherwise matches panel colour
  const logoPanelMaterial = React.useMemo(() => {
    if (hasLogoAccessory) {
      return new THREE.MeshBasicMaterial({
        color: '#ffffff',
        side: THREE.DoubleSide,
      });
    }
    return new THREE.MeshStandardMaterial({
      color: panelHex,
      metalness: 0.1,
      roughness: 0.6,
    });
  }, [panelHex, hasLogoAccessory]);
  
  // Dynamic materials for frame and panel - recreated when colors change
  const frameMaterial = React.useMemo(() => new THREE.MeshStandardMaterial({
    color: frameHex,
    metalness: 0.6,
    roughness: 0.3,
  }), [frameHex]);
  
  const panelMaterial = React.useMemo(() => new THREE.MeshStandardMaterial({
    color: panelHex,
    metalness: 0.05,
    roughness: 0.85,
  }), [panelHex]);
  
  // Update existing model's materials when colors or logo state changes
  // Also find logo panel bounds for procedural logo placement
  useEffect(() => {
    if (model) {
      console.log('=== UPDATING MATERIALS ===');
      console.log('hasLogoAccessory:', hasLogoAccessory);
      console.log('Looking for logo materials:', mapping.logo);
      
      let foundLogoPanelInfo: LogoPanelInfo | null = null;
      
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Handle multi-material meshes
          if (Array.isArray(child.material) && child.userData.originalMaterialNames) {
            const originalNames = child.userData.originalMaterialNames as string[];
            let hasLogoMaterial = false;
            
            child.material = child.material.map((mat, index) => {
              const matName = originalNames[index] || '';
              // Order: logo -> frame -> panel -> silver -> black
              if (matchesMaterial(matName, mapping.logo)) {
                console.log('  Logo panel material found (multi-mat):', matName);
                hasLogoMaterial = true;
                return logoPanelMaterial.clone();
              }
              if (matchesMaterial(matName, mapping.frame)) {
                return frameMaterial;
              }
              if (matchesMaterial(matName, mapping.panel)) {
                return panelMaterial;
              }
              if (matchesMaterial(matName, mapping.silver)) {
                return staticMaterials.silver;
              }
              // Special handling for gooseneck and foam (mic heads) - make transparent if no mic accessory
              if (matName === 'Gooseneck' || matName === 'gooseneck' || matName === 'Foam' || matName === 'foam' || matName === 'blackfoam' || matName === 'Blackfoam') {
                const micMat = staticMaterials.black.clone();
                micMat.transparent = true;
                micMat.opacity = hasMicrophoneAccessory ? 1 : 0;
                console.log('  Microphone material', matName, '-> opacity:', hasMicrophoneAccessory ? 1 : 0);
                return micMat;
              }
              if (matchesMaterial(matName, mapping.black)) {
                return staticMaterials.black;
              }
              return mat;
            });
            
            // If this mesh has logo material, get its bounds for logo placement
            if (hasLogoMaterial && !foundLogoPanelInfo) {
              child.geometry.computeBoundingBox();
              const bbox = child.geometry.boundingBox;
              if (bbox) {
                const width = bbox.max.x - bbox.min.x;
                const height = bbox.max.y - bbox.min.y;
                
                child.updateMatrixWorld(true);
                const worldQuat = new THREE.Quaternion();
                const worldScale = new THREE.Vector3();
                const worldPos = new THREE.Vector3();
                child.matrixWorld.decompose(worldPos, worldQuat, worldScale);
                
                const localCenter = new THREE.Vector3(
                  (bbox.min.x + bbox.max.x) / 2,
                  (bbox.min.y + bbox.max.y) / 2,
                  bbox.max.z + 0.5
                );
                localCenter.applyMatrix4(child.matrixWorld);
                
                const rotation = new THREE.Euler().setFromQuaternion(worldQuat);
                foundLogoPanelInfo = { position: localCenter, rotation, width, height };
                console.log('  Logo panel from multi-mat mesh:', width.toFixed(1), 'x', height.toFixed(1));
              }
            }
          } else {
            // Single material mesh
            const materialName = child.userData.originalMaterialName || '';
            if (matchesMaterial(materialName, mapping.logo)) {
              console.log('  Logo panel mesh found:', child.name, 'material:', materialName);
              
              // Get logo panel bounds and world transform
              child.geometry.computeBoundingBox();
              const bbox = child.geometry.boundingBox;
              if (bbox) {
                const width = bbox.max.x - bbox.min.x;
                const height = bbox.max.y - bbox.min.y;
                
                child.updateMatrixWorld(true);
                const worldQuat = new THREE.Quaternion();
                const worldScale = new THREE.Vector3();
                const worldPos = new THREE.Vector3();
                child.matrixWorld.decompose(worldPos, worldQuat, worldScale);
                
                const localCenter = new THREE.Vector3(
                  (bbox.min.x + bbox.max.x) / 2,
                  (bbox.min.y + bbox.max.y) / 2,
                  bbox.max.z + 0.5
                );
                localCenter.applyMatrix4(child.matrixWorld);
                
                const rotation = new THREE.Euler().setFromQuaternion(worldQuat);
                
                foundLogoPanelInfo = {
                  position: localCenter,
                  rotation,
                  width,
                  height,
                };
                
                console.log('  Logo panel:', width.toFixed(1), 'x', height.toFixed(1),
                            'pos:', localCenter.x.toFixed(1), localCenter.y.toFixed(1), localCenter.z.toFixed(1));
              }
              
              // Apply white/panel material to the logo panel background
              child.material = logoPanelMaterial.clone();
            } else if (matchesMaterial(materialName, mapping.frame)) {
              child.material = frameMaterial;
            } else if (matchesMaterial(materialName, mapping.panel)) {
              child.material = panelMaterial;
            } else if (matchesMaterial(materialName, mapping.silver)) {
              child.material = staticMaterials.silver;
            } else if (materialName === 'Gooseneck' || materialName === 'gooseneck' || materialName === 'Foam' || materialName === 'foam' || materialName === 'blackfoam' || materialName === 'Blackfoam') {
              // Special handling for gooseneck and foam (mic heads) - make transparent if no mic accessory
              const micMat = staticMaterials.black.clone();
              micMat.transparent = true;
              micMat.opacity = hasMicrophoneAccessory ? 1 : 0;
              child.material = micMat;
              console.log('  Microphone material', materialName, '-> opacity:', hasMicrophoneAccessory ? 1 : 0);
            } else if (matchesMaterial(materialName, mapping.black)) {
              child.material = staticMaterials.black;
            }
          }
        }
      });
      
      // Store logo panel info for procedural logo rendering
      if (foundLogoPanelInfo) {
        setLogoPanelInfo(foundLogoPanelInfo);
      }
      
      invalidate();
    }
  }, [model, frameMaterial, panelMaterial, logoPanelMaterial, staticMaterials, mapping, invalidate, hasLogoAccessory, hasMicrophoneAccessory]);
  
  // Load the OBJ file
  useEffect(() => {
    let isCancelled = false;
    const objLoader = new OBJLoader();
    const mtlLoader = new MTLLoader();
    
    const modelPath = `/models/lectrum/${modelId}.obj`;
    const mtlPath = `/models/lectrum/${modelId}.mtl`;
    
    const applyMaterials = (obj: THREE.Group) => {
      // Create fresh materials with current colors from refs
      const currentFrameMaterial = new THREE.MeshStandardMaterial({
        color: frameHexRef.current,
        metalness: 0.6,
        roughness: 0.3,
      });
      const currentPanelMaterial = new THREE.MeshStandardMaterial({
        color: panelHexRef.current,
        metalness: 0.05,
        roughness: 0.85,
      });
      
      // Logo panel background - WHITE when accessory selected, otherwise panel color
      const currentLogoPanelMaterial = hasLogoAccessoryRef.current
        ? new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide })
        : new THREE.MeshStandardMaterial({ color: panelHexRef.current, metalness: 0.1, roughness: 0.6 });
      
      console.log('=== APPLYING MATERIALS ===');
      console.log('Frame color:', frameHexRef.current);
      console.log('Panel color:', panelHexRef.current);
      console.log('Model ID:', modelId);
      
      // Helper to get replacement material for a given material name
      // Order: logo -> frame -> panel -> silver -> black
      const getReplacementMaterial = (matName: string): THREE.Material | null => {
        if (matchesMaterial(matName, mapping.logo)) {
          console.log('  Material:', matName, '-> LOGO PANEL BG');
          return currentLogoPanelMaterial;
        }
        if (matchesMaterial(matName, mapping.frame)) {
          console.log('  Material:', matName, '-> FRAME');
          return currentFrameMaterial;
        }
        if (matchesMaterial(matName, mapping.panel)) {
          console.log('  Material:', matName, '-> PANEL');
          return currentPanelMaterial;
        }
        if (matchesMaterial(matName, mapping.silver)) {
          console.log('  Material:', matName, '-> SILVER');
          return staticMaterials.silver;
        }
        if (matchesMaterial(matName, mapping.black)) {
          console.log('  Material:', matName, '-> BLACK');
          return staticMaterials.black;
        }
        console.log('  Material:', matName, '-> NO MATCH (keeping original)');
        return null;
      };
      
      let detectedLogoPanelInfo: LogoPanelInfo | null = null;
      
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          console.log('Mesh:', child.name);
          
          // Handle multi-material meshes (OBJ files with multiple usemtl statements)
          if (Array.isArray(child.material)) {
            console.log('  Multi-material mesh with', child.material.length, 'materials');
            
            // Store original material names for later updates
            const originalNames: string[] = [];
            let hasLogoMaterial = false;
            
            // Process each material in the array
            const newMaterials = child.material.map((mat, index) => {
              const matName = mat.name || `material_${index}`;
              originalNames.push(matName);
              if (matchesMaterial(matName, mapping.logo)) {
                console.log('  >>> Logo material in multi-mat mesh:', matName);
                hasLogoMaterial = true;
              }
              // Special handling for gooseneck and foam (mic heads) - make transparent if no mic accessory
              if (matName === 'Gooseneck' || matName === 'gooseneck' || matName === 'Foam' || matName === 'foam' || matName === 'blackfoam' || matName === 'Blackfoam') {
                const micMat = staticMaterials.black.clone();
                micMat.transparent = true;
                micMat.opacity = hasMicrophoneAccessoryRef.current ? 1 : 0;
                console.log('  Microphone material', matName, '-> opacity:', hasMicrophoneAccessoryRef.current ? 1 : 0);
                return micMat;
              }
              const replacement = getReplacementMaterial(matName);
              return replacement || mat;
            });
            
            child.material = newMaterials;
            child.userData.originalMaterialNames = originalNames;
            
            // If this mesh has logo material, get its bounds and transform
            if (hasLogoMaterial && !detectedLogoPanelInfo) {
              child.geometry.computeBoundingBox();
              const bbox = child.geometry.boundingBox;
              if (bbox) {
                const width = bbox.max.x - bbox.min.x;
                const height = bbox.max.y - bbox.min.y;
                
                child.updateMatrixWorld(true);
                const worldQuat = new THREE.Quaternion();
                const worldScale = new THREE.Vector3();
                const worldPos = new THREE.Vector3();
                child.matrixWorld.decompose(worldPos, worldQuat, worldScale);
                
                const localCenter = new THREE.Vector3(
                  (bbox.min.x + bbox.max.x) / 2,
                  (bbox.min.y + bbox.max.y) / 2,
                  bbox.max.z + 0.5
                );
                localCenter.applyMatrix4(child.matrixWorld);
                
                const rotation = new THREE.Euler().setFromQuaternion(worldQuat);
                detectedLogoPanelInfo = { position: localCenter, rotation, width, height };
                console.log('  Logo panel from multi-mat:', width.toFixed(1), 'x', height.toFixed(1));
              }
            }
          } else {
            // Single material mesh
            const matName = child.material?.name || child.name || '';
            console.log('  Single material:', matName);

            child.userData.originalMaterialName = matName;
            const replacement = getReplacementMaterial(matName);
            if (replacement) {
              child.material = replacement;
            }
            
            // Special handling for gooseneck and foam (mic heads) - make transparent if no mic accessory
            if (matName === 'Gooseneck' || matName === 'gooseneck' || matName === 'Foam' || matName === 'foam' || matName === 'blackfoam' || matName === 'Blackfoam') {
              const micMat = staticMaterials.black.clone();
              micMat.transparent = true;
              micMat.opacity = hasMicrophoneAccessoryRef.current ? 1 : 0;
              child.material = micMat;
              console.log('  Microphone material', matName, '-> opacity:', hasMicrophoneAccessoryRef.current ? 1 : 0);
            }
            
            // Detect logo panel for procedural logo placement
            if (matchesMaterial(matName, mapping.logo)) {
              console.log('  >>> LOGO PANEL DETECTED:', matName);
              child.geometry.computeBoundingBox();
              const bbox = child.geometry.boundingBox;
              if (bbox) {
                const width = bbox.max.x - bbox.min.x;
                const height = bbox.max.y - bbox.min.y;
                
                // Get the mesh's world position and rotation
                child.updateMatrixWorld(true);
                const worldPos = new THREE.Vector3();
                const worldQuat = new THREE.Quaternion();
                const worldScale = new THREE.Vector3();
                child.matrixWorld.decompose(worldPos, worldQuat, worldScale);
                
                // Calculate local center of the panel
                const localCenter = new THREE.Vector3(
                  (bbox.min.x + bbox.max.x) / 2,
                  (bbox.min.y + bbox.max.y) / 2,
                  bbox.max.z + 0.5 // Slightly in front
                );
                // Transform to world position
                localCenter.applyMatrix4(child.matrixWorld);
                
                // Get rotation as Euler
                const rotation = new THREE.Euler().setFromQuaternion(worldQuat);
                
                detectedLogoPanelInfo = {
                  position: localCenter,
                  rotation: rotation,
                  width,
                  height,
                };
                console.log('  Logo panel:', width.toFixed(1), 'x', height.toFixed(1),
                            'pos:', localCenter.x.toFixed(1), localCenter.y.toFixed(1), localCenter.z.toFixed(1),
                            'rot:', (rotation.x * 180/Math.PI).toFixed(1), (rotation.y * 180/Math.PI).toFixed(1), (rotation.z * 180/Math.PI).toFixed(1));
              }
            }
          }
          
          // Enable shadows
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      // Store detected logo panel info
      if (detectedLogoPanelInfo) {
        setLogoPanelInfo(detectedLogoPanelInfo);
      }
      
      console.log('=== DONE ===');
    };
    
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
            applyMaterials(obj);
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
            applyMaterials(obj);
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
  }, [modelId, mapping, staticMaterials]);
  
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
  
  // Calculate logo plane dimensions based on texture aspect ratio and transform
  const logoImg = logoTexture?.image as HTMLImageElement | undefined;
  const logoImgW = logoImg?.width || 1;
  const logoImgH = logoImg?.height || 1;
  const logoAspect = logoImgW / logoImgH;
  
  // Models with hardcoded logo positions (don't need logoPanelInfo detection)
  const hasHardcodedLogoPosition = ['L2001C', 'L2001-CTL', 'L2001'].includes(modelId);
  
  // Show logo panel group when we have a panel location AND either:
  // - a logo accessory is selected (with texture), OR
  // - the Crystalite logo accessory is selected (frosted panel base)
  const showLogoPlaneBase = (logoPanelInfo || hasHardcodedLogoPosition) && (hasLogoAccessory || hasCrystaliteLogo || hasClassicLogoPanel400 || hasClassicLogoPanelFull);
  const showLogoPlane = showLogoPlaneBase && !!logoTexture && (hasLogoAccessory || hasCrystaliteLogo || hasClassicLogoPanel400 || hasClassicLogoPanelFull);
  const showFrostedLogoPanel = showLogoPlaneBase && hasCrystaliteLogo;
  const showWhiteLogoPanel = showLogoPlaneBase && hasClassicLogoPanel400;
  
  console.log('=== SHOW LOGO CHECK ===');
  console.log('hasLogoAccessory:', hasLogoAccessory);
  console.log('logoTexture:', !!logoTexture);
  console.log('logoPanelInfo:', !!logoPanelInfo);
  console.log('hasHardcodedLogoPosition:', hasHardcodedLogoPosition);
  console.log('showLogoPlane:', showLogoPlane);
  
  // Calculate logo plane size based on panel size and user scale
  let logoPlaneWidth = 0;
  let logoPlaneHeight = 0;
  let panelPlaneWidth = 0;
  let panelPlaneHeight = 0;
  let frameThickness = 0;
  let logoPlanePosition: [number, number, number] = [0, 0, 0];
  let logoPlaneRotation: [number, number, number] = [0, 0, 0];
  
  if (showLogoPlaneBase) {
    // Base size - smaller for better fit
    const baseSize = 10;
    
    // Apply user scale (0-1 maps to 0.3x - 1.5x size)
    const userScale = 0.3 + (transform.scale * 1.2);
    const scaledSize = baseSize * userScale;
    
    const panelAspect = (hasCrystaliteLogo || hasClassicLogoPanel400) ? (4 / 3) : logoAspect;
    // Base panel dimensions (Crystalite panel is fixed 4:3)
    if (panelAspect > 1) {
      panelPlaneWidth = scaledSize;
      panelPlaneHeight = scaledSize / panelAspect;
    } else {
      panelPlaneHeight = scaledSize;
      panelPlaneWidth = scaledSize * panelAspect;
    }

    if (hasCrystaliteLogo || hasClassicLogoPanel400) {
      // Keep logo image aspect inside the 4:3 panel (no distortion)
      const maxLogoWidth = panelPlaneWidth * 0.92;
      const maxLogoHeight = panelPlaneHeight * 0.92;
      logoPlaneWidth = maxLogoWidth;
      logoPlaneHeight = maxLogoWidth / logoAspect;
      if (logoPlaneHeight > maxLogoHeight) {
        logoPlaneHeight = maxLogoHeight;
        logoPlaneWidth = maxLogoHeight * logoAspect;
      }
    } else {
      logoPlaneWidth = panelPlaneWidth;
      logoPlaneHeight = panelPlaneHeight;
    }
    
    // Model-specific logo positioning
    const getLogoPosition = (id: string): { position: [number, number, number], rotation: [number, number, number], scale: number } => {
      switch (id) {
        case 'L2001C':
          return {
            position: [11.5, 116, 0],
            rotation: [0, Math.PI / 2 - 0.026, 0],  // ~1.5 degrees adjustment
            scale: 1.2
          };
        case 'L2001-CTL':
          return {
            position: [5, 30, 5],
            rotation: [Math.PI / 4, Math.PI, 0],  // -45 degree tilt (opposite direction)
            scale: 2.0
          };
        case 'L2001':
          return {
            position: [11.5, 116, 0],
            rotation: [0, Math.PI / 2 - 0.026, 0],
            scale: 1.2
          };
        default:
          // Use detected position for other models (if available)
          if (logoPanelInfo) {
            return {
              position: [logoPanelInfo.position.x, logoPanelInfo.position.y, logoPanelInfo.position.z + 1],
              rotation: [logoPanelInfo.rotation.x, logoPanelInfo.rotation.y, logoPanelInfo.rotation.z],
              scale: 1.0
            };
          }
          // Fallback default position
          return {
            position: [0, 100, 5],
            rotation: [0, Math.PI / 2, 0],
            scale: 1.0
          };
      }
    };
    
    const logoConfig = getLogoPosition(modelId);
    logoPlanePosition = [...logoConfig.position];
    logoPlaneRotation = [...logoConfig.rotation];
    
    // Apply user offsets
    logoPlanePosition[0] += transform.offsetX * 5;
    logoPlanePosition[1] += transform.offsetY * 5;
    logoPlanePosition[2] += (transform.offsetZ || 0) * 10;  // Z offset with larger range
    
    // Apply user tilt (adds to base X rotation)
    logoPlaneRotation[0] += (transform.tilt || 0) * (Math.PI / 4);  // -45 to +45 degrees

    // Flip when logo is uploaded without accessory, or for Classic/Crystalite panels
    if ((hasLogoAccessory && !hasLogoAccessorySelected) || hasCrystaliteLogo || hasClassicLogoPanel400 || hasClassicLogoPanelFull) {
      logoPlaneRotation[1] += Math.PI;
    }
    
    // Apply model-specific scale (proportionally to both dimensions)
    logoPlaneWidth *= logoConfig.scale;
    logoPlaneHeight *= logoConfig.scale;
    panelPlaneWidth *= logoConfig.scale;
    panelPlaneHeight *= logoConfig.scale;
    frameThickness = Math.max(panelPlaneWidth, panelPlaneHeight) * 0.04;

    // L20S Classic Electronics: Crystalite panel needs to be larger
    if (modelId === 'L20S' && hasCrystaliteLogo) {
      logoPlaneWidth *= 1.5;
      logoPlaneHeight *= 1.5;
      panelPlaneWidth *= 1.5;
      panelPlaneHeight *= 1.5;
      frameThickness = Math.max(panelPlaneWidth, panelPlaneHeight) * 0.04;
    }

    console.log('=== LOGO PLANE CONFIG ===');
    console.log('Model ID:', modelId);
    console.log('Logo plane size:', logoPlaneWidth.toFixed(1), 'x', logoPlaneHeight.toFixed(1));
    console.log('Logo plane position:', logoPlanePosition[0].toFixed(1), logoPlanePosition[1].toFixed(1), logoPlanePosition[2].toFixed(1));
    console.log('Logo plane rotation:', logoPlaneRotation.map(r => r.toFixed(3)).join(', '));
    console.log('Has hardcoded position:', hasHardcodedLogoPosition);
    console.log('LogoPanelInfo detected:', !!logoPanelInfo);
  }
  
  return (
    <group>
      <primitive object={model} />
      
      {/* Procedural logo plane - positioned and rotated to match the logo panel */}
      {showLogoPlaneBase && (
        <group position={logoPlanePosition} rotation={logoPlaneRotation}>
          {/* Frosted Crystalite backing panel */}
          {showFrostedLogoPanel && (
            <mesh position={[0, 0, -0.2]}>
              <planeGeometry args={[panelPlaneWidth * 1.08, panelPlaneHeight * 1.08]} />
              <meshStandardMaterial
                color="#e1e1e1"
                transparent={true}
                opacity={0.75}
                roughness={0.9}
                metalness={0.05}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
          {/* White backing panel for Logo Panel 400x300 (Classic) */}
          {showWhiteLogoPanel && (
            <mesh position={[0, 0, -0.2]}>
              <planeGeometry args={[panelPlaneWidth * 1.08, panelPlaneHeight * 1.08]} />
              <meshStandardMaterial
                color="#ffffff"
                transparent={false}
                roughness={0.4}
                metalness={0.0}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
          {/* Frosted/white frame around 400x300 panels */}
          {(showFrostedLogoPanel || showWhiteLogoPanel) && frameThickness > 0 && (
            <group position={[0, 0, -0.15]}>
              {[
                // Top
                {
                  size: [panelPlaneWidth + frameThickness * 2, frameThickness, 1],
                  position: [0, (panelPlaneHeight / 2) + (frameThickness / 2), 0],
                },
                // Bottom
                {
                  size: [panelPlaneWidth + frameThickness * 2, frameThickness, 1],
                  position: [0, -(panelPlaneHeight / 2) - (frameThickness / 2), 0],
                },
                // Left
                {
                  size: [frameThickness, panelPlaneHeight, 1],
                  position: [-(panelPlaneWidth / 2) - (frameThickness / 2), 0, 0],
                },
                // Right
                {
                  size: [frameThickness, panelPlaneHeight, 1],
                  position: [(panelPlaneWidth / 2) + (frameThickness / 2), 0, 0],
                },
              ].map((edge, idx) => (
                <mesh key={idx} position={edge.position as [number, number, number]}>
                  <planeGeometry args={[edge.size[0], edge.size[1]]} />
                  <meshStandardMaterial
                    color={showFrostedLogoPanel ? '#d9d9d9' : '#ffffff'}
                    transparent={showFrostedLogoPanel}
                    opacity={showFrostedLogoPanel ? 0.8 : 1}
                    roughness={0.8}
                    metalness={0.05}
                    side={THREE.DoubleSide}
                  />
                </mesh>
              ))}
            </group>
          )}
          {showLogoPlane && (
            <mesh ref={logoPlaneRef}>
              <planeGeometry args={[logoPlaneWidth, logoPlaneHeight]} />
              <meshBasicMaterial
                map={logoTexture}
                transparent={true}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
        </group>
      )}
    </group>
  );
};


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
  
  // Check if a logo accessory is selected OR if there's a logo image uploaded
  // (show logo whenever user uploads one, don't require accessory selection)
  const accessories = config.selections['accessories'] as Record<string, number> | undefined;
  const logoAccessoryIds = ['logo-insert-aero-top', 'logo-panel-aero-400', 'logo-panel-aero-full',
                            'logo-panel-classic-400', 'logo-panel-classic-full', 'crystalite-logo-classic'];
  const hasLogoAccessorySelected = logoAccessoryIds.some(id => (accessories?.[id] || 0) > 0);
  const hasCrystaliteLogo = (accessories?.['crystalite-logo-classic'] || 0) > 0;
  const hasClassicLogoPanel400 = (accessories?.['logo-panel-classic-400'] || 0) > 0;
  const hasClassicLogoPanelFull = (accessories?.['logo-panel-classic-full'] || 0) > 0;
  // Show logo if accessory selected OR if logo image was uploaded
  const hasLogoAccessory = hasLogoAccessorySelected || !!config.logoImageUrl;
  
  // Check if microphone accessory is selected (shows left/right goosenecks)
  const microphoneAccessoryIds = ['gooseneck-mic-12', 'gooseneck-mic-18'];
  const hasMicrophoneAccessory = microphoneAccessoryIds.some(id => (accessories?.[id] || 0) > 0) || modelId === 'L20S';
  
  // Get logo image URL and transform from config
  const logoImageUrl = config.logoImageUrl;
  const logoTransform = config.logoTransform;
  
  // Debug logging
  console.log('=== LecternScene ===');
  console.log('modelId:', modelId);
  console.log('accessories:', accessories);
  console.log('hasLogoAccessorySelected:', hasLogoAccessorySelected);
  console.log('hasLogoAccessory (including image upload):', hasLogoAccessory);
  console.log('logoImageUrl:', logoImageUrl ? logoImageUrl.substring(0, 50) + '...' : 'none');
  console.log('logoTransform:', logoTransform);
  
  // Scale: models are in cm, height is ~116cm, we want ~2 units tall for good visibility
  // Different models may need different scales
  const getModelScale = (id: string) => {
    switch (id) {
      case 'L2001-CTL':
        return 0.022;  // CTL model is smaller, needs larger scale
      case 'L20':
        return 0.08;  // L20 Classic - larger in view
      default:
        return 0.018;  // Standard scale for most models
    }
  };
  const modelScale = getModelScale(modelId);
  
  // Model-specific Y position (to center in viewer)
  const getModelYOffset = (id: string) => {
    switch (id) {
      case 'L20':
        return -1.05;  // Center in view while keeping base aligned
      default:
        return -0.9;
    }
  };
  const modelYOffset = getModelYOffset(modelId);
  
  return (
    <group position={[0, modelYOffset, 0]}>
      {/* Rotate to face front (toward camera) */}
      <group scale={modelScale} rotation={[0, 0.0175, 0]}>
        <Suspense fallback={<LoadingFallback />}>
          <LecternModel
            modelId={modelId}
            frameColour={frameColour}
            panelColour={panelColour}
            logoImageUrl={logoImageUrl}
            hasLogoAccessory={hasLogoAccessory}
            hasLogoAccessorySelected={hasLogoAccessorySelected}
            hasMicrophoneAccessory={hasMicrophoneAccessory}
            hasCrystaliteLogo={hasCrystaliteLogo}
            hasClassicLogoPanel400={hasClassicLogoPanel400}
            hasClassicLogoPanelFull={hasClassicLogoPanelFull}
            logoTransform={logoTransform}
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
    const [bgMode, setBgMode] = useState<BgMode>('photo');
    
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
  const shadowY = modelId === 'L20' ? -1.05 : -0.92;
    
    return (
      <div className="w-full h-full bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 shadow-inner relative group">
        <Canvas
          ref={canvasRef}
          camera={{ position: [0, 0.5, 4], fov: 35 }}
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
            position={[0, shadowY, 0]}
            opacity={0.4}
            scale={4}
            blur={2}
            far={4}
          />
          
          {/* Controls */}
          <OrbitControls
            ref={controlsRef}
            enablePan={true}
            minDistance={2.5}
            maxDistance={8}
            minPolarAngle={Math.PI * 0.2}
            maxPolarAngle={Math.PI * 0.55}
            target={[0, 0.2, 0]}
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
        
        {/* Scene Controls Overlay (pan controls) */}
        <SceneControlsOverlay controlsRef={controlsRef} />
      </div>
    );
  }
);

LectrumViewer3D.displayName = 'LectrumViewer3D';

export default LectrumViewer3D;
