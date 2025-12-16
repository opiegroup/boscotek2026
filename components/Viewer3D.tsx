
import React, { useState, useRef, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows, Environment, Float, Center, Text, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { ConfigurationState, ProductDefinition, DrawerConfiguration, EmbeddedCabinet } from '../types';
import { getPartitionById, CATALOG } from '../data/catalog';
import SceneControlsOverlay from './SceneControlsOverlay';

// Export interface for the ref
export interface Viewer3DRef {
  captureThumbnail: () => string | null;
}

// Get HD Cabinet product for embedded cabinet drawer lookups
const HD_CABINET_PRODUCT = CATALOG.find(p => p.id === 'prod-hd-cabinet');

// Fix for missing React Three Fiber types in JSX
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      boxGeometry: any;
      meshStandardMaterial: any;
      lineSegments: any;
      edgesGeometry: any;
      lineBasicMaterial: any;
      cylinderGeometry: any;
      planeGeometry: any;
      circleGeometry: any;
      meshBasicMaterial: any;
      ambientLight: any;
      directionalLight: any;
      color: any;
      [elemName: string]: any;
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      boxGeometry: any;
      meshStandardMaterial: any;
      lineSegments: any;
      edgesGeometry: any;
      lineBasicMaterial: any;
      cylinderGeometry: any;
      planeGeometry: any;
      circleGeometry: any;
      meshBasicMaterial: any;
      ambientLight: any;
      directionalLight: any;
      color: any;
      [elemName: string]: any;
    }
  }
}

// --- TYPES & INTERFACES ---

interface Viewer3DProps {
  config: ConfigurationState;
  product: ProductDefinition;
  activeDrawerIndex: number | null;
}

type BackgroundMode = 'dark' | 'light' | 'photo';

// --- HELPER: MATERIAL MAP ---
const getMaterialColor = (id: string, type: 'frame' | 'facia' | 'worktop', product?: ProductDefinition, groupId?: string): string => {
  if (type === 'worktop') {
    if (id === 'top-oak' || id === 'iw-top-hardwood') return '#d97706'; 
    if (id === 'top-ss' || id === 'iw-top-ss') return '#e4e4e7'; 
    if (id === 'top-mild2' || id === 'iw-top-mild') return '#27272a'; 
    if (id === 'top-mild3') return '#3f3f46'; 
    if (id === 'top-galv') return '#9da6b0'; 
    if (id === 'iw-top-formica') return '#f3f4f6'; 
    if (id === 'iw-top-masonite') return '#7c5e42'; 
    if (id === 'iw-top-duraloid') return '#525252'; 
    return '#a1a1aa'; 
  }
  
  if ((type === 'frame' || type === 'facia') && product && groupId) {
     const group = product.groups.find(g => g.id === groupId);
     const option = group?.options.find(o => o.id === id);
     if (option && typeof option.value === 'string' && option.value.startsWith('#')) {
        return option.value;
     }
  }

  // Fallbacks
  if (type === 'frame' || type === 'facia') {
    if (id === 'col-mg') return '#373737';
    if (id === 'col-sg') return '#E6E8E6';
    if (id === 'col-blue-wedge') return '#5f7895';
    if (id === 'col-charcoal') return '#363636';
    if (id === 'col-black') return '#1a1a1a';
    if (id === 'col-grey') return '#9ca3af';
    if (id === 'col-white') return '#f3f4f6';
    if (id === 'col-red') return '#b91c1c';
    return '#999';
  }
  return '#999';
};

// ==========================================
// 1. REUSABLE TEXTURES & MATERIALS
// ==========================================

const PegboardTexture = (color: string) => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color; 
    ctx.fillRect(0, 0, 128, 128);
    
    // Draw Holes
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; 
    const spacing = 16;
    const radius = 2.5;
    
    for(let x = 8; x < 128; x += spacing) {
      for(let y = 8; y < 128; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
};

// ==========================================
// 2. REUSABLE HD CABINET RENDERER
// ==========================================

const HollowBin = ({ width, height, depth, color }: { width: number, height: number, depth: number, color: string }) => {
   const wallThick = 0.003;
   const floorThick = 0.003;
   const w = width - 0.004; 
   const d = depth - 0.004;
   const h = height - 0.005; 
   
   return (
      <group position={[0, -height/2 + h/2, 0]}>
         <mesh position={[0, -h/2 + floorThick/2, 0]}><boxGeometry args={[w, floorThick, d]} /><meshStandardMaterial color={color} roughness={0.5} /></mesh>
         <mesh position={[0, 0, d/2 - wallThick/2]}><boxGeometry args={[w, h, wallThick]} /><meshStandardMaterial color={color} roughness={0.5} /></mesh>
         <mesh position={[0, 0, -d/2 + wallThick/2]}><boxGeometry args={[w, h, wallThick]} /><meshStandardMaterial color={color} roughness={0.5} /></mesh>
         <mesh position={[-w/2 + wallThick/2, 0, 0]}><boxGeometry args={[wallThick, h, d - wallThick*2]} /><meshStandardMaterial color={color} roughness={0.5} /></mesh>
         <mesh position={[w/2 - wallThick/2, 0, 0]}><boxGeometry args={[wallThick, h, d - wallThick*2]} /><meshStandardMaterial color={color} roughness={0.5} /></mesh>
      </group>
   );
};

const PartitionGrid = ({ width, depth, height, rows, cols, showBins = false }: { width: number, depth: number, height: number, rows: number, cols: number, showBins?: boolean }) => {
   const cellW = width / cols;
   const cellD = depth / rows;
   const wallThick = 0.002;
   const creamColor = '#E8E8D8'; 
   const binColor = '#2563eb'; 
   const h = height - 0.01;

   return (
      <group position={[0, -height/2 + h/2, 0]}>
         <mesh position={[0, 0, depth/2]}><boxGeometry args={[width, h, wallThick]} /><meshStandardMaterial color={creamColor} metalness={0.2} /></mesh>
         <mesh position={[0, 0, -depth/2]}><boxGeometry args={[width, h, wallThick]} /><meshStandardMaterial color={creamColor} metalness={0.2} /></mesh>
         <mesh position={[width/2, 0, 0]}><boxGeometry args={[wallThick, h, depth]} /><meshStandardMaterial color={creamColor} metalness={0.2} /></mesh>
         <mesh position={[-width/2, 0, 0]}><boxGeometry args={[wallThick, h, depth]} /><meshStandardMaterial color={creamColor} metalness={0.2} /></mesh>
         {Array.from({ length: rows - 1 }).map((_, i) => (
             <mesh key={`r-${i}`} position={[0, 0, -depth/2 + (i+1)*cellD]}><boxGeometry args={[width, h, wallThick]} /><meshStandardMaterial color={creamColor} metalness={0.2} /></mesh>
         ))}
         {Array.from({ length: cols - 1 }).map((_, i) => (
             <mesh key={`c-${i}`} position={[-width/2 + (i+1)*cellW, 0, 0]}><boxGeometry args={[wallThick, h, depth]} /><meshStandardMaterial color={creamColor} metalness={0.2} /></mesh>
         ))}
         {showBins && Array.from({ length: rows }).map((_, r) => 
            Array.from({ length: cols }).map((_, c) => {
               const isBinSlot = (r + c) % 2 === 1; 
               if (!isBinSlot) return null;
               return (
                  <group key={`b-${r}-${c}`} position={[(c - cols/2 + 0.5) * cellW, 0, (r - rows/2 + 0.5) * cellD]}>
                     <HollowBin width={cellW} depth={cellD} height={h * 0.9} color={binColor} />
                  </group>
               );
            })
         )}
      </group>
   );
};

const DrawerInterior = ({ interiorId, width, depth, height }: { interiorId?: string, width: number, depth: number, height: number }) => {
   if (!interiorId) return null;
   const interior = getPartitionById(interiorId);
   if (!interior) return null;
   const type = interior.type;
   let rows = 3;
   let cols = 3;
   if (interior.cell_width_mm && interior.cell_depth_mm) {
      const usableWidthMm = (width * 1000) + 10; 
      const usableDepthMm = (depth * 1000) + 10;
      cols = Math.floor(usableWidthMm / interior.cell_width_mm);
      rows = Math.floor(usableDepthMm / interior.cell_depth_mm);
   } else {
      if (interior.layout_description.includes('75mm x 75mm')) { cols = Math.round(width / 0.075); rows = Math.round(depth / 0.075); } 
      else if (interior.layout_description.includes('150mm')) { cols = Math.round(width / 0.15); rows = Math.round(depth / 0.15); }
   }
   if (cols < 1) cols = 1; if (rows < 1) rows = 1;
   const cellW = width / cols;
   const cellD = depth / rows;
   
   if (type === 'bin_set') {
      const binColor = '#2563eb'; 
      return (
         <group position={[0, 0, 0]}>
            {Array.from({ length: rows }).map((_, r) => 
               Array.from({ length: cols }).map((_, c) => (
                  <group key={`${r}-${c}`} position={[(c - cols/2 + 0.5) * cellW, 0, (r - rows/2 + 0.5) * cellD]}>
                     <HollowBin width={cellW} depth={cellD} height={height * 0.8} color={binColor} />
                  </group>
               ))
            )}
         </group>
      );
   }
   if (type === 'mixed_set') return <PartitionGrid width={width} depth={depth} height={height} rows={rows} cols={cols} showBins={true} />;
   return <PartitionGrid width={width} depth={depth} height={height} rows={rows} cols={cols} showBins={false} />;
};

const Drawer3D = ({ config, width, height, depth, faciaColor, isOpen, isGhost }: any) => {
   const groupRef = useRef<THREE.Group>(null);
   const gap = 0.004;
   const faciaThick = 0.02;
   const boxThick = 0.01;
   const targetZ = isOpen ? depth * 0.95 : 0; // Full extension no-tip drawer system 

   useFrame((state, delta) => {
      if (groupRef.current) {
         groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetZ, delta * 10);
      }
   });

   const faciaMat = isGhost 
      ? <meshStandardMaterial color={faciaColor} transparent={true} opacity={0.15} depthWrite={false} roughness={0.3} side={THREE.DoubleSide} />
      : <meshStandardMaterial color={faciaColor} roughness={0.4} metalness={0.1} />;
   const handleMat = isGhost
      ? <meshStandardMaterial color="#e4e4e7" transparent={true} opacity={0.15} depthWrite={false} side={THREE.DoubleSide} />
      : <meshStandardMaterial color="#e4e4e7" metalness={0.8} roughness={0.2} />;
   const boxMat = isGhost
      ? <meshStandardMaterial color="#71717a" transparent={true} opacity={0.1} depthWrite={false} side={THREE.DoubleSide} />
      : <meshStandardMaterial color="#71717a" />;

   return (
      <group ref={groupRef}>
         <mesh position={[0, 0, depth/2 - faciaThick/2]} castShadow={!isGhost}><boxGeometry args={[width - gap*2, height - gap*2, faciaThick]} />{faciaMat}</mesh>
         <mesh position={[0, height/2 - 0.015, depth/2 + 0.008]}><boxGeometry args={[width - gap*2, 0.02, 0.015]} />{handleMat}</mesh>
         <group position={[0, 0, -0.01]}> 
            <mesh position={[0, -height/2 + boxThick/2 + gap, 0]}><boxGeometry args={[width - 0.05, boxThick, depth - 0.02]} />{boxMat}</mesh>
            <mesh position={[0, 0, -depth/2 + boxThick/2]}><boxGeometry args={[width - 0.05, height - 0.02, boxThick]} />{boxMat}</mesh>
            <mesh position={[-width/2 + 0.025 + boxThick/2, 0, 0]}><boxGeometry args={[boxThick, height - 0.02, depth - 0.02]} />{boxMat}</mesh>
            <mesh position={[width/2 - 0.025 - boxThick/2, 0, 0]}><boxGeometry args={[boxThick, height - 0.02, depth - 0.02]} />{boxMat}</mesh>
         </group>
         {!isGhost && <DrawerInterior interiorId={config.interiorId} width={width - 0.06} depth={depth - 0.04} height={height - 0.02} />}
      </group>
   );
};

export const HdCabinetGroup = ({ config, width = 0.56, height = 0.85, depth = 0.75, frameColor = '#333', faciaColor = '#ccc', product, activeDrawerIndex, antiTiltDemoIndex = null }: any) => {
  // Get usable height from product configuration
  const heightGroup = product.groups.find((g: any) => g.id === 'height');
  const selectedHeightId = config.selections['height'];
  const selectedHeightOption = heightGroup?.options.find((o: any) => o.id === selectedHeightId);
  const usableHeightMeters = (selectedHeightOption?.meta?.usableHeight || 750) / 1000; // Default 750mm if not found
  
  // Calculate shell thickness dynamically based on actual vs usable height
  const totalShellThickness = height - usableHeightMeters;
  const bottomShellHeight = totalShellThickness * 0.6; // 60% to bottom
  const topShellHeight = totalShellThickness * 0.4; // 40% to top
  const apertureHeight = usableHeightMeters; // Use the catalog's usable height directly
  const isGhost = activeDrawerIndex !== null;
  
  // Unified shell material for entire cabinet body (including plinth/bottom)
  const shellMaterial = isGhost 
    ? <meshStandardMaterial color={frameColor} transparent={true} opacity={0.15} roughness={0.3} depthWrite={false} side={THREE.DoubleSide} /> 
    : <meshStandardMaterial color={frameColor} roughness={0.5} />;

  const drawerStack = useMemo(() => {
     const group = product.groups.find((grp: any) => grp.type === 'drawer_stack');
     
     if (!config.customDrawers || config.customDrawers.length === 0) {
        return [];
     }
     
     // Get drawer data with nominal heights
     const drawersWithHeights = config.customDrawers.map((d: any, originalIndex: number) => {
        const o = group?.options.find((opt: any) => opt.id === d.id);
        const heightMm = o?.meta?.front || 100;
        return { ...d, heightMm, originalIndex };
     });
     
     // Sort by height DESC (largest first) for bottom-to-top stacking
     const sortedDrawers = [...drawersWithHeights].sort((a, b) => b.heightMm - a.heightMm);
     
     // Validate: sum must not exceed usable height
     const totalHeightMm = sortedDrawers.reduce((sum, d) => sum + d.heightMm, 0);
     const usableHeightMm = apertureHeight * 1000; // Convert back to mm
     
     if (totalHeightMm > usableHeightMm) {
        console.warn(`Drawer stack (${totalHeightMm}mm) exceeds usable height (${usableHeightMm}mm)`);
     }
     
     // Build stack from bottom up using ACTUAL nominal heights (no scaling)
     const stack = [];
     let currentOffsetMm = 0; // Start at 0mm from internal bottom
     
     for (let i = 0; i < sortedDrawers.length; i++) {
        const d = sortedDrawers[i];
        const heightMeters = d.heightMm / 1000;
        
        // Calculate Y position in world space
        // Bottom of cabinet internal = bottomShellHeight
        // Position = bottom + offset + half drawer height (for center positioning)
        const yPosition = bottomShellHeight + (currentOffsetMm / 1000) + (heightMeters / 2);
        
        stack.push({
           ...d,
           height: heightMeters,
           y: yPosition,
           originalIndex: d.originalIndex
        });
        
        currentOffsetMm += d.heightMm;
     }
     
     return stack;
  }, [config.customDrawers, product, apertureHeight, bottomShellHeight]);

  const sideThickness = 0.02; // Side walls remain consistent
  const internalHeight = height - bottomShellHeight - topShellHeight;
  const internalCenterY = bottomShellHeight + internalHeight / 2;

  return (
    <group>
      <group>
         {/* Top Shell Panel (40% - thinner) */}
         <mesh position={[0, height - topShellHeight/2, 0]} castShadow={!isGhost} receiveShadow>
            <boxGeometry args={[width, topShellHeight, depth]} />
            {shellMaterial}
         </mesh>
         
         {/* Bottom Shell Panel / Plinth (60% - thicker) - FLUSH with cabinet front */}
         <mesh position={[0, bottomShellHeight/2, 0]} castShadow={!isGhost} receiveShadow>
            <boxGeometry args={[width, bottomShellHeight, depth]} />
            {shellMaterial}
         </mesh>
         
         {/* Back Panel (full internal height) */}
         <mesh position={[0, internalCenterY, -depth/2 + sideThickness/2]} receiveShadow>
            <boxGeometry args={[width, internalHeight, sideThickness]} />
            {shellMaterial}
         </mesh>
         
         {/* Left Side Panel (full internal height) */}
         <mesh position={[-width/2 + sideThickness/2, internalCenterY, 0]} receiveShadow>
            <boxGeometry args={[sideThickness, internalHeight, depth]} />
            {shellMaterial}
         </mesh>
         
         {/* Right Side Panel (full internal height) */}
         <mesh position={[width/2 - sideThickness/2, internalCenterY, 0]} receiveShadow>
            <boxGeometry args={[sideThickness, internalHeight, depth]} />
            {shellMaterial}
         </mesh>
      </group>
      
      {/* Drawer Stack - fills 100% of aperture with zero gaps */}
      <group position={[0, 0, 0]}>
         {drawerStack.map((d, i) => {
            const isActive = d.originalIndex === activeDrawerIndex;
            const isDrawerGhost = isGhost && !isActive;
            // Anti-tilt mechanism: only one drawer can be open at a time
            const isAntiTiltDemo = antiTiltDemoIndex !== null && d.originalIndex === antiTiltDemoIndex;
            const shouldOpen = isAntiTiltDemo || isActive;
            return (
               <group key={i} position={[0, d.y, 0]}>
                  <Drawer3D 
                     config={d} 
                     width={width - sideThickness*2 - 0.005} 
                     height={d.height} 
                     depth={depth - 0.05} 
                     faciaColor={faciaColor} 
                     isOpen={shouldOpen} 
                     isGhost={isDrawerGhost} 
                  />
               </group>
            );
         })}
      </group>
    </group>
  );
};

// ==========================================
// MOBILE TOOL CART STATION COMPONENT
// Accurate geometry per Boscotek spec
// 1130mm W × 900mm H (to worktop) × 825mm rear panel
// ==========================================

export const MobileToolCartGroup = ({ config, product, frameColor = '#333', faciaColor = '#ccc' }: any) => {
  // ========================================
  // CONFIGURATION EXTRACTION
  // ========================================
  
  // Bay preset defines the configuration - width is FIXED at 1130mm per Boscotek catalogue
  const bayPresetGroup = product.groups.find((g: any) => g.id === 'bay_preset');
  const selectedBayPresetId = config.selections['bay_preset'];
  const bayPreset = bayPresetGroup?.options.find((o: any) => o.id === selectedBayPresetId);
  
  // Fixed width of 1130mm as per Boscotek TCS catalogue specification
  const cabinetWidth = bayPreset?.meta?.width || 1.13;
  
  // Drawer configurations: 150/100/75/75/75mm bottom-to-top as per dimension drawing
  const leftDrawers = bayPreset?.meta?.leftDrawers || [];
  const rightDrawers = bayPreset?.meta?.rightDrawers || [150, 100, 75, 75, 75];
  const leftCupboard = bayPreset?.meta?.leftCupboard || false;
  const rightCupboard = bayPreset?.meta?.rightCupboard || false;
  
  const worktopGroup = product.groups.find((g: any) => g.id === 'worktop');
  const selectedWorktopId = config.selections['worktop'];
  const worktopOption = worktopGroup?.options.find((o: any) => o.id === selectedWorktopId);
  const worktopColor = worktopOption?.meta?.color || '#1a1a1a';
  
  const hasRearPosts = config.selections['rear_system'] === true;
  
  const getAccessoryCount = (groupId: string): number => {
    const selectedId = config.selections[groupId];
    if (!selectedId) return 0;
    const group = product.groups.find((g: any) => g.id === groupId);
    const option = group?.options?.find((o: any) => o.id === selectedId);
    const val = option?.value;
    return typeof val === 'number' ? val : 0;
  };
  
  const toolboardCount = getAccessoryCount('rear_toolboard');
  const louvreCount = getAccessoryCount('rear_louvre');
  const trayCount = getAccessoryCount('rear_trays');
  
  // ========================================
  // FIXED DIMENSIONS
  // ========================================
  const depth = 0.56;
  const castorHeight = 0.10;
  const worktopThickness = 0.035;
  const shellThickness = 0.018;
  const drawerReveal = 0.002;
  const drawerStackHeight = 0.475;
  const accessCompartmentHeight = 0.120;
  const cabinetBodyHeight = drawerStackHeight + accessCompartmentHeight + shellThickness * 2;
  const rearPanelHeight = 0.825;
  const worktopOverhangFront = 0.025;
  const worktopOverhangSide = 0.015;
  const bayWidth = (cabinetWidth - shellThickness * 3) / 2;
  
  // ========================================
  // MATERIALS
  // ========================================
  const shellMaterial = <meshStandardMaterial color={frameColor} roughness={0.35} metalness={0.15} />;
  const drawerHandleMaterial = <meshStandardMaterial color="#d4d4d4" roughness={0.3} metalness={0.5} />;
  const blackHandleMaterial = <meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.3} />;
  const castorMaterial = <meshStandardMaterial color="#71717a" roughness={0.4} metalness={0.4} />;
  const wheelMaterial = <meshStandardMaterial color="#3f3f46" roughness={0.7} metalness={0.1} />;
  
  const Castor = ({ position }: { position: [number, number, number] }) => (
    <group position={position}>
      <mesh position={[0, castorHeight - 0.01, 0]}><boxGeometry args={[0.055, 0.012, 0.055]} />{castorMaterial}</mesh>
      <mesh position={[0, castorHeight * 0.55, 0]}><boxGeometry args={[0.04, castorHeight * 0.5, 0.04]} />{castorMaterial}</mesh>
      <mesh position={[0, 0.032, 0]} rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.032, 0.032, 0.022, 16]} />{wheelMaterial}</mesh>
    </group>
  );
  
  const SideGrabHandle = ({ side }: { side: 'left' | 'right' }) => {
    const handleY = castorHeight + cabinetBodyHeight - 0.04;
    const handleLength = 0.32;
    const tubeRadius = 0.010;
    const standoff = 0.025;
    const xPos = side === 'left' ? -cabinetWidth/2 - standoff : cabinetWidth/2 + standoff;
    
    return (
      <group position={[xPos, handleY, 0]}>
        <mesh rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[tubeRadius, tubeRadius, handleLength, 12]} />{blackHandleMaterial}</mesh>
        <mesh position={[standoff/2 * (side === 'left' ? 1 : -1), 0, handleLength/2 - tubeRadius]}><boxGeometry args={[standoff, tubeRadius * 2, tubeRadius * 2]} />{blackHandleMaterial}</mesh>
        <mesh position={[standoff/2 * (side === 'left' ? 1 : -1), 0, -handleLength/2 + tubeRadius]}><boxGeometry args={[standoff, tubeRadius * 2, tubeRadius * 2]} />{blackHandleMaterial}</mesh>
        <mesh position={[standoff * (side === 'left' ? 1 : -1), 0, handleLength/2 - tubeRadius]}><boxGeometry args={[0.008, 0.035, 0.035]} />{blackHandleMaterial}</mesh>
        <mesh position={[standoff * (side === 'left' ? 1 : -1), 0, -handleLength/2 + tubeRadius]}><boxGeometry args={[0.008, 0.035, 0.035]} />{blackHandleMaterial}</mesh>
      </group>
    );
  };
  
  const CupboardBay = ({ xPos }: { xPos: number }) => {
    const doorHeight = drawerStackHeight;
    const doorWidth = bayWidth - 0.006;
    return (
      <group position={[xPos, castorHeight + shellThickness + doorHeight/2, 0]}>
        <mesh position={[0, 0, depth/2 - shellThickness/2]}><boxGeometry args={[doorWidth, doorHeight, shellThickness]} /><meshStandardMaterial color={frameColor} roughness={0.35} metalness={0.15} /></mesh>
        <mesh position={[doorWidth/2 - 0.025, 0, depth/2 + 0.008]}><boxGeometry args={[0.012, 0.10, 0.015]} />{blackHandleMaterial}</mesh>
      </group>
    );
  };
  
  const DrawerStack = ({ xPos, drawerHeights }: { xPos: number, drawerHeights: number[] }) => {
    const sortedDrawers = [...drawerHeights].sort((a, b) => b - a);
    const drawerWidth = bayWidth - 0.006;
    const handleWidth = drawerWidth - 0.01;
    let currentY = castorHeight + shellThickness;
    
    return (
      <group position={[xPos, 0, 0]}>
        {sortedDrawers.map((heightMm, i) => {
          const heightM = heightMm / 1000;
          const drawerY = currentY + heightM / 2;
          currentY += heightM + drawerReveal;
          const handleY = heightM/2 - 0.012;
          return (
            <group key={i} position={[0, drawerY, 0]}>
              <mesh position={[0, 0, depth/2 - shellThickness/2]}><boxGeometry args={[drawerWidth, heightM - drawerReveal, shellThickness]} /><meshStandardMaterial color={faciaColor} roughness={0.35} metalness={0.15} /></mesh>
              <mesh position={[0, handleY, depth/2 + 0.008]}><boxGeometry args={[handleWidth, 0.016, 0.012]} />{drawerHandleMaterial}</mesh>
            </group>
          );
        })}
      </group>
    );
  };
  
  const RearAccessories = () => {
    if (!hasRearPosts) return null;
    const postHeight = rearPanelHeight;
    const postSize = 0.04;
    const crossbarHeight = 0.03;
    const baseY = castorHeight + cabinetBodyHeight + worktopThickness;
    const panelInset = postSize + 0.005;
    const panelWidth = cabinetWidth - panelInset * 2;
    const panelHeight = 0.30;
    
    const SingleLouvrePanel = ({ yPos }: { yPos: number }) => (
      <group position={[0, yPos, -depth/2 + 0.035]}>
        <mesh><boxGeometry args={[panelWidth, panelHeight, 0.012]} /><meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.2} /></mesh>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} position={[0, -panelHeight/2 + (panelHeight/8) * (i + 0.5), 0.012]}><boxGeometry args={[panelWidth - 0.02, 0.028, 0.015]} /><meshStandardMaterial color={frameColor} roughness={0.35} metalness={0.25} /></mesh>
        ))}
      </group>
    );
    
    const SingleToolboardPanel = ({ yPos }: { yPos: number }) => {
      // Grid of square holes - approx 25mm spacing, 8mm square holes
      const holeSpacing = 0.025; // 25mm between hole centers
      const holeSize = 0.008;    // 8mm square holes
      const cols = Math.floor((panelWidth - 0.04) / holeSpacing);
      const rows = Math.floor((panelHeight - 0.02) / holeSpacing);
      
      return (
        <group position={[0, yPos, -depth/2 + 0.035]}>
          {/* Main panel */}
          <mesh><boxGeometry args={[panelWidth, panelHeight, 0.012]} /><meshStandardMaterial color={frameColor} roughness={0.45} metalness={0.2} /></mesh>
          
          {/* Square holes grid */}
          {Array.from({ length: rows }).map((_, row) => 
            Array.from({ length: cols }).map((_, col) => {
              const x = -panelWidth/2 + 0.03 + col * holeSpacing;
              const y = -panelHeight/2 + 0.02 + row * holeSpacing;
              return (
                <mesh key={`${row}-${col}`} position={[x, y, 0.007]}>
                  <boxGeometry args={[holeSize, holeSize, 0.006]} />
                  <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
                </mesh>
              );
            })
          )}
        </group>
      );
    };
    
    // Wedge-shaped shelf end bracket - hooks into holes in middle of upright posts
    // Creates a right-triangle bracket that runs the full length of the base plate
    const WedgeBracket = ({ side }: { side: 'left' | 'right' }) => {
      // Wedge dimensions matching the tray shelf exactly (see reference image)
      const wedgeHeight = 0.095;     // Vertical height at back (95mm) - matches rear lip
      const wedgeDepth = 0.208;      // Full depth of base plate (208mm)
      const wedgeThickness = 0.003;  // Sheet metal thickness (3mm)
      const tipCutoff = 0.012;       // Small chamfer at bottom-front tip (12mm)
      
      // Create wedge geometry defined in YZ plane (Y=height, Z=depth forward)
      // so we don't need complex rotations - just mirror X for right side
      const geometry = useMemo(() => {
        const geo = new THREE.BufferGeometry();
        const t = wedgeThickness;
        const mirrorX = side === 'right' ? -1 : 1;
        
        // Define wedge profile in YZ plane, extruded in X direction:
        // Looking from the left side of the shelf (-X direction):
        //   v0: Top rear corner (0, wedgeHeight, 0)
        //   v1: Bottom rear corner (0, 0, 0)  
        //   v2: Bottom front before chamfer (0, 0, wedgeDepth - tipCutoff)
        //   v3: Chamfer tip (0, tipCutoff, wedgeDepth)
        // The hypotenuse goes from v0 (top rear) to v3 (chamfer tip)
        
        // Inner face (toward shelf center, X = 0)
        const v0 = [0, wedgeHeight, 0];                    // Top rear
        const v1 = [0, 0, 0];                               // Bottom rear
        const v2 = [0, 0, wedgeDepth - tipCutoff];          // Bottom front (before chamfer)
        const v3 = [0, tipCutoff, wedgeDepth];              // Chamfer tip
        
        // Outer face (away from shelf center, X = thickness)
        const v4 = [t * mirrorX, wedgeHeight, 0];
        const v5 = [t * mirrorX, 0, 0];
        const v6 = [t * mirrorX, 0, wedgeDepth - tipCutoff];
        const v7 = [t * mirrorX, tipCutoff, wedgeDepth];
        
        const positions = new Float32Array([
          // Inner face (2 triangles forming the wedge profile)
          ...v0, ...v1, ...v2,
          ...v0, ...v2, ...v3,
          
          // Outer face (reversed winding for correct normals)
          ...v4, ...v6, ...v5,
          ...v4, ...v7, ...v6,
          
          // Bottom edge (horizontal base of triangle)
          ...v1, ...v5, ...v6,
          ...v1, ...v6, ...v2,
          
          // Rear edge (vertical back of triangle)
          ...v0, ...v4, ...v5,
          ...v0, ...v5, ...v1,
          
          // Hypotenuse edge (sloped front, from top-rear to chamfer tip)
          ...v0, ...v3, ...v7,
          ...v0, ...v7, ...v4,
          
          // Chamfer edge (small vertical edge at front tip)
          ...v2, ...v6, ...v7,
          ...v2, ...v7, ...v3,
        ]);
        
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.computeVertexNormals();
        
        return geo;
      }, [side]);
      
      // Position bracket at edge of shelf - halfway into the upright post (hooks into center holes)
      const xOffset = side === 'left' 
        ? -cabinetWidth/2 + postSize/2  // Left: halfway into left post
        : cabinetWidth/2 - postSize/2;  // Right: halfway into right post
      
      return (
        <mesh 
          geometry={geometry} 
          position={[xOffset, 0, 0]}
        >
          <meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.25} side={THREE.DoubleSide} />
        </mesh>
      );
    };
    
    const TrayShelf = ({ yPos }: { yPos: number }) => {
      // Shelf width spans between the wedge brackets (which are at postSize/2 from post edges)
      const trayWidth = cabinetWidth - postSize; // Shelf sits between the bracket attachment points
      const trayDepth = 0.208;      // 208mm depth
      const rearHeight = 0.095;     // 95mm rear lip height
      const frontLipHeight = 0.012; // Small front lip (12mm)
      const shelfZ = -depth/2 + trayDepth/2 + postSize;
      
      return (
        <group position={[0, yPos, shelfZ]}>
          {/* Main shelf surface (base plate) */}
          <mesh><boxGeometry args={[trayWidth, 0.003, trayDepth]} /><meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.25} /></mesh>
          
          {/* Rear lip (95mm tall) */}
          <mesh position={[0, rearHeight/2, -trayDepth/2 + 0.003]}><boxGeometry args={[trayWidth, rearHeight, 0.006]} /><meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.25} /></mesh>
          
          {/* Front lip / joining edge (small edge at front of base plate) */}
          <mesh position={[0, frontLipHeight/2, trayDepth/2 - 0.003]}><boxGeometry args={[trayWidth, frontLipHeight, 0.006]} /><meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.25} /></mesh>
          
          {/* Wedge-shaped side brackets - run full length of base plate */}
          <group position={[0, 0, -trayDepth/2]}>
            <WedgeBracket side="left" />
            <WedgeBracket side="right" />
          </group>
        </group>
      );
    };
    
    const topShelfHeight = 0.095 + 0.02;
    const stackStartY = baseY + postHeight - crossbarHeight - topShelfHeight - 0.02;
    const panelPositions: { type: 'louvre' | 'toolboard', yCenter: number }[] = [];
    let currentStackY = stackStartY;
    
    for (let i = 0; i < louvreCount; i++) {
      currentStackY -= panelHeight / 2;
      panelPositions.push({ type: 'louvre', yCenter: currentStackY });
      currentStackY -= panelHeight / 2 + 0.005;
    }
    for (let i = 0; i < toolboardCount; i++) {
      currentStackY -= panelHeight / 2;
      panelPositions.push({ type: 'toolboard', yCenter: currentStackY });
      currentStackY -= panelHeight / 2 + 0.005;
    }
    
    return (
      <group>
        {/* Upright posts */}
        <mesh position={[-cabinetWidth/2 + postSize/2 + 0.005, baseY + postHeight/2, -depth/2 + postSize/2]}><boxGeometry args={[postSize, postHeight, postSize]} />{shellMaterial}</mesh>
        <mesh position={[cabinetWidth/2 - postSize/2 - 0.005, baseY + postHeight/2, -depth/2 + postSize/2]}><boxGeometry args={[postSize, postHeight, postSize]} />{shellMaterial}</mesh>
        {/* Top crossbar */}
        <mesh position={[0, baseY + postHeight - crossbarHeight/2, -depth/2 + postSize/2]}><boxGeometry args={[cabinetWidth - postSize, crossbarHeight, postSize]} />{shellMaterial}</mesh>
        {/* Panels (louvre/toolboard) */}
        {panelPositions.map((panel, idx) => (
          panel.type === 'louvre' 
            ? <SingleLouvrePanel key={idx} yPos={panel.yCenter} />
            : <SingleToolboardPanel key={idx} yPos={panel.yCenter} />
        ))}
        {trayCount > 0 && Array.from({ length: trayCount }).map((_, i) => {
          // Each shelf is 95mm (0.095m) tall - don't let them overlap!
          const shelfHeight = 0.095;
          const gap = 0.004; // 4mm gap between shelves
          const bottomMargin = 0.05; // Gap above worktop
          
          // Top shelf sits directly against the crossbar (no gap at top)
          const topShelfY = baseY + postHeight - crossbarHeight - shelfHeight;
          const usableBottom = baseY + bottomMargin;
          
          // Calculate panel bounds (louvre or toolboard panels)
          const hasPanels = panelPositions.length > 0;
          const panelsTop = hasPanels ? panelPositions[0].yCenter + panelHeight/2 : topShelfY;
          const panelsBottom = hasPanels ? panelPositions[panelPositions.length - 1].yCenter - panelHeight/2 : usableBottom;
          const panelsMiddle = (panelsTop + panelsBottom) / 2;
          
          let shelfY: number;
          
          if (trayCount === 1) {
            // Single shelf: at the top, tight against crossbar
            shelfY = topShelfY;
          } else if (trayCount === 2) {
            // 2 shelves: top shelf tight, bottom shelf positioned to divide remaining space evenly
            if (i === 0) {
              shelfY = topShelfY; // Top shelf tight against crossbar
            } else {
              // Position second shelf to create even gap distribution
              const remainingSpace = topShelfY - usableBottom - shelfHeight;
              shelfY = usableBottom + remainingSpace / 2;
            }
          } else if (trayCount === 3 && hasPanels) {
            // 3 shelves with panels (louvre or toolboard): top, middle of panels, bottom of panels
            if (i === 0) {
              shelfY = topShelfY; // Top shelf tight against crossbar
            } else if (i === 1) {
              shelfY = panelsMiddle - shelfHeight/2; // Middle shelf centered on panel area
            } else {
              shelfY = panelsBottom - shelfHeight; // Bottom shelf at bottom of panel area
            }
          } else {
            // 3+ shelves (no louvres) or 4+ shelves: top shelf tight, then stack down with 4mm gaps
            shelfY = topShelfY - (i * (shelfHeight + gap));
          }
          
          return <TrayShelf key={i} yPos={shelfY} />;
        })}
      </group>
    );
  };
  
  return (
    <Center bottom>
      <group>
        <Castor position={[-cabinetWidth/2 + 0.07, 0, depth/2 - 0.07]} />
        <Castor position={[cabinetWidth/2 - 0.07, 0, depth/2 - 0.07]} />
        <Castor position={[-cabinetWidth/2 + 0.07, 0, -depth/2 + 0.07]} />
        <Castor position={[cabinetWidth/2 - 0.07, 0, -depth/2 + 0.07]} />
        
        <mesh position={[-cabinetWidth/2 + shellThickness/2, castorHeight + cabinetBodyHeight/2, 0]}><boxGeometry args={[shellThickness, cabinetBodyHeight, depth]} />{shellMaterial}</mesh>
        <mesh position={[cabinetWidth/2 - shellThickness/2, castorHeight + cabinetBodyHeight/2, 0]}><boxGeometry args={[shellThickness, cabinetBodyHeight, depth]} />{shellMaterial}</mesh>
        <mesh position={[0, castorHeight + shellThickness + drawerStackHeight/2, -depth/2 + shellThickness/2]}><boxGeometry args={[cabinetWidth - shellThickness * 2, drawerStackHeight, shellThickness]} />{shellMaterial}</mesh>
        <mesh position={[0, castorHeight + cabinetBodyHeight - shellThickness/2, -depth/2 + shellThickness/2]}><boxGeometry args={[cabinetWidth - shellThickness * 2, shellThickness, shellThickness]} />{shellMaterial}</mesh>
        <mesh position={[0, castorHeight + shellThickness/2, 0]}><boxGeometry args={[cabinetWidth - shellThickness * 2, shellThickness, depth - shellThickness]} />{shellMaterial}</mesh>
        <mesh position={[0, castorHeight + cabinetBodyHeight - shellThickness/2, 0]}><boxGeometry args={[cabinetWidth - shellThickness * 2, shellThickness, depth - shellThickness]} />{shellMaterial}</mesh>
        <mesh position={[0, castorHeight + shellThickness + drawerStackHeight/2, 0]}><boxGeometry args={[shellThickness, drawerStackHeight, depth - shellThickness * 2]} />{shellMaterial}</mesh>
        <mesh position={[0, castorHeight + shellThickness + drawerStackHeight + shellThickness/2, 0]}><boxGeometry args={[cabinetWidth - shellThickness * 2, shellThickness, depth - shellThickness * 2]} />{shellMaterial}</mesh>
        
        <mesh position={[worktopOverhangSide/2, castorHeight + cabinetBodyHeight + worktopThickness/2, worktopOverhangFront/2]}>
          <boxGeometry args={[cabinetWidth + worktopOverhangSide * 2, worktopThickness, depth + worktopOverhangFront]} />
          <meshStandardMaterial color={worktopColor} roughness={0.3} metalness={0.2} />
        </mesh>
        
        <SideGrabHandle side="left" />
        <SideGrabHandle side="right" />
        
        {leftCupboard ? <CupboardBay xPos={-cabinetWidth/4 - shellThickness/4} /> : leftDrawers.length > 0 && <DrawerStack xPos={-cabinetWidth/4 - shellThickness/4} drawerHeights={leftDrawers} />}
        {rightCupboard ? <CupboardBay xPos={cabinetWidth/4 + shellThickness/4} /> : rightDrawers.length > 0 && <DrawerStack xPos={cabinetWidth/4 + shellThickness/4} drawerHeights={rightDrawers} />}
        
        <RearAccessories />
      </group>
    </Center>
  );
};

// ==========================================
// INDUSTRIAL STORAGE CUPBOARD COMPONENT
// Fixed dimensions: 900mm W × 450mm D × 1800/2000mm H
// Slope top: Front height = cupboardHeight, Back height = cupboardHeight + slopeRise
// ==========================================

// Trapezoidal side panel for sloped top cupboards
// Creates a panel that is taller at the back than the front
const TrapezoidalSidePanel = ({ 
  xPosition, 
  baseY,
  frontHeight,
  backHeight,
  depth,
  thickness, 
  color
}: { 
  xPosition: number;
  baseY: number;
  frontHeight: number;
  backHeight: number;
  depth: number;
  thickness: number;
  color: string;
}) => {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const halfThickness = thickness / 2;
    const halfDepth = depth / 2;
    
    // Create a trapezoidal prism (4 corners, extruded along X)
    // Front-bottom (0), Front-top (frontHeight), Back-bottom (0), Back-top (backHeight)
    const vertices = new Float32Array([
      // Left face (trapezoid)
      -halfThickness, 0, halfDepth,           // front-bottom
      -halfThickness, frontHeight, halfDepth, // front-top
      -halfThickness, backHeight, -halfDepth, // back-top
      
      -halfThickness, 0, halfDepth,           // front-bottom
      -halfThickness, backHeight, -halfDepth, // back-top
      -halfThickness, 0, -halfDepth,          // back-bottom
      
      // Right face (trapezoid)
      halfThickness, 0, halfDepth,            // front-bottom
      halfThickness, backHeight, -halfDepth,  // back-top
      halfThickness, frontHeight, halfDepth,  // front-top
      
      halfThickness, 0, halfDepth,            // front-bottom
      halfThickness, 0, -halfDepth,           // back-bottom
      halfThickness, backHeight, -halfDepth,  // back-top
      
      // Front face (rectangle)
      -halfThickness, 0, halfDepth,
      halfThickness, 0, halfDepth,
      halfThickness, frontHeight, halfDepth,
      
      -halfThickness, 0, halfDepth,
      halfThickness, frontHeight, halfDepth,
      -halfThickness, frontHeight, halfDepth,
      
      // Back face (rectangle - taller)
      -halfThickness, 0, -halfDepth,
      halfThickness, backHeight, -halfDepth,
      halfThickness, 0, -halfDepth,
      
      -halfThickness, 0, -halfDepth,
      -halfThickness, backHeight, -halfDepth,
      halfThickness, backHeight, -halfDepth,
      
      // Top face (sloped rectangle)
      -halfThickness, frontHeight, halfDepth,
      halfThickness, frontHeight, halfDepth,
      halfThickness, backHeight, -halfDepth,
      
      -halfThickness, frontHeight, halfDepth,
      halfThickness, backHeight, -halfDepth,
      -halfThickness, backHeight, -halfDepth,
      
      // Bottom face
      -halfThickness, 0, halfDepth,
      halfThickness, 0, -halfDepth,
      halfThickness, 0, halfDepth,
      
      -halfThickness, 0, halfDepth,
      -halfThickness, 0, -halfDepth,
      halfThickness, 0, -halfDepth,
    ]);
    
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.computeVertexNormals();
    return geo;
  }, [frontHeight, backHeight, depth, thickness]);
  
  return (
    <mesh geometry={geometry} position={[xPosition, baseY, 0]}>
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
};

export const StorageCupboardGroup = ({ config, product, bodyColor = '#333', doorColor = '#ccc', doorsOpen = false }: any) => {
  // ========================================
  // CONFIGURATION EXTRACTION
  // ========================================
  
  const configGroup = product.groups.find((g: any) => g.id === 'cupboard_config');
  const selectedConfigId = config.selections['cupboard_config'];
  const configOption = configGroup?.options.find((o: any) => o.id === selectedConfigId);
  
  // Fixed dimensions per Boscotek spec
  const cupboardWidth = 0.9;   // 900mm
  const cupboardDepth = 0.45;  // 450mm
  const cupboardHeight = configOption?.meta?.height || 1.8; // 1800mm or 2000mm (this is the BACK height for slope)
  const topType = configOption?.meta?.topType || 'flat'; // 'flat' or 'slope'
  const shelfCount = configOption?.meta?.shelfCount || 4;
  const shelfType = configOption?.meta?.shelfType || 'adjustable';
  const fixedShelves = configOption?.meta?.fixedShelves || 0;
  const halfShelves = configOption?.meta?.halfShelves || 0;
  
  // ========================================
  // GEOMETRY CONSTANTS
  // ========================================
  
  const panelThickness = 0.015;  // 15mm steel panels
  const doorGap = 0.003;         // 3mm gap between doors
  const baseHeight = 0.1;        // 100mm base/plinth
  const slopeRise = 0.12;        // 120mm slope rise (back is higher than front)
  const shelfThickness = 0.02;   // 20mm shelf thickness
  const handleWidth = 0.03;
  const handleHeight = 0.15;
  const handleDepth = 0.02;
  
  // For sloped top: front is lower, back is at full cupboardHeight
  // The slope rise is the difference between back and front
  const frontTopHeight = topType === 'slope' ? cupboardHeight - slopeRise : cupboardHeight;
  const backTopHeight = cupboardHeight;
  
  // Door height: from base to front top (underside of slope at front)
  const doorTopY = frontTopHeight; // Doors go right up to the front edge of the top
  
  // Usable interior space (based on front height for consistency)
  const interiorWidth = cupboardWidth - (panelThickness * 2);
  const interiorDepth = cupboardDepth - (panelThickness * 2);
  const interiorTop = frontTopHeight - panelThickness - baseHeight;
  const interiorBottom = baseHeight + panelThickness;
  const usableHeight = interiorTop - interiorBottom;
  
  // ========================================
  // SHELF POSITIONING
  // ========================================
  
  // Implement configuration layout:
  // ┌───────────────────────────┐
  // │        TOP CAVITY         │  ← Full width, undivided (top 25% of interior)
  // ├───────────────┬───────────┤
  // │               │  Right 1  │  ← Right side has 3 compartments
  // │   LEFT        ├───────────┤
  // │   LOWER       │  Right 2  │
  // │   CAVITY      ├───────────┤
  // │               │  Right 3  │
  // └───────────────┴───────────┘
  
  const isImplementLayout = shelfType === 'mixed' && fixedShelves > 0 && halfShelves > 0;
  
  // For Implement: Top cavity takes top 25%, lower section is 75%
  const topCavityHeight = isImplementLayout ? usableHeight * 0.25 : 0;
  const lowerSectionTop = interiorTop - topCavityHeight;
  const lowerSectionHeight = lowerSectionTop - interiorBottom;
  
  // Vertical divider position (center of cabinet)
  const dividerX = 0;
  const halfWidth = (interiorWidth / 2) - 0.01;
  
  const calculateShelfPositions = () => {
    const positions: { y: number; width: number; xOffset: number; isFixed: boolean }[] = [];
    
    if (isImplementLayout) {
      // IMPLEMENT LAYOUT:
      // 1. Fixed shelf at bottom of top cavity (creates the full-width top cavity)
      const topCavityShelfY = lowerSectionTop;
      positions.push({ y: topCavityShelfY, width: interiorWidth - 0.01, xOffset: 0, isFixed: true });
      
      // 2. Two half-shelves on the RIGHT side only, dividing into 3 compartments
      const rightShelfSpacing = lowerSectionHeight / 3;
      // First right shelf (1/3 up from bottom)
      positions.push({ 
        y: interiorBottom + rightShelfSpacing, 
        width: halfWidth - 0.005, 
        xOffset: interiorWidth / 4 + 0.005, // Right side
        isFixed: false 
      });
      // Second right shelf (2/3 up from bottom)
      positions.push({ 
        y: interiorBottom + (rightShelfSpacing * 2), 
        width: halfWidth - 0.005, 
        xOffset: interiorWidth / 4 + 0.005, // Right side
        isFixed: false 
      });
    } else {
      // Regular adjustable shelves - evenly distributed full-width
      const spacing = usableHeight / (shelfCount + 1);
      for (let i = 1; i <= shelfCount; i++) {
        const y = interiorBottom + (spacing * i);
        positions.push({ y, width: interiorWidth - 0.01, xOffset: 0, isFixed: false });
      }
    }
    
    return positions;
  };
  
  const shelfPositions = calculateShelfPositions();
  
  // ========================================
  // SUB-COMPONENTS
  // ========================================
  
  // Cabinet Shell (sides, back, top, bottom, base)
  const CabinetShell = () => {
    // Side panel heights
    const sideFrontHeight = frontTopHeight - baseHeight;
    const sideBackHeight = backTopHeight - baseHeight;
    
    return (
      <group>
        {/* Base/Plinth */}
        <mesh position={[0, baseHeight/2, 0]}>
          <boxGeometry args={[cupboardWidth, baseHeight, cupboardDepth]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
        
        {topType === 'flat' ? (
          <>
            {/* FLAT TOP: Standard rectangular side panels */}
            {/* Left Side Panel */}
            <mesh position={[-cupboardWidth/2 + panelThickness/2, baseHeight + sideFrontHeight/2, 0]}>
              <boxGeometry args={[panelThickness, sideFrontHeight, cupboardDepth]} />
              <meshStandardMaterial color={bodyColor} roughness={0.4} metalness={0.6} />
            </mesh>
            
            {/* Right Side Panel */}
            <mesh position={[cupboardWidth/2 - panelThickness/2, baseHeight + sideFrontHeight/2, 0]}>
              <boxGeometry args={[panelThickness, sideFrontHeight, cupboardDepth]} />
              <meshStandardMaterial color={bodyColor} roughness={0.4} metalness={0.6} />
            </mesh>
            
            {/* Back Panel */}
            <mesh position={[0, baseHeight + sideFrontHeight/2, -cupboardDepth/2 + panelThickness/2]}>
              <boxGeometry args={[cupboardWidth - panelThickness*2, sideFrontHeight, panelThickness]} />
              <meshStandardMaterial color={bodyColor} roughness={0.4} metalness={0.6} />
            </mesh>
            
            {/* Top Panel - flat */}
            <mesh position={[0, frontTopHeight - panelThickness/2, 0]}>
              <boxGeometry args={[cupboardWidth, panelThickness, cupboardDepth]} />
              <meshStandardMaterial color={bodyColor} roughness={0.4} metalness={0.6} />
            </mesh>
          </>
        ) : (
          <>
            {/* SLOPED TOP: Trapezoidal side panels (taller at back) */}
            {/* Left Side Panel - trapezoidal */}
            <TrapezoidalSidePanel
              xPosition={-cupboardWidth/2 + panelThickness/2}
              baseY={baseHeight}
              frontHeight={sideFrontHeight}
              backHeight={sideBackHeight}
              depth={cupboardDepth}
              thickness={panelThickness}
              color={bodyColor}
            />
            
            {/* Right Side Panel - trapezoidal */}
            <TrapezoidalSidePanel
              xPosition={cupboardWidth/2 - panelThickness/2}
              baseY={baseHeight}
              frontHeight={sideFrontHeight}
              backHeight={sideBackHeight}
              depth={cupboardDepth}
              thickness={panelThickness}
              color={bodyColor}
            />
            
            {/* Back Panel - full height to backTopHeight */}
            <mesh position={[0, baseHeight + sideBackHeight/2, -cupboardDepth/2 + panelThickness/2]}>
              <boxGeometry args={[cupboardWidth - panelThickness*2, sideBackHeight, panelThickness]} />
              <meshStandardMaterial color={bodyColor} roughness={0.4} metalness={0.6} />
            </mesh>
            
            {/* Sloped Top Panel - sits directly on top of side panels, NO GAP */}
            <mesh 
              position={[0, (frontTopHeight + backTopHeight) / 2 - panelThickness/2, 0]}
              rotation={[Math.atan2(slopeRise, cupboardDepth), 0, 0]}
            >
              <boxGeometry args={[cupboardWidth, panelThickness, Math.sqrt(cupboardDepth * cupboardDepth + slopeRise * slopeRise)]} />
              <meshStandardMaterial color={bodyColor} roughness={0.4} metalness={0.6} />
            </mesh>
          </>
        )}
        
        {/* Bottom Panel (floor of interior) */}
        <mesh position={[0, baseHeight + panelThickness/2, 0]}>
          <boxGeometry args={[cupboardWidth - panelThickness*2, panelThickness, cupboardDepth - panelThickness*2]} />
          <meshStandardMaterial color={bodyColor} roughness={0.5} metalness={0.5} />
        </mesh>
      </group>
    );
  };
  
  // Double Doors (with open/close state)
  // Doors fill the full front opening - from base to underside of top (or front edge of slope)
  // Doors swing OUTWARD from hinges on the cabinet sides
  const Doors = () => {
    const doorWidth = (cupboardWidth - panelThickness*2 - doorGap) / 2;
    // Door height: from top of base to underside of front top edge
    const doorHeight = frontTopHeight - baseHeight - panelThickness;
    const doorYCenter = baseHeight + doorHeight/2 + panelThickness/2;
    
    // Door front face position (flush with cabinet front)
    const doorZ = cupboardDepth/2;
    
    // When doors are open, rotate them 110 degrees OUTWARD around their hinge edge
    const doorOpenAngle = doorsOpen ? Math.PI * 0.61 : 0; // 110 degrees
    
    // Vertical reinforcement strip on inside of door
    const stripWidth = 0.2;  // 20cm wide
    const stripThickness = 0.003; // 3mm thick
    
    return (
      <group>
        {/* Left Door - hinge on LEFT outer edge, swings outward to the left */}
        {/* Pivot point is at left side of cabinet, front face */}
        <group position={[-cupboardWidth/2 + panelThickness, doorYCenter, doorZ]}>
          <group rotation={[0, -doorOpenAngle, 0]}>
            {/* Door panel */}
            <mesh position={[doorWidth/2, 0, -panelThickness/2]}>
              <boxGeometry args={[doorWidth, doorHeight, panelThickness]} />
              <meshStandardMaterial color={doorColor} roughness={0.3} metalness={0.5} />
            </mesh>
            {/* Vertical reinforcement strip on inside of door (center) */}
            <mesh position={[doorWidth/2, 0, -panelThickness - stripThickness/2]}>
              <boxGeometry args={[stripWidth, doorHeight, stripThickness]} />
              <meshStandardMaterial color={bodyColor} roughness={0.4} metalness={0.6} />
            </mesh>
            {/* Left Door Handle - near the center edge of door */}
            <mesh position={[doorWidth - 0.05, 0, handleDepth/2]}>
              <boxGeometry args={[handleWidth, handleHeight, handleDepth]} />
              <meshStandardMaterial color="#52525b" roughness={0.3} metalness={0.8} />
            </mesh>
          </group>
        </group>
        
        {/* Right Door - hinge on RIGHT outer edge, swings outward to the right */}
        {/* Pivot point is at right side of cabinet, front face */}
        <group position={[cupboardWidth/2 - panelThickness, doorYCenter, doorZ]}>
          <group rotation={[0, doorOpenAngle, 0]}>
            {/* Door panel */}
            <mesh position={[-doorWidth/2, 0, -panelThickness/2]}>
              <boxGeometry args={[doorWidth, doorHeight, panelThickness]} />
              <meshStandardMaterial color={doorColor} roughness={0.3} metalness={0.5} />
            </mesh>
            {/* Vertical reinforcement strip on inside of door (center) */}
            <mesh position={[-doorWidth/2, 0, -panelThickness - stripThickness/2]}>
              <boxGeometry args={[stripWidth, doorHeight, stripThickness]} />
              <meshStandardMaterial color={bodyColor} roughness={0.4} metalness={0.6} />
            </mesh>
            {/* Right Door Handle - near the center edge of door */}
            <mesh position={[-doorWidth + 0.05, 0, handleDepth/2]}>
              <boxGeometry args={[handleWidth, handleHeight, handleDepth]} />
              <meshStandardMaterial color="#52525b" roughness={0.3} metalness={0.8} />
            </mesh>
          </group>
        </group>
      </group>
    );
  };
  
  // Shelves and Internal Dividers
  const Shelves = () => {
    // For Implement layout, the vertical divider runs from bottom to top cavity shelf
    const dividerHeight = isImplementLayout ? lowerSectionHeight : 0;
    const dividerY = isImplementLayout ? interiorBottom + dividerHeight / 2 : 0;
    
    return (
      <group>
        {/* Vertical divider for Implement layout */}
        {isImplementLayout && (
          <mesh position={[0, dividerY, 0]}>
            <boxGeometry args={[panelThickness, dividerHeight, interiorDepth - 0.02]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} metalness={0.5} />
          </mesh>
        )}
        
        {/* Shelves */}
        {shelfPositions.map((shelf, idx) => (
          <mesh 
            key={idx} 
            position={[shelf.xOffset, shelf.y, 0]}
          >
            <boxGeometry args={[shelf.width, shelfThickness, interiorDepth - 0.02]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} metalness={0.5} />
          </mesh>
        ))}
      </group>
    );
  };
  
  // ========================================
  // MAIN RENDER
  // ========================================
  
  return (
    <Center bottom>
      <group>
        <CabinetShell />
        <Doors />
        <Shelves />
      </group>
    </Center>
  );
};

// ==========================================
// 3. WORKBENCH VISUALIZER COMPONENTS
// ==========================================

const WORKBENCH_LEG_SIZE = 0.06;
const CASTOR_HEIGHT = 0.12;
const FOOT_HEIGHT = 0.05; 

const LevellingFoot = () => (
  <group>
    <mesh position={[0, 0.035, 0]}><cylinderGeometry args={[0.012, 0.012, 0.05, 8]} /><meshStandardMaterial color="#e4e4e7" metalness={0.8} roughness={0.3} /></mesh>
    <mesh position={[0, 0.025, 0]}><cylinderGeometry args={[0.02, 0.02, 0.015, 6]} /><meshStandardMaterial color="#d4d4d8" metalness={0.7} roughness={0.3} /></mesh>
    <mesh position={[0, 0.012, 0]}><cylinderGeometry args={[0.035, 0.04, 0.01, 16]} /><meshStandardMaterial color="#d4d4d8" metalness={0.6} roughness={0.3} /></mesh>
    <mesh position={[0, 0.004, 0]}><cylinderGeometry args={[0.04, 0.04, 0.008, 16]} /><meshStandardMaterial color="#18181b" roughness={0.9} /></mesh>
  </group>
);

const WorkbenchFrame = ({ width, height, depth, castors, colorHex, variant = 'heavy' }: { width: number, height: number, depth: number, castors: boolean, colorHex: string, variant?: 'heavy' | 'industrial' }) => {
  const legOffset = castors ? CASTOR_HEIGHT : FOOT_HEIGHT;
  const legMeshHeight = height - legOffset;
  const legCenterY = legOffset + (legMeshHeight / 2);
  const materialProps = { color: colorHex, roughness: 0.4, metalness: 0.1 };
  const depthPos = (dir: 1 | -1) => dir * (depth / 2 - WORKBENCH_LEG_SIZE / 2);
  const isIndustrial = variant === 'industrial';

  return (
    <group>
      {/* 4 LEGS */}
      {[[width / 2 - WORKBENCH_LEG_SIZE / 2, depthPos(1)], [-width / 2 + WORKBENCH_LEG_SIZE / 2, depthPos(1)], [width / 2 - WORKBENCH_LEG_SIZE / 2, depthPos(-1)], [-width / 2 + WORKBENCH_LEG_SIZE / 2, depthPos(-1)]].map((pos, i) => (
        <group key={i} position={[pos[0] as number, 0, pos[1] as number]}>
           <mesh position={[0, legCenterY, 0]} castShadow receiveShadow><boxGeometry args={[WORKBENCH_LEG_SIZE, legMeshHeight, WORKBENCH_LEG_SIZE]} /><meshStandardMaterial {...materialProps} /></mesh>
           {castors ? (
              <group position={[0, 0, 0]}>
                 <mesh position={[0, CASTOR_HEIGHT - 0.02, 0]}><boxGeometry args={[0.06, 0.04, 0.06]} /><meshStandardMaterial color="#3f3f46" /></mesh>
                 <mesh position={[0, CASTOR_HEIGHT/2 - 0.01, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.05, 0.05, 0.04, 16]} /><meshStandardMaterial color="#18181b" /></mesh>
                 <mesh position={[0, CASTOR_HEIGHT/2 - 0.01, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.02, 0.02, 0.045, 16]} /><meshStandardMaterial color="#71717a" /></mesh>
              </group>
           ) : <LevellingFoot />}
        </group>
      ))}
      <mesh position={[0, height - WORKBENCH_LEG_SIZE/2, depthPos(1)]}><boxGeometry args={[width, WORKBENCH_LEG_SIZE, WORKBENCH_LEG_SIZE]} /><meshStandardMaterial {...materialProps} /></mesh>
      <mesh position={[0, height - WORKBENCH_LEG_SIZE/2, depthPos(-1)]}><boxGeometry args={[width, WORKBENCH_LEG_SIZE, WORKBENCH_LEG_SIZE]} /><meshStandardMaterial {...materialProps} /></mesh>
      <mesh position={[width/2 - WORKBENCH_LEG_SIZE/2, height - WORKBENCH_LEG_SIZE/2, 0]}><boxGeometry args={[WORKBENCH_LEG_SIZE, WORKBENCH_LEG_SIZE, depth - WORKBENCH_LEG_SIZE*2]} /><meshStandardMaterial {...materialProps} /></mesh>
      <mesh position={[-width/2 + WORKBENCH_LEG_SIZE/2, height - WORKBENCH_LEG_SIZE/2, 0]}><boxGeometry args={[WORKBENCH_LEG_SIZE, WORKBENCH_LEG_SIZE, depth - WORKBENCH_LEG_SIZE*2]} /><meshStandardMaterial {...materialProps} /></mesh>
      {!isIndustrial && <mesh position={[0, 0.2 + (castors ? 0.05 : 0), depthPos(-1)]}><boxGeometry args={[width - 0.1, WORKBENCH_LEG_SIZE*0.8, WORKBENCH_LEG_SIZE*0.8]} /><meshStandardMaterial {...materialProps} /></mesh>}
      {isIndustrial && (
         <group position={[0, legOffset + 0.15, 0]}>
            <mesh position={[-width/2 + WORKBENCH_LEG_SIZE/2, 0, 0]} castShadow><boxGeometry args={[WORKBENCH_LEG_SIZE, WORKBENCH_LEG_SIZE, depth - WORKBENCH_LEG_SIZE*2]} /><meshStandardMaterial {...materialProps} /></mesh>
            <mesh position={[width/2 - WORKBENCH_LEG_SIZE/2, 0, 0]} castShadow><boxGeometry args={[WORKBENCH_LEG_SIZE, WORKBENCH_LEG_SIZE, depth - WORKBENCH_LEG_SIZE*2]} /><meshStandardMaterial {...materialProps} /></mesh>
            <mesh position={[0, 0, 0]} castShadow><boxGeometry args={[width - WORKBENCH_LEG_SIZE*2, WORKBENCH_LEG_SIZE, WORKBENCH_LEG_SIZE]} /><meshStandardMaterial {...materialProps} /></mesh>
         </group>
      )}
    </group>
  );
};

const WorkbenchWorktop = ({ width, depth, height, materialId }: { width: number, depth: number, height: number, materialId: string }) => {
  const thickness = 0.04;
  const y = height + thickness / 2;
  const color = getMaterialColor(materialId, 'worktop');
  return <mesh position={[0, y, 0]} castShadow receiveShadow><boxGeometry args={[width + 0.04, thickness, depth + 0.04]} /><meshStandardMaterial color={color} roughness={0.6} metalness={materialId.includes('ss') ? 0.8 : 0.1} /></mesh>;
};

// --- ABOVE BENCH PANELS ---

const PegboardPanel = ({ width, height, color }: { width: number, height: number, color: string }) => {
  const pegTex = useMemo(() => PegboardTexture(color), [color]);
  pegTex.repeat.set(width * 16, height * 16); 
  
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[width, height, 0.015]} />
      <meshStandardMaterial color={color} map={pegTex} roughness={0.4} />
    </mesh>
  );
};

const LouvrePanel = ({ width, height, color }: { width: number, height: number, color: string }) => {
  const rows = Math.floor(height / 0.05); // 50mm spacing
  return (
    <group>
      <mesh>
        <boxGeometry args={[width, height, 0.01]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Pressed slots */}
      {Array.from({ length: rows }).map((_, i) => (
        <mesh key={i} position={[0, -height/2 + (i * 0.05) + 0.025, 0.005]}>
           <boxGeometry args={[width - 0.04, 0.005, 0.005]} />
           <meshStandardMaterial color="#1f2937" />
        </mesh>
      ))}
    </group>
  );
};

const ShelfTray = ({ width }: { width: number }) => (
  <group>
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[width, 0.01, 0.25]} />
      <meshStandardMaterial color="#e4e4e7" roughness={0.4} metalness={0.3} />
    </mesh>
    {/* Lip */}
    <mesh position={[0, 0.015, 0.125]}>
      <boxGeometry args={[width, 0.03, 0.002]} />
      <meshStandardMaterial color="#e4e4e7" roughness={0.4} metalness={0.3} />
    </mesh>
  </group>
);

const MonitorStand = ({ height }: { height: number }) => {
  return (
    <group position={[0, height, -0.2]}>
       <mesh position={[0, 0.01, 0]}><boxGeometry args={[0.2, 0.02, 0.15]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
       <mesh position={[0, 0.2, 0.05]}><cylinderGeometry args={[0.02, 0.02, 0.4]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
       <group position={[0, 0.4, 0.05]} rotation={[-0.1, 0, 0]}>
          <mesh><boxGeometry args={[0.5, 0.3, 0.03]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
          <mesh position={[0, 0, 0.02]}><planeGeometry args={[0.48, 0.28]} /><meshStandardMaterial color="#000" roughness={0.2} /></mesh>
       </group>
    </group>
  );
};

const AccessoryKitOverlay = ({ kitType, height, depth }: { kitType: string, height: number, depth: number }) => {
  if (kitType === 'none') return null;
  const zPos = -depth / 2 + 0.08;
  const startY = height + 0.6;
  
  const Tool = ({ x, y, color, scale = [1,1,1] }: any) => (
      <mesh position={[x, y, zPos]} scale={scale} castShadow>
          <boxGeometry args={[0.05, 0.15, 0.02]} />
          <meshStandardMaterial color={color} />
      </mesh>
  );

  return (
    <group>
        {kitType === 'red' && (
            <>
                <Tool x={-0.3} y={startY} color="#ef4444" />
                <Tool x={-0.2} y={startY + 0.1} color="#ef4444" scale={[0.5, 0.8, 1]} />
                <Tool x={-0.1} y={startY - 0.1} color="#9ca3af" scale={[1.5, 0.2, 1]} />
                <Tool x={0.2} y={startY + 0.05} color="#ef4444" />
            </>
        )}
        {kitType === 'green' && (
            <>
                <Tool x={-0.4} y={startY} color="#22c55e" />
                <Tool x={-0.3} y={startY + 0.1} color="#22c55e" scale={[0.5, 0.8, 1]} />
                <Tool x={-0.2} y={startY - 0.1} color="#9ca3af" scale={[1.5, 0.2, 1]} />
                <Tool x={0.0} y={startY + 0.2} color="#22c55e" />
                <Tool x={0.2} y={startY} color="#22c55e" scale={[0.8, 0.8, 1]} />
                <Tool x={0.4} y={startY + 0.1} color="#9ca3af" scale={[0.2, 1.5, 1]} />
            </>
        )}
    </group>
  );
};

const WorkbenchAccessories = ({ width, depth, height, underBenchId, aboveBenchId, frameColor, faciaColor, position, inclineAngle, kitSelection, accSelection, embeddedCabinets, product, activeDrawerIndex }: any) => {
  const shelfHeight = 0.22; 
  const shelfThick = 0.02;
  const drawerUnitWidth = 0.56;
  const hasPower = aboveBenchId.includes('power') || aboveBenchId === 'P' || aboveBenchId === 'SP';
  const isIndustrialAbove = aboveBenchId.startsWith('iw-');
  
  // COMPONENTS
  const Undershelf = ({ w, x }: { w?: number, x?: number }) => <mesh position={[x || 0, shelfHeight, 0]} receiveShadow><boxGeometry args={[w || width - 0.15, shelfThick, depth - 0.2]} /><meshStandardMaterial color="#a1a1aa" /></mesh>;
  
  const DrawerUnit = ({ x, drawerCount, suspended = false }: any) => {
     const uHeight = drawerCount * 0.15 + 0.05;
     const yPos = suspended ? (height - uHeight/2 - 0.05) : (height - uHeight/2 - 0.05); 
     return (
        <group position={[x, yPos, 0]}>
           <mesh castShadow><boxGeometry args={[drawerUnitWidth, uHeight, depth - 0.1]} /><meshStandardMaterial color={frameColor} roughness={0.5} /></mesh>
           {[...Array(drawerCount)].map((_, i) => (
              <group key={i} position={[0, uHeight/2 - 0.05 - (i * 0.15) - 0.075, (depth - 0.1)/2 + 0.01]}>
                 <mesh><boxGeometry args={[drawerUnitWidth - 0.04, 0.14, 0.01]} /><meshStandardMaterial color={faciaColor} /></mesh>
                 <mesh position={[0, 0.06, 0.01]}><boxGeometry args={[drawerUnitWidth - 0.04, 0.015, 0.005]} /><meshStandardMaterial color="#C0C0C0" metalness={0.8} /></mesh>
              </group>
           ))}
        </group>
     )
  }

  // Enhanced CabinetUnit - uses actual drawer configuration from embeddedCabinets if available
  // BTCD.850.560 integrated cabinet specs from Boscotek catalog:
  // Height: 810mm, Width: 560mm, Depth: 755mm, Usable height: 675mm
  const CabinetUnit = ({ x, placement }: { x: number, placement?: 'left' | 'right' }) => {
     const cabinetHeight = 0.81; // 810mm total height (per catalog)
     const cabinetDepth = depth - 0.1;
     
     // Shell thickness: 810mm - 675mm usable = 135mm total shell
     const totalShellThickness = 0.135;
     const bottomShellHeight = totalShellThickness * 0.6; // ~81mm plinth
     const topShellHeight = totalShellThickness * 0.4; // ~54mm top panel
     const usableHeightMm = 675; // 675mm usable drawer space (per catalog)
     
     // Check if we have embedded cabinet configuration for this position
     const embeddedConfig = placement && embeddedCabinets?.find((c: EmbeddedCabinet) => c.placement === placement);
     const hasCustomDrawers = embeddedConfig?.configuration?.customDrawers?.length > 0;
     
     // Cabinet sits on floor with levelling feet (like the catalog image)
     // Levelling feet height ~25mm
     const levellingFeetHeight = 0.025;
     const cabinetY = levellingFeetHeight + cabinetHeight/2;
     
     // If we have custom drawer configuration, render actual drawers
     if (hasCustomDrawers && HD_CABINET_PRODUCT) {
        // Use HD Cabinet product to get drawer heights (NOT the workbench product!)
        const drawerGroup = HD_CABINET_PRODUCT.groups?.find((g: any) => g.type === 'drawer_stack' || g.id === 'config');
        const customDrawers = embeddedConfig.configuration.customDrawers;
        
        // Calculate drawer heights - same logic as HdCabinetGroup
        const drawersWithHeights = customDrawers.map((d: DrawerConfiguration, idx: number) => {
           const opt = drawerGroup?.options?.find((o: any) => o.id === d.id);
           const heightMm = opt?.meta?.front || 100;
           return { ...d, heightMm, originalIndex: idx };
        }).sort((a: any, b: any) => b.heightMm - a.heightMm); // Sort largest first (bottom)
        
        // Build drawer stack positions - stack from bottom up
        const drawerStack: any[] = [];
        let currentOffsetMm = 0;
        
        drawersWithHeights.forEach((d: any) => {
           const heightMeters = d.heightMm / 1000;
           // Position: bottom shell + current offset + half drawer height (for center)
           const yPosition = bottomShellHeight + (currentOffsetMm / 1000) + (heightMeters / 2);
           drawerStack.push({
              ...d,
              height: heightMeters,
              y: yPosition
           });
           currentOffsetMm += d.heightMm;
        });
        
        const sideThickness = 0.02;
        const internalHeight = cabinetHeight - bottomShellHeight - topShellHeight;
        const internalCenterY = bottomShellHeight + internalHeight / 2 - cabinetHeight / 2;
        
        return (
           <group position={[x, cabinetY, 0]}>
              {/* Top Shell Panel */}
              <mesh position={[0, cabinetHeight/2 - topShellHeight/2, 0]} castShadow>
                 <boxGeometry args={[drawerUnitWidth, topShellHeight, cabinetDepth]} />
                 <meshStandardMaterial color={frameColor} roughness={0.5} />
              </mesh>
              
              {/* Bottom Shell / Plinth */}
              <mesh position={[0, -cabinetHeight/2 + bottomShellHeight/2, 0]} castShadow>
                 <boxGeometry args={[drawerUnitWidth, bottomShellHeight, cabinetDepth]} />
                 <meshStandardMaterial color={frameColor} roughness={0.5} />
              </mesh>
              
              {/* Back Panel */}
              <mesh position={[0, internalCenterY, -cabinetDepth/2 + sideThickness/2]}>
                 <boxGeometry args={[drawerUnitWidth, internalHeight, sideThickness]} />
                 <meshStandardMaterial color={frameColor} roughness={0.5} />
              </mesh>
              
              {/* Left Side Panel */}
              <mesh position={[-drawerUnitWidth/2 + sideThickness/2, internalCenterY, 0]}>
                 <boxGeometry args={[sideThickness, internalHeight, cabinetDepth]} />
                 <meshStandardMaterial color={frameColor} roughness={0.5} />
              </mesh>
              
              {/* Right Side Panel */}
              <mesh position={[drawerUnitWidth/2 - sideThickness/2, internalCenterY, 0]}>
                 <boxGeometry args={[sideThickness, internalHeight, cabinetDepth]} />
                 <meshStandardMaterial color={frameColor} roughness={0.5} />
              </mesh>
              
              {/* Custom Drawer Fronts - positioned relative to cabinet center */}
              {drawerStack.map((drawer, i) => (
                 <group key={i} position={[0, drawer.y - cabinetHeight/2, cabinetDepth/2 + 0.01]}>
                    <mesh castShadow>
                       <boxGeometry args={[drawerUnitWidth - sideThickness*2 - 0.005, drawer.height - 0.004, 0.02]} />
                       <meshStandardMaterial color={faciaColor} roughness={0.4} metalness={0.1} />
                    </mesh>
                    <mesh position={[0, drawer.height/2 - 0.015, 0.01]}>
                       <boxGeometry args={[drawerUnitWidth - sideThickness*2 - 0.01, 0.02, 0.015]} />
                       <meshStandardMaterial color="#e4e4e7" metalness={0.8} roughness={0.2} />
                    </mesh>
                 </group>
              ))}
           </group>
        );
     }
     
     // Default 5-drawer cabinet if no custom configuration
     return (
        <group position={[x, cabinetY, 0]}>
           <mesh castShadow><boxGeometry args={[drawerUnitWidth, cabinetHeight, cabinetDepth]} /><meshStandardMaterial color={frameColor} /></mesh>
           {[...Array(5)].map((_, i) => (
                <group key={i} position={[0, cabinetHeight/2 - 0.08 - (i * 0.14), cabinetDepth/2 + 0.01]}>
                   <mesh><boxGeometry args={[drawerUnitWidth - 0.04, 0.13, 0.01]} /><meshStandardMaterial color={faciaColor} /></mesh>
                   <mesh position={[0, 0.05, 0.01]}><boxGeometry args={[drawerUnitWidth - 0.04, 0.015, 0.005]} /><meshStandardMaterial color="#C0C0C0" metalness={0.8} /></mesh>
                </group>
             ))}
        </group>
     )
  }

  const CupboardUnit = ({ x }: any) => {
     const uHeight = 0.7; 
     return (
        <group position={[x, height - uHeight/2 - 0.05, 0]}>
           <mesh castShadow><boxGeometry args={[drawerUnitWidth, uHeight, depth - 0.1]} /><meshStandardMaterial color={frameColor} /></mesh>
           <group position={[0, 0, (depth - 0.1)/2 + 0.01]}>
              <mesh><boxGeometry args={[drawerUnitWidth - 0.04, uHeight - 0.04, 0.01]} /><meshStandardMaterial color={faciaColor} /></mesh>
              <mesh position={[-0.15, uHeight/2 - 0.06, 0.02]}><boxGeometry args={[0.12, 0.02, 0.03]} /><meshStandardMaterial color="#111" /></mesh>
           </group>
        </group>
     )
  }

  const renderUnder = () => {
    // ... Logic for under bench options ...
    // Reuse existing logic from previous block
    const flushLeft = -width/2 + WORKBENCH_LEG_SIZE + drawerUnitWidth/2;
    const flushRight = width/2 - WORKBENCH_LEG_SIZE - drawerUnitWidth/2;
    let singlePos = (position === 'left' || position === 'pos-left') ? flushLeft : flushRight;
    const singlePlacement: 'left' | 'right' = (position === 'left' || position === 'pos-left') ? 'left' : 'right';
    if (position === 'center' || position === 'pos-center') singlePos = 0;

    if (underBenchId.startsWith('B') && underBenchId !== 'B0') {
        const OneDrw = ({x}:any) => <DrawerUnit x={x} drawerCount={1} suspended />;
        const TwoDrw = ({x}:any) => <DrawerUnit x={x} drawerCount={2} suspended />;
        const ThreeDrw = ({x}:any) => <DrawerUnit x={x} drawerCount={3} suspended />;
        const Cab = ({x, placement}:{x:number, placement?:'left'|'right'}) => <CabinetUnit x={x} placement={placement} />;
        const Cup = ({x}:any) => <CupboardUnit x={x} />;
        const Shelf = () => <Undershelf />;

        switch(underBenchId) {
            case 'B1': return <OneDrw x={singlePos} />;
            case 'B2': return <TwoDrw x={singlePos} />;
            case 'B3': return <ThreeDrw x={singlePos} />;
            case 'B4': case 'B28': return <Cab x={singlePos} placement={singlePlacement} />;
            case 'B5': return <Cup x={singlePos} />;
            case 'B6': return <group><Cab x={flushLeft} placement="left" /><OneDrw x={flushRight} /></group>;
            case 'B7': return <group><Cup x={flushLeft} /><OneDrw x={flushRight} /></group>;
            case 'B12': return <group><ThreeDrw x={flushLeft} /><ThreeDrw x={flushRight} /></group>;
            case 'B13': return <group><Cab x={flushLeft} placement="left" /><Cup x={flushRight} /></group>;
            case 'B14': return <Shelf />;
            case 'B15': case 'B18': return <group><Shelf /><OneDrw x={singlePos} /></group>;
            case 'B16': return <group><Shelf /><TwoDrw x={singlePos} /></group>;
            case 'B17': return <group><Shelf /><ThreeDrw x={singlePos} /></group>;
            case 'B19': return <group><Shelf /><OneDrw x={flushLeft} /><TwoDrw x={flushRight} /></group>;
            case 'B20': return <group><Shelf /><OneDrw x={flushLeft} /><ThreeDrw x={flushRight} /></group>;
            case 'B21': case 'B22': return <group><Shelf /><Cab x={singlePos} placement={singlePlacement} /></group>;
            case 'B23': case 'B24': return <group><Shelf /><Cup x={singlePos} /></group>;
            case 'B25': return <group><Shelf /><Cab x={flushLeft} placement="left" /><Cup x={flushRight} /></group>;
            case 'B26': return <group><Shelf /><Cab x={flushLeft} placement="left" /><Cab x={flushRight} placement="right" /></group>;
            case 'B27': return <group><Shelf /><Cup x={flushLeft} /><Cup x={flushRight} /></group>;
            default: return null;
        }
    }
    
    // Industrial logic - uses embeddedCabinets for HD Cabinet configurations
    if (underBenchId.startsWith('iw-')) {
       const US = () => <Undershelf />;
       const HUS = () => <Undershelf w={width/2 - 0.05} x={-width/4} />; // Approximate Half Shelf on Left
       
       switch(underBenchId) {
          case 'iw-ub-shelf': return <US />;
          case 'iw-ub-half-shelf': return <HUS />;
          case 'iw-ub-drawer-1': return <DrawerUnit x={singlePos} drawerCount={1} suspended />;
          case 'iw-ub-door-1': return <CupboardUnit x={singlePos} />;
          case 'iw-ub-cabinet-1': return <CabinetUnit x={singlePos} placement={singlePlacement} />;
          
          case 'iw-ub-drawer-2': return <group><DrawerUnit x={flushLeft} drawerCount={1} suspended /><DrawerUnit x={flushRight} drawerCount={1} suspended /></group>;
          case 'iw-ub-door-2': return <group><CupboardUnit x={flushLeft} /><CupboardUnit x={flushRight} /></group>;
          case 'iw-ub-cabinet-2': return <group><CabinetUnit x={flushLeft} placement="left" /><CabinetUnit x={flushRight} placement="right" /></group>;
          
          case 'iw-ub-cabinet-door': return <group><CabinetUnit x={flushLeft} placement="left" /><CupboardUnit x={flushRight} /></group>;
          case 'iw-ub-cabinet-drawer': return <group><CabinetUnit x={flushLeft} placement="left" /><DrawerUnit x={flushRight} drawerCount={1} suspended /></group>;
          case 'iw-ub-door-drawer': return <group><CupboardUnit x={flushLeft} /><DrawerUnit x={flushRight} drawerCount={1} suspended /></group>;

          case 'iw-ub-shelf-drawer': return <group><US /><DrawerUnit x={singlePos} drawerCount={1} suspended /></group>;
          case 'iw-ub-drawers-2-shelf': return <group><US /><DrawerUnit x={flushLeft} drawerCount={1} suspended /><DrawerUnit x={flushRight} drawerCount={1} suspended /></group>;
          
          case 'iw-ub-drawer-half-shelf': return <group><HUS /><DrawerUnit x={flushRight} drawerCount={1} suspended /></group>;
          case 'iw-ub-shelf-cabinet': return <group><HUS /><CabinetUnit x={flushRight} placement="right" /></group>;
          case 'iw-ub-shelf-door': return <group><HUS /><CupboardUnit x={flushRight} /></group>;
          
          case 'iw-ub-half-shelf-drawer-cabinet': return <group><HUS /><DrawerUnit x={flushLeft} drawerCount={1} suspended /><CabinetUnit x={flushRight} placement="right" /></group>;
          case 'iw-ub-half-shelf-drawer-cupboard': return <group><HUS /><DrawerUnit x={flushLeft} drawerCount={1} suspended /><CupboardUnit x={flushRight} /></group>;
       }
    }
    return null;
  };

  const renderAbove = () => {
    if (!aboveBenchId || aboveBenchId === 'T0' || aboveBenchId === 'iw-ab-none') return null;
    
    const postH = 1.1; // Increased for clearer gap
    const postMat = <meshStandardMaterial color={frameColor} />;
    
    // Industrial Above Bench Logic
    if (isIndustrialAbove) {
       // Power Panel ONLY (no shelf) - just the rail at back of worktop, no posts
       const isPowerOnly = aboveBenchId === 'iw-ab-power' || aboveBenchId === 'P';
       
       if (isPowerOnly) {
          // Power panel rail only - sits at back of worktop without uprights
          // Position: on top of worktop (height + worktop thickness + half panel height)
          const panelHeight = 0.10;
          const worktopThickness = 0.04;
          return (
             <group position={[0, height + worktopThickness + panelHeight/2, -depth/2 + 0.03]}>
                <mesh><boxGeometry args={[width - 0.12, panelHeight, 0.04]} /><meshStandardMaterial color="#111" /></mesh>
                {[-0.3, -0.1, 0.1, 0.3].map((x, i) => <mesh key={i} position={[x, 0, 0.021]}><planeGeometry args={[0.08, 0.05]} /><meshBasicMaterial color="#f0f0f0" /></mesh>)}
             </group>
          );
       }
       
       // Shelf options (with or without power) - need uprights
       return (
          <group position={[0, height, 0]}>
             <mesh position={[-width/2 + 0.03, postH/2, -depth/2 + 0.03]} castShadow><boxGeometry args={[0.04, postH, 0.04]} />{postMat}</mesh>
             <mesh position={[width/2 - 0.03, postH/2, -depth/2 + 0.03]} castShadow><boxGeometry args={[0.04, postH, 0.04]} />{postMat}</mesh>
             <mesh position={[0, postH - 0.02, -depth/2 + 0.03]}><boxGeometry args={[width, 0.04, 0.04]} />{postMat}</mesh>
             
             <group position={[0, 0, -depth/2 + 0.15]}>
                {aboveBenchId.includes('shelf') && <mesh position={[0, postH, 0]}><boxGeometry args={[width - 0.1, 0.02, 0.25]} /><meshStandardMaterial color="#e4e4e7" /></mesh>}
                {hasPower && (
                   <group position={[0, 0.15, -0.12]}>
                      <mesh><boxGeometry args={[width - 0.12, 0.10, 0.04]} /><meshStandardMaterial color="#111" /></mesh>
                      {[-0.3, -0.1, 0.1, 0.3].map((x, i) => <mesh key={i} position={[x, 0, 0.021]}><planeGeometry args={[0.08, 0.05]} /><meshBasicMaterial color="#f0f0f0" /></mesh>)}
                   </group>
                )}
             </group>
          </group>
       );
    }

    // HEAVY DUTY T-SERIES (3-POST SYSTEM for T1-T8)
    const isTSeries = aboveBenchId.startsWith('T') && aboveBenchId !== 'T9' && aboveBenchId !== 'T10';
    
    // Special T9/T10 Logic
    if (aboveBenchId === 'T9' || aboveBenchId === 'T10') {
       const isInclined = aboveBenchId === 'T10';
       const angle = (isInclined && inclineAngle) ? (inclineAngle === 30 ? Math.PI/6 : inclineAngle === 15 ? Math.PI/12 : 0) : 0;
       return (
          <group position={[0, height, 0]}>
             <mesh position={[-width/2 + 0.1, postH/2, -depth/2 + 0.03]}><boxGeometry args={[0.04, postH, 0.04]} />{postMat}</mesh>
             <mesh position={[width/2 - 0.1, postH/2, -depth/2 + 0.03]}><boxGeometry args={[0.04, postH, 0.04]} />{postMat}</mesh>
             <group position={[0, postH * 0.8, -depth/2 + 0.15]} rotation={[angle, 0, 0]}>
                <mesh><boxGeometry args={[width - 0.2, 0.02, 0.25]} /><meshStandardMaterial color="#e4e4e7" /></mesh>
                {isInclined && <mesh position={[0, 0.03, 0.125]}><boxGeometry args={[width - 0.2, 0.04, 0.005]} /><meshStandardMaterial color="#e4e4e7" /></mesh>}
             </group>
          </group>
       )
    }

    // STANDARD T-SERIES CONFIGURATION (T1 - T8)
    // Structure: 3 Posts. Shelves are FULL WIDTH. Panels are SPLIT (L/R).
    // Layers: Top (Shelf), Upper Panel, Lower Panel.
    
    // UPDATED: bayWidth calculation to close gaps. width - 0.06 aligns panels to edges of posts roughly (20mm offset on each side for post half-width + margin)
    const bayWidth = (width - 0.06) / 2; // Width of one bay
    const shelfWidth = width - 0.1;
    
    // Y-Levels (from bottom of posts = benchtop)
    const yTop = 1.05;
    const yUpper = 0.85;
    // UPDATED: yLower raised to 0.55 so top of this panel (0.70) meets bottom of upper panel (0.70)
    const yLower = 0.55; 

    let shelves: number[] = [];
    let panels: { y: number, left: string, right: string }[] = [];

    switch(aboveBenchId) {
       case 'T1': shelves = [1.05, 0.7, 0.35]; break;
       case 'T2': shelves = [1.05, 0.8, 0.55, 0.3]; break;
       case 'T3': 
          shelves = [1.05, 0.75]; 
          panels = [{ y: yLower, left: 'peg', right: 'peg' }];
          break;
       case 'T4': 
          shelves = [1.05, 0.75]; 
          panels = [{ y: yLower, left: 'louvre', right: 'louvre' }];
          break;
       case 'T5':
          shelves = [1.05, 0.75];
          panels = [{ y: yLower, left: 'peg', right: 'louvre' }];
          break;
       case 'T6':
          shelves = [1.05];
          panels = [
             { y: yUpper, left: 'peg', right: 'peg' },
             { y: yLower, left: 'peg', right: 'peg' }
          ];
          break;
       case 'T7':
          shelves = [1.05];
          panels = [
             { y: yUpper, left: 'louvre', right: 'louvre' },
             { y: yLower, left: 'louvre', right: 'louvre' }
          ];
          break;
       case 'T8':
          shelves = [1.05];
          panels = [
             { y: yUpper, left: 'peg', right: 'peg' },
             { y: yLower, left: 'louvre', right: 'louvre' }
          ];
          break;
    }

    const renderPanel = (type: string, y: number, xOffset: number) => {
       if (type === 'peg') return <group position={[xOffset, y, 0]}><PegboardPanel width={bayWidth} height={0.3} color={frameColor} /></group>; 
       if (type === 'louvre') return <group position={[xOffset, y, 0]}><LouvrePanel width={bayWidth} height={0.3} color={frameColor} /></group>;
       return null;
    };

    return (
        <group position={[0, height, 0]}>
            {/* 3 POSTS */}
            <mesh position={[-width/2 + 0.03, postH/2, -depth/2 + 0.03]} castShadow><boxGeometry args={[0.04, postH, 0.04]} />{postMat}</mesh>
            <mesh position={[width/2 - 0.03, postH/2, -depth/2 + 0.03]} castShadow><boxGeometry args={[0.04, postH, 0.04]} />{postMat}</mesh>
            <mesh position={[0, postH/2, -depth/2 + 0.03]} castShadow><boxGeometry args={[0.04, postH, 0.04]} />{postMat}</mesh>
            
            {/* Top Crossbar */}
            <mesh position={[0, postH - 0.02, -depth/2 + 0.03]}><boxGeometry args={[width, 0.04, 0.04]} />{postMat}</mesh>

            {/* FULL WIDTH SHELVES */}
            {shelves.map((y, i) => (
               <group key={`s-${i}`} position={[0, y, -depth/2 + 0.15]}>
                  <ShelfTray width={shelfWidth} />
               </group>
            ))}

            {/* PANELS (In Bays) */}
            <group position={[0, 0, -depth/2 + 0.05]}>
               {panels.map((row, i) => (
                  <group key={`p-${i}`}>
                     {renderPanel(row.left, row.y, -width/4)}
                     {renderPanel(row.right, row.y, width/4)}
                  </group>
               ))}
            </group>
        </group>
    );
  };

  return (
    <group>
        {renderUnder()}
        {renderAbove()}
        {accSelection && accSelection['acc-monitor'] > 0 && <MonitorStand height={height} />}
        {kitSelection && <AccessoryKitOverlay kitType={kitSelection.includes('red') ? 'red' : kitSelection.includes('green') ? 'green' : 'none'} height={height} depth={depth} />}
    </group>
  );
};

// Helper component to capture the scene from inside the Canvas
const SceneCapture = ({ onCapture }: { onCapture: (captureFunc: () => string | null) => void }) => {
  const { gl, scene, camera } = useThree();
  
  useEffect(() => {
    const captureFunc = () => {
      try {
        // Render the scene first to ensure we capture current state
        gl.render(scene, camera);
        // Get the canvas data as a smaller thumbnail (for performance)
        const canvas = gl.domElement;
        
        // Create a smaller thumbnail canvas
        const thumbCanvas = document.createElement('canvas');
        const thumbSize = 200; // 200px thumbnail
        thumbCanvas.width = thumbSize;
        thumbCanvas.height = thumbSize;
        
        const ctx = thumbCanvas.getContext('2d');
        if (ctx) {
          // Calculate crop to make it square (center crop)
          const srcSize = Math.min(canvas.width, canvas.height);
          const srcX = (canvas.width - srcSize) / 2;
          const srcY = (canvas.height - srcSize) / 2;
          
          ctx.drawImage(canvas, srcX, srcY, srcSize, srcSize, 0, 0, thumbSize, thumbSize);
          return thumbCanvas.toDataURL('image/jpeg', 0.8);
        }
        return null;
      } catch (e) {
        console.error('Failed to capture thumbnail:', e);
        return null;
      }
    };
    
    onCapture(captureFunc);
  }, [gl, scene, camera, onCapture]);
  
  return null;
};

export const Viewer3D = forwardRef<Viewer3DRef, Viewer3DProps>(({ config, product, activeDrawerIndex }, ref) => {
    const [bgMode, setBgMode] = useState<BackgroundMode>('photo');
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [antiTiltDemoIndex, setAntiTiltDemoIndex] = useState<number | null>(null); // Cycles through drawers one at a time
    const [cupboardDoorsOpen, setCupboardDoorsOpen] = useState(false); // Toggle for cupboard doors
    const controlsRef = useRef<any>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const captureRef = useRef<(() => string | null) | null>(null);
    
    // Expose the capture function via ref
    useImperativeHandle(ref, () => ({
      captureThumbnail: () => {
        if (captureRef.current) {
          return captureRef.current();
        }
        return null;
      }
    }), []);

    // Space-bar pan mode
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Don't intercept space if user is typing in an input field
        const target = e.target as HTMLElement;
        const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        
        if (e.code === 'Space' && !e.repeat && !isTyping) {
          e.preventDefault();
          setIsSpacePressed(true);
          
          if (controlsRef.current) {
            // Disable rotation when space is held
            controlsRef.current.enableRotate = false;
            controlsRef.current.enablePan = true;
          }
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        // Don't intercept space if user is typing in an input field
        const target = e.target as HTMLElement;
        const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        
        if (e.code === 'Space' && !isTyping) {
          e.preventDefault();
          setIsSpacePressed(false);
          
          if (controlsRef.current) {
            // Re-enable rotation when space is released
            controlsRef.current.enableRotate = true;
          }
        }
      };

      // Prevent space-bar from scrolling page when over canvas
      const handleKeyPress = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        
        if (e.code === 'Space' && !isTyping && canvasContainerRef.current?.contains(document.activeElement)) {
          e.preventDefault();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('keypress', handleKeyPress);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('keypress', handleKeyPress);
      };
    }, []);

    const widthOption = product.groups.find(g => g.id === 'width' || g.id === 'size')?.options.find(o => o.id === config.selections['width'] || o.id === config.selections['size']);
    const width = widthOption?.meta?.width || (widthOption?.value as number) / 1000 || 1.8;
    const depthOption = product.groups.find(g => g.id === 'series')?.options.find(o => o.id === config.selections['series']);
    const depth = depthOption?.meta?.depth || 0.75;
    const heightOption = product.groups.find(g => g.id === 'height' || g.id === 'bench_height')?.options.find(o => o.id === config.selections['height'] || o.id === config.selections['bench_height']);
    const height = heightOption?.meta?.height || (heightOption?.value as number) / 1000 || 0.9;
    
    const castors = config.selections['mobility'] === true;
    const worktopId = config.selections['worktop'];
    
    // Determine which color group ID is used by this product
    const frameColorGroupId = product.groups.find(g => g.id === 'color' || g.id === 'housing_color' || g.id === 'body_color')?.id || 'color';
    const faciaColorGroupId = product.groups.find(g => g.id === 'drawer_facia' || g.id === 'facia_color' || g.id === 'door_color')?.id || 'drawer_facia';
    
    const frameColorId = config.selections[frameColorGroupId];
    const frameColor = getMaterialColor(frameColorId, 'frame', product, frameColorGroupId);
    const faciaColorId = config.selections[faciaColorGroupId];
    const faciaColor = getMaterialColor(faciaColorId, 'facia', product, faciaColorGroupId);

    const underBenchId = config.selections['under_bench'];
    const aboveBenchId = config.selections['above_bench'];
    const position = config.selections['under_bench_pos'];
    const inclineAngle = config.selections['shelf_incline'];
    const kitSelection = config.selections['hanging_kits'];
    const accSelection = config.selections['individual_accessories'];

    const targetY = height / 2;
    const isIndustrial = product.id === 'prod-workbench-industrial';

    return (
       <div ref={canvasContainerRef} className="w-full h-full bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 shadow-inner relative group">
         <Canvas shadows camera={{ position: [2.5, 2.0, 2.5], fov: 42 }} gl={{ preserveDrawingBuffer: true }}>
           <SceneCapture onCapture={(func) => { captureRef.current = func; }} />
           {bgMode === 'photo' ? <Environment preset="warehouse" background blur={0.6} /> : <Environment preset="city" />}
           {bgMode === 'dark' && <color attach="background" args={['#18181b']} />}
           {bgMode === 'light' && <color attach="background" args={['#e4e4e7']} />}
           <ambientLight intensity={bgMode === 'photo' ? 1.0 : 0.8} />
           <directionalLight position={[5, 8, 5]} intensity={bgMode === 'photo' ? 2.0 : 1.5} castShadow shadow-bias={-0.0001} />
           <directionalLight position={[-3, 4, -2]} intensity={0.6} />
           {bgMode !== 'photo' && <Grid position={[0, -0.01, 0]} args={[10.5, 10.5]} cellSize={0.5} cellThickness={0.5} cellColor={bgMode === 'light' ? '#a1a1aa' : '#3f3f46'} sectionSize={1} sectionThickness={1} sectionColor={bgMode === 'light' ? '#71717a' : '#52525b'} fadeDistance={5} fadeStrength={1} infiniteGrid />}
           <group position={[0, 0, 0]}>
              {product.id === 'prod-hd-cabinet' ? (
                 <HdCabinetGroup config={config} width={width} height={height} depth={depth} frameColor={frameColor} faciaColor={faciaColor} product={product} activeDrawerIndex={activeDrawerIndex} antiTiltDemoIndex={antiTiltDemoIndex} />
              ) : product.id === 'prod-mobile-tool-cart' ? (
                 <MobileToolCartGroup config={config} product={product} frameColor={frameColor} faciaColor={faciaColor} />
              ) : product.id === 'prod-storage-cupboard' ? (
                 <StorageCupboardGroup config={config} product={product} bodyColor={frameColor} doorColor={faciaColor} doorsOpen={cupboardDoorsOpen} />
              ) : (
                 <Center bottom>
                    <group>
                       <WorkbenchFrame width={width} height={height} depth={depth} castors={castors} colorHex={frameColor} variant={isIndustrial ? 'industrial' : 'heavy'} />
                       {worktopId && <WorkbenchWorktop width={width} depth={depth} height={height} materialId={worktopId} />}
                       <WorkbenchAccessories width={width} depth={depth} height={height} underBenchId={underBenchId} aboveBenchId={aboveBenchId} frameColor={frameColor} faciaColor={faciaColor} position={position} inclineAngle={inclineAngle} kitSelection={kitSelection} accSelection={accSelection} embeddedCabinets={config.embeddedCabinets} product={product} activeDrawerIndex={activeDrawerIndex} />
                    </group>
                 </Center>
              )}
           </group>
           <ContactShadows position={[0, -0.001, 0]} opacity={0.4} scale={10} blur={2.5} far={4} />
           <OrbitControls ref={controlsRef} makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.9} target={[0, targetY, 0]} />
         </Canvas>
         <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded border border-zinc-700 text-xs text-zinc-300 font-mono pointer-events-none select-none z-10"><span className="text-amber-500 font-bold">LIVE PREVIEW</span> <span className="mx-2">|</span> {product.name}</div>
         <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex bg-black/50 backdrop-blur-md rounded border border-zinc-700 p-1 gap-1 z-10 shadow-lg">
            <button onClick={() => setBgMode('dark')} className={`px-3 py-1 text-xs font-medium rounded transition-colors ${bgMode === 'dark' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>Dark</button>
            <button onClick={() => setBgMode('light')} className={`px-3 py-1 text-xs font-medium rounded transition-colors ${bgMode === 'light' ? 'bg-zinc-200 text-black' : 'text-zinc-400 hover:text-white'}`}>Light</button>
            <button onClick={() => setBgMode('photo')} className={`px-3 py-1 text-xs font-medium rounded transition-colors ${bgMode === 'photo' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>Photo</button>
            <div className="w-px bg-zinc-600 mx-1"></div>
            <button onClick={() => controlsRef.current?.reset()} className="px-3 py-1 text-xs font-medium rounded transition-colors text-zinc-300 hover:text-white hover:bg-zinc-700" title="Reset Camera View">Recenter</button>
            {product.id === 'prod-hd-cabinet' && config.customDrawers && config.customDrawers.length > 0 && (
              <>
                <div className="w-px bg-zinc-600 mx-1"></div>
                <button 
                  onClick={() => {
                    // Cycle through drawers one at a time (anti-tilt demo)
                    const drawerCount = config.customDrawers.length;
                    if (antiTiltDemoIndex === null) {
                      setAntiTiltDemoIndex(0); // Start with first drawer
                    } else if (antiTiltDemoIndex >= drawerCount - 1) {
                      setAntiTiltDemoIndex(null); // Reset after last drawer
                    } else {
                      setAntiTiltDemoIndex(antiTiltDemoIndex + 1); // Next drawer
                    }
                  }} 
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${antiTiltDemoIndex !== null ? 'bg-amber-500 text-black' : 'text-zinc-300 hover:text-white hover:bg-zinc-700'}`} 
                  title="Anti-Tilt Mechanism Demo - Only one drawer can extend at a time"
                >
                  {antiTiltDemoIndex !== null 
                    ? `🔒 Drawer ${antiTiltDemoIndex + 1}/${config.customDrawers.length}` 
                    : '🔐 Anti-Tilt Demo'}
                </button>
              </>
            )}
            {product.id === 'prod-storage-cupboard' && (
              <>
                <div className="w-px bg-zinc-600 mx-1"></div>
                <button 
                  onClick={() => setCupboardDoorsOpen(!cupboardDoorsOpen)} 
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${cupboardDoorsOpen ? 'bg-blue-500 text-white' : 'text-zinc-300 hover:text-white hover:bg-zinc-700'}`} 
                  title="Toggle doors open/closed to view shelf configuration"
                >
                  {cupboardDoorsOpen ? '🚪 Close Doors' : '🚪 Open Doors'}
                </button>
              </>
            )}
         </div>
         <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end pointer-events-none select-none">
            <div className="text-[10px] text-zinc-500 bg-black/20 p-2 rounded backdrop-blur-sm">
              LMB: Rotate • RMB: Pan • Scroll: Zoom
              {isSpacePressed && <span className="ml-2 text-amber-400">• SPACE: Pan Mode Active</span>}
            </div>
            <div className="text-[10px] text-amber-500/80 bg-black/40 p-2 rounded backdrop-blur-sm border border-amber-900/30 max-w-xs text-right">
               ⚠️ Renderings are approximations only.<br/>Refer to catalog for accurate details.
            </div>
         </div>
         
         {/* Scene Controls Overlay */}
         <SceneControlsOverlay controlsRef={controlsRef} />
       </div>
    );
});
