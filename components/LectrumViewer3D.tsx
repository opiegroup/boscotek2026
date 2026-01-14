import React, { useRef, Suspense, forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Html } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { ConfigurationState, ProductDefinition, LogoTransform } from '../types';
import { FRAME_COLOURS, PANEL_COLOURS } from '../services/products/lectrumConstants';
import { getLectrumModelInfo } from '../services/products/lectrumCatalog';

type BgMode = 'dark' | 'light' | 'photo';

// ============================================================================
// Types & Constants
// ============================================================================

const LOGO_PANEL_ASPECT = 350 / 130; // width / height
const LOGO_PADDING = 0.05; // 5% padding
const LOGO_INSET_BY_MODEL: Record<string, number> = {
  L2001: 0.35,
  L2001C: 0.35,
  'L2001-CTL': 0.35,
  L20: 0.35,
  L20S: 0.35,
  'L20S-NCTL': 0.35,
  L900: 0.35,
  L101: 0.35,
  default: 0.25,
};

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
    panel: ['Front_panel', 'frontpanel', 'Frontpanel'],  // Front dress panel only
    silver: ['Silverpins', 'Silver_Screws', 'feet', 'XLR', 'metal'],
    black: ['Foam', 'Gooseneck', 'Wheel_', 'blackpasic', '_lightneck', 'feet_rubber', 'frame_buttons', 'screen', 'Top_panel', 'topplate', 'lecterntop', 'Toppanelfelt'],
    logo: ['logo_panel', 'Boarder_Print'],
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

function getTextureDims(tex: THREE.Texture | null): { width: number; height: number } {
  const img = tex?.image as { width?: number; height?: number } | undefined;
  return {
    width: img?.width ?? 1,
    height: img?.height ?? 1,
  };
}

function computeFrontDir(mesh: THREE.Mesh): THREE.Vector3 {
  const dir = new THREE.Vector3(0, 0, 1);
  const normalAttr = mesh.geometry?.attributes?.normal as THREE.BufferAttribute | undefined;
  if (normalAttr) {
    dir.set(0, 0, 0);
    for (let i = 0; i < normalAttr.count; i++) {
      dir.x += normalAttr.getX(i);
      dir.y += normalAttr.getY(i);
      dir.z += normalAttr.getZ(i);
    }
    dir.normalize();
    if (!Number.isFinite(dir.x) || dir.lengthSq() < 1e-6) {
      dir.set(0, 0, 1);
    }
  }
  return dir;
}

function splitOutLogoGroups(
  mesh: THREE.Mesh,
  logoMaterialIndices: number[],
  logoMaterial: THREE.Material,
  insetCm: number
): THREE.Mesh | undefined {
  const geom = mesh.geometry as THREE.BufferGeometry;
  if (!geom?.groups?.length || logoMaterialIndices.length === 0) return;

  const logoGroups = geom.groups.filter(g => logoMaterialIndices.includes(g.materialIndex));
  if (!logoGroups.length) return;

  const logoGeom = geom.clone();
  logoGeom.clearGroups();
  for (const g of logoGroups) {
    logoGeom.addGroup(g.start, g.count, 0);
  }

  const remainingGroups = geom.groups.filter(g => !logoMaterialIndices.includes(g.materialIndex));
  geom.clearGroups();
  for (const g of remainingGroups) {
    geom.addGroup(g.start, g.count, g.materialIndex);
  }

  const logoMesh = new THREE.Mesh(logoGeom, logoMaterial);
  logoMesh.name = `${mesh.name || 'mesh'}_LOGO`;
  logoMesh.position.copy(mesh.position);
  logoMesh.rotation.copy(mesh.rotation);
  logoMesh.scale.copy(mesh.scale);
  logoMesh.translateZ(-insetCm);

  mesh.parent?.add(logoMesh);
  return logoMesh;
}

/**
 * Planar UVs with contain-fit (CSS background-size: contain) inside padded area.
 * Projects using averaged normal -> tangent/bitangent plane. Scale=0 hides mesh.
 */
function generateLogoUVsPlanar(
  mesh: THREE.Mesh,
  logoWidth: number,
  logoHeight: number,
  userScale: number,
  targetPanelAspect: number = LOGO_PANEL_ASPECT,
  paddingFraction: number = LOGO_PADDING,
  transform?: LogoTransform,
  flipU: boolean = true,
  flipV: boolean = false,
) {
  const geom = mesh.geometry as THREE.BufferGeometry;
  if (!geom) return;
  const pos = geom.attributes.position as THREE.BufferAttribute;
  const normal = geom.attributes.normal as THREE.BufferAttribute | undefined;
  if (!pos) return;

  const s = Math.max(0, Math.min(1, userScale ?? 1));
  if (s <= 0) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;

  const n = new THREE.Vector3(0, 0, 1);
  if (normal) {
    n.set(0, 0, 0);
    for (let i = 0; i < normal.count; i++) {
      n.x += normal.getX(i);
      n.y += normal.getY(i);
      n.z += normal.getZ(i);
    }
    if (n.lengthSq() < 1e-8) n.set(0, 0, 1);
    n.normalize();
  }

  const up = Math.abs(n.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const t = new THREE.Vector3().crossVectors(up, n).normalize();
  const b = new THREE.Vector3().crossVectors(n, t).normalize();

  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    tmp.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const u = tmp.dot(t);
    const v = tmp.dot(b);
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  const spanU = (maxU - minU) || 1;
  const spanV = (maxV - minV) || 1;

  const pad = Math.max(0, Math.min(0.49, paddingFraction));
  const safeMinX = pad, safeMaxX = 1 - pad;
  const safeMinY = pad, safeMaxY = 1 - pad;
  const safeW = safeMaxX - safeMinX;
  const safeH = safeMaxY - safeMinY;

  const panelAspect = targetPanelAspect;
  let panelW = safeW;
  let panelH = panelW / panelAspect;
  if (panelH > safeH) {
    panelH = safeH;
    panelW = panelH * panelAspect;
  }
  const panelMinX = safeMinX + (safeW - panelW) * 0.5;
  const panelMinY = safeMinY + (safeH - panelH) * 0.5;

  const logoAspect = Math.max(1, logoWidth) / Math.max(1, logoHeight);
  let rectW = panelW;
  let rectH = panelH;
  if (logoAspect > panelAspect) rectH = rectW / logoAspect;
  else rectW = rectH * logoAspect;

  rectW *= s;
  rectH *= s;
  if (rectW <= 0 || rectH <= 0) {
    mesh.visible = false;
    return;
  }

  const ox = Math.max(-1, Math.min(1, transform?.offsetX ?? 0));
  const oy = Math.max(-1, Math.min(1, transform?.offsetY ?? 0));
  const remX = Math.max(0, panelW - rectW);
  const remY = Math.max(0, panelH - rectH);
  let rectMinX = panelMinX + remX * 0.5 + remX * 0.5 * ox;
  let rectMinY = panelMinY + remY * 0.5 + remY * 0.5 * oy;
  rectMinX = Math.min(1 - rectW, Math.max(0, rectMinX));
  rectMinY = Math.min(1 - rectH, Math.max(0, rectMinY));

  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    tmp.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const pu = (tmp.dot(t) - minU) / spanU;
    const pv = (tmp.dot(b) - minV) / spanV;
    let u = rectMinX + pu * rectW;
    let v = rectMinY + pv * rectH;
    if (flipU) u = 1 - u;
    if (flipV) v = 1 - v;
    uvs[i * 2] = Math.min(1, Math.max(0, u));
    uvs[i * 2 + 1] = Math.min(1, Math.max(0, v));
  }

  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  (geom.attributes.uv as THREE.BufferAttribute).needsUpdate = true;
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
  logoTransform?: LogoTransform; // Scale/offset controls for logo panel
}

const LecternModel: React.FC<LecternModelProps> = ({ modelId, frameColour, panelColour, logoImageUrl, hasLogoAccessory, logoTransform }) => {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoTexture, setLogoTexture] = useState<THREE.Texture | null>(null);
  const { invalidate } = useThree();
  
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
  const appliedLogoTransform: LogoTransform = logoTransform || { scale: 1, offsetX: 0, offsetY: 0 };
  
  // Get material mapping for this model
  const mapping = MATERIAL_MAPPINGS[modelId] || DEFAULT_MAPPING;
  
  // Use refs to store current values so async loader can access latest values
  const frameHexRef = useRef(frameHex);
  const panelHexRef = useRef(panelHex);
  const logoTextureRef = useRef(logoTexture);
  const hasLogoAccessoryRef = useRef(hasLogoAccessory);
  
  // Keep refs updated
  useEffect(() => {
    frameHexRef.current = frameHex;
    panelHexRef.current = panelHex;
  }, [frameHex, panelHex]);
  
  useEffect(() => {
    logoTextureRef.current = logoTexture;
    hasLogoAccessoryRef.current = hasLogoAccessory;
  }, [logoTexture, hasLogoAccessory]);
  
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
  
  // Logo material - WHITE when logo accessory selected, otherwise matches panel colour
  const logoMaterial = React.useMemo(() => {
    if (hasLogoAccessory) {
      // Logo accessory selected - use WHITE background
      if (logoTexture) {
        // Has uploaded logo - apply texture with emissive to make it visible
        console.log('Creating logo material WITH texture');
        return new THREE.MeshBasicMaterial({
          map: logoTexture,
          color: '#ffffff',
          side: THREE.DoubleSide,
        });
      }
      // No logo uploaded yet - show bright white background
      console.log('Creating logo material WITHOUT texture (white)');
      return new THREE.MeshBasicMaterial({
        color: '#ffffff',
        side: THREE.DoubleSide,
      });
    }
    // No logo accessory - match panel colour
    return new THREE.MeshStandardMaterial({
      color: panelHex,
      metalness: 0.1,
      roughness: 0.6,
    });
  }, [panelHex, logoTexture, hasLogoAccessory]);
  
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
  useEffect(() => {
    if (model) {
      console.log('=== UPDATING MATERIALS ===');
      console.log('hasLogoAccessory:', hasLogoAccessory);
      console.log('logoTexture:', logoTexture ? 'loaded' : 'none');
      console.log('logoMaterial has map:', logoMaterial.map ? 'YES' : 'NO');
      console.log('logoMaterial color:', hasLogoAccessory ? 'WHITE' : 'panel colour');
      console.log('Looking for logo materials:', mapping.logo);
      
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Handle multi-material meshes
          if (Array.isArray(child.material) && child.userData.originalMaterialNames) {
            const originalNames = child.userData.originalMaterialNames as string[];
            child.material = child.material.map((mat, index) => {
              const matName = originalNames[index] || '';
              // Order: logo -> black -> frame -> panel -> silver (black before frame!)
              if (matchesMaterial(matName, mapping.logo)) {
                console.log('  Applying logo material to:', matName, hasLogoAccessory ? '(WHITE)' : '(panel)');
                // Clone the material to ensure updates are applied
                const newMaterial = logoMaterial.clone();
                newMaterial.needsUpdate = true;
                return newMaterial;
              }
              if (matchesMaterial(matName, mapping.black)) {
                return staticMaterials.black;
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
              return mat; // Keep other materials unchanged
            });
          } else {
            // Single material mesh - same order
            const materialName = child.userData.originalMaterialName || '';
            if (matchesMaterial(materialName, mapping.logo)) {
              console.log('  Applying logo material to mesh:', child.name, 'material:', materialName, hasLogoAccessory ? '(WHITE)' : '(panel)');
              
              // Always regenerate UVs for logo mesh (OBJ UVs are often bad)
              if (child.geometry) {
                console.log('  Generating planar UVs for logo mesh...');
                child.geometry.computeBoundingBox();
                const bbox = child.geometry.boundingBox;
                if (bbox) {
                  const pos = child.geometry.attributes.position;
                  const uvs = new Float32Array(pos.count * 2);
                  const sizeX = bbox.max.x - bbox.min.x || 1;
                  const sizeY = bbox.max.y - bbox.min.y || 1;
                  
                  for (let i = 0; i < pos.count; i++) {
                    // Map X,Y position to 0-1 UV range
                    uvs[i * 2] = (pos.getX(i) - bbox.min.x) / sizeX;
                    uvs[i * 2 + 1] = (pos.getY(i) - bbox.min.y) / sizeY;
                  }
                  child.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
                  child.geometry.attributes.uv.needsUpdate = true;
                  console.log('  UVs generated, bbox:', bbox.min.x.toFixed(1), bbox.min.y.toFixed(1), 'to', bbox.max.x.toFixed(1), bbox.max.y.toFixed(1));
                }
              }
              
              // Clone the material to ensure updates are applied
              const newMaterial = logoMaterial.clone();
              newMaterial.needsUpdate = true;
              child.material = newMaterial;
              child.material.needsUpdate = true;
            } else if (matchesMaterial(materialName, mapping.black)) {
              child.material = staticMaterials.black;
            } else if (matchesMaterial(materialName, mapping.frame)) {
              child.material = frameMaterial;
            } else if (matchesMaterial(materialName, mapping.panel)) {
              child.material = panelMaterial;
            } else if (matchesMaterial(materialName, mapping.silver)) {
              child.material = staticMaterials.silver;
            }
          }
        }
      });
      invalidate();
    }
  }, [model, frameMaterial, panelMaterial, logoMaterial, staticMaterials, mapping, invalidate, hasLogoAccessory, logoTexture]);
  
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
      
      console.log('=== APPLYING MATERIALS ===');
      console.log('Frame color:', frameHexRef.current);
      console.log('Panel color:', panelHexRef.current);
      console.log('Model ID:', modelId);
      
      // Logo material - WHITE when logo accessory selected, otherwise matches panel color
      let currentLogoMaterial: THREE.Material;
      if (hasLogoAccessoryRef.current) {
        // Logo accessory selected - use MeshBasicMaterial for better visibility
        if (logoTextureRef.current) {
          currentLogoMaterial = new THREE.MeshBasicMaterial({
            map: logoTextureRef.current,
            color: '#ffffff',
            side: THREE.DoubleSide,
          });
        } else {
          currentLogoMaterial = new THREE.MeshBasicMaterial({
            color: '#ffffff',
            side: THREE.DoubleSide,
          });
        }
      } else {
        // No logo accessory - match panel color
        currentLogoMaterial = new THREE.MeshStandardMaterial({
          color: panelHexRef.current,
          metalness: 0.1,
          roughness: 0.6,
        });
      }
      
      // Get logo dimensions
      const { width: logoW, height: logoH } = getTextureDims(logoTextureRef.current);
      
      const applyLogoUVs = (mesh: THREE.Mesh, scale: number, offsets: LogoTransform | undefined) => {
        generateLogoUVsPlanar(
          mesh,
          logoW,
          logoH,
          scale,
          LOGO_PANEL_ASPECT,
          LOGO_PADDING,
          offsets,
          true,
          false
        );
      };
      
      // Helper to get replacement material for a given material name
      // Order matters! More specific patterns should be checked first
      const getReplacementMaterial = (matName: string, mesh?: THREE.Mesh): THREE.Material | null => {
        // Check logo FIRST
        if (matchesMaterial(matName, mapping.logo)) {
          console.log('  Material:', matName, '-> LOGO', hasLogoAccessoryRef.current ? '(WHITE + logo)' : '(panel colour)');
          return currentLogoMaterial;
        }
        // Check black BEFORE frame (Toppanelfelt contains "toppanel" but should be black)
        if (matchesMaterial(matName, mapping.black)) {
          console.log('  Material:', matName, '-> BLACK');
          return staticMaterials.black;
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
        console.log('  Material:', matName, '-> NO MATCH (keeping original)');
        return null;
      };
      
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          console.log('Mesh:', child.name);
          
          // Handle multi-material meshes (OBJ files with multiple usemtl statements)
          if (Array.isArray(child.material)) {
            console.log('  Multi-material mesh with', child.material.length, 'materials');
            
            // Store original material names for later updates
            const originalNames: string[] = [];
            const logoMaterialIndices: number[] = [];
            
            // Process each material in the array
            const newMaterials = child.material.map((mat, index) => {
              const matName = mat.name || `material_${index}`;
              originalNames.push(matName);
              if (matchesMaterial(matName, mapping.logo)) {
                logoMaterialIndices.push(index);
                const m = currentLogoMaterial.clone();
                m.needsUpdate = true;
                m.polygonOffset = true;
                m.polygonOffsetFactor = -1;
                m.polygonOffsetUnits = -1;
                return m;
              }
              const replacement = getReplacementMaterial(matName, child);
              return replacement || mat;
            });
            
            child.material = newMaterials;
            child.userData.originalMaterialNames = originalNames;

            // Split out logo groups and apply UVs/inset to logo mesh only
            if (logoMaterialIndices.length && !child.userData.logoSplitDone) {
              child.userData.logoSplitDone = true;
              const inset = LOGO_INSET_BY_MODEL[modelId] ?? LOGO_INSET_BY_MODEL.default;
              const logoMat = currentLogoMaterial.clone();
              logoMat.needsUpdate = true;
              logoMat.polygonOffset = true;
              logoMat.polygonOffsetFactor = -1;
              logoMat.polygonOffsetUnits = -1;
              const logoMesh = splitOutLogoGroups(child, logoMaterialIndices, logoMat, inset);
              child.userData.logoMesh = logoMesh;
              if (logoMesh) {
                applyLogoUVs(logoMesh, Math.max(0, Math.min(1, appliedLogoTransform.scale ?? 1)), appliedLogoTransform);
              }
            } else if (child.userData.logoMesh) {
              applyLogoUVs(child.userData.logoMesh, Math.max(0, Math.min(1, appliedLogoTransform.scale ?? 1)), appliedLogoTransform);
            }
          } else {
            // Single material mesh
            const matName = child.material?.name || child.name || '';
            console.log('  Single material:', matName);

            child.userData.originalMaterialName = matName;
            const replacement = getReplacementMaterial(matName, child);
            if (replacement) {
              child.material = replacement;
            }

            if (matchesMaterial(matName, mapping.logo)) {
              applyLogoUVs(child, Math.max(0, Math.min(1, appliedLogoTransform.scale ?? 1)), appliedLogoTransform);
              // Inset single-material logo mesh
              const inset = LOGO_INSET_BY_MODEL[modelId] ?? LOGO_INSET_BY_MODEL.default;
              if (!child.userData.logoInsetApplied) {
                const frontDir = computeFrontDir(child);
                child.position.addScaledVector(frontDir, -inset);
                child.userData.logoInsetApplied = true;
              }
            }
          }
          
          // Enable shadows
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
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
  
  return <primitive object={model} />;
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
  
  // Check if a logo accessory is selected
  const accessories = config.selections['accessories'] as Record<string, number> | undefined;
  const logoAccessoryIds = ['logo-insert-aero-top', 'logo-panel-aero-400', 'logo-panel-aero-full', 
                            'logo-panel-classic-400', 'logo-panel-classic-full', 'crystalite-logo-classic'];
  const hasLogoAccessory = logoAccessoryIds.some(id => (accessories?.[id] || 0) > 0);
  
  // Get logo image URL from config
  const logoImageUrl = config.logoImageUrl;
  
  // Debug logging
  console.log('=== LecternScene ===');
  console.log('accessories:', accessories);
  console.log('hasLogoAccessory:', hasLogoAccessory);
  console.log('logoImageUrl:', logoImageUrl ? 'has URL' : 'none');
  
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
            logoImageUrl={logoImageUrl}
            hasLogoAccessory={hasLogoAccessory}
            logoTransform={config.logoTransform}
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
