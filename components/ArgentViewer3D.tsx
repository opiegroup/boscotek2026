/**
 * ArgentViewer3D
 * 
 * 3D viewer component for Argent server racks and data infrastructure products.
 * Renders realistic server rack enclosures based on the Argent product line.
 * 
 * Supported Series:
 * - 10 Series: Lite Server Cabinets
 * - 25 Series: Network/Server Racks
 * - 40 Series: Open Frame Racks
 * - 50 Series: Security Class B/C Racks
 * - V50 Data Vault: In-rack security enclosures
 */

import React, { useRef, useMemo, Suspense, useState, useEffect, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { ConfigurationState, ProductDefinition } from '../types';
import { getArgentSeriesInfo } from '../services/products/argentCatalog';
import SceneControlsOverlay from './SceneControlsOverlay';

// ============================================================================
// CONSTANTS
// ============================================================================

// Standard 19" rack dimensions
const RU_HEIGHT_MM = 44.45; // 1 Rack Unit = 44.45mm
const RACK_19_INCH_MM = 482.6; // Standard 19" mounting width

// Colors - Mannex Black is the standard Argent finish
const COLORS = {
  MANNEX_BLACK: '#1a1a1a',
  FRAME_DARK: '#0d0d0d',
  STEEL_GREY: '#4a4a4a',
  PERFORATED_HOLES: '#0a0a0a',
  RAIL_SILVER: '#8a8a8a',
  LOCK_CHROME: '#c0c0c0',
  LED_GREEN: '#00ff00',
  LED_BLUE: '#0066ff',
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

/**
 * Perforated Panel - Creates a panel with perforated appearance
 * Uses a simple visual approach for performance (no complex geometry holes)
 */
const PerforatedPanel = ({ 
  width, 
  height, 
  depth = 0.002, 
  color = COLORS.MANNEX_BLACK,
}: {
  width: number;
  height: number;
  depth?: number;
  color?: string;
}) => {
  // Create a simple perforated appearance using opacity and a darker color
  // This is much faster than creating thousands of geometry holes
  return (
    <group>
      {/* Main panel with semi-transparency to simulate perforation */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial 
          color={color} 
          roughness={0.7} 
          metalness={0.3}
          transparent
          opacity={0.85}
        />
      </mesh>
      {/* Grid overlay to suggest perforation pattern */}
      <mesh position={[0, 0, depth/2 + 0.0001]}>
        <planeGeometry args={[width * 0.9, height * 0.9]} />
        <meshBasicMaterial 
          color="#0a0a0a" 
          transparent 
          opacity={0.3}
        />
      </mesh>
      {/* Frame border */}
      <mesh position={[0, height/2 - 0.01, depth/2 + 0.0002]}>
        <boxGeometry args={[width, 0.02, 0.001]} />
        <meshStandardMaterial color={COLORS.FRAME_DARK} roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0, -height/2 + 0.01, depth/2 + 0.0002]}>
        <boxGeometry args={[width, 0.02, 0.001]} />
        <meshStandardMaterial color={COLORS.FRAME_DARK} roughness={0.5} metalness={0.4} />
      </mesh>
    </group>
  );
};

/**
 * Solid Panel - Simple solid steel panel
 */
const SolidPanel = ({ 
  width, 
  height, 
  depth = 0.002, 
  color = COLORS.MANNEX_BLACK 
}: {
  width: number;
  height: number;
  depth?: number;
  color?: string;
}) => (
  <mesh castShadow receiveShadow>
    <boxGeometry args={[width, height, depth]} />
    <meshStandardMaterial color={color} roughness={0.6} metalness={0.4} />
  </mesh>
);

/**
 * 19" Mounting Rail with RU markings
 */
const MountingRail = ({ 
  height, 
  ruCount, 
  position 
}: { 
  height: number; 
  ruCount: number; 
  position: [number, number, number];
}) => {
  const railWidth = 0.025;
  const railDepth = 0.015;
  const ruHeight = RU_HEIGHT_MM / 1000; // Convert to meters
  
  return (
    <group position={position}>
      {/* Main rail */}
      <mesh castShadow>
        <boxGeometry args={[railWidth, height - 0.02, railDepth]} />
        <meshStandardMaterial color={COLORS.RAIL_SILVER} roughness={0.4} metalness={0.7} />
      </mesh>
      
      {/* RU hole markers */}
      {[...Array(ruCount)].map((_, i) => {
        const y = height/2 - 0.05 - (i * ruHeight) - ruHeight/2;
        return (
          <group key={i} position={[0, y, railDepth/2 + 0.001]}>
            {/* Cage nut holes (3 per RU) */}
            {[-0.008, 0, 0.008].map((offset, j) => (
              <mesh key={j} position={[0, offset * ruHeight/0.044, 0]}>
                <circleGeometry args={[0.003, 8]} />
                <meshStandardMaterial color="#333" />
              </mesh>
            ))}
            {/* RU number (every 5 RUs) */}
            {i % 5 === 0 && i > 0 && (
              <mesh position={[railWidth/2 + 0.008, 0, 0]}>
                <planeGeometry args={[0.012, 0.008]} />
                <meshBasicMaterial color="#666" />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
};

/**
 * Door Handle/Lock Assembly
 */
const DoorLock = ({ 
  position, 
  isClassC = false 
}: { 
  position: [number, number, number];
  isClassC?: boolean;
}) => (
  <group position={position}>
    {/* Lock body */}
    <mesh castShadow>
      <cylinderGeometry args={[0.015, 0.015, 0.02, 16]} />
      <meshStandardMaterial 
        color={isClassC ? '#1a1a1a' : COLORS.LOCK_CHROME} 
        roughness={0.3} 
        metalness={0.8} 
      />
    </mesh>
    {/* Keyhole */}
    <mesh position={[0, 0, 0.011]} rotation={[Math.PI/2, 0, 0]}>
      <cylinderGeometry args={[0.003, 0.003, 0.005, 8]} />
      <meshStandardMaterial color="#0a0a0a" />
    </mesh>
    {/* Handle bar */}
    <mesh position={[0, -0.04, 0]} castShadow>
      <boxGeometry args={[0.008, 0.06, 0.008]} />
      <meshStandardMaterial color={COLORS.LOCK_CHROME} roughness={0.3} metalness={0.8} />
    </mesh>
  </group>
);

/**
 * Levelling Foot
 */
const LevellingFoot = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    {/* Foot base */}
    <mesh position={[0, 0.005, 0]} receiveShadow>
      <cylinderGeometry args={[0.025, 0.03, 0.01, 16]} />
      <meshStandardMaterial color="#333" roughness={0.8} />
    </mesh>
    {/* Adjustment bolt */}
    <mesh position={[0, 0.025, 0]}>
      <cylinderGeometry args={[0.008, 0.008, 0.04, 8]} />
      <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.5} metalness={0.5} />
    </mesh>
  </group>
);

/**
 * Castor Wheel
 */
const Castor = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    {/* Mounting plate */}
    <mesh position={[0, 0.04, 0]}>
      <boxGeometry args={[0.05, 0.005, 0.05]} />
      <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.6} metalness={0.4} />
    </mesh>
    {/* Fork */}
    <mesh position={[0, 0.02, 0]}>
      <boxGeometry args={[0.04, 0.04, 0.008]} />
      <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.6} metalness={0.4} />
    </mesh>
    {/* Wheel */}
    <mesh position={[0, 0.015, 0]} rotation={[0, 0, Math.PI/2]}>
      <cylinderGeometry args={[0.03, 0.03, 0.02, 16]} />
      <meshStandardMaterial color="#222" roughness={0.9} />
    </mesh>
  </group>
);

// ============================================================================
// SERVER RACK COMPONENTS
// ============================================================================

/**
 * 10 Series Lite Server Cabinet
 * 
 * Based on Argent 10 Series specifications:
 * - 42RU height (1973mm)
 * - 600mm or 800mm width
 * - 800mm or 1000mm depth
 * - Perforated steel door
 * - Solid side panels (lockable)
 * - 19" mounting rails
 * - Mannex black powder coat
 */
const Series10Rack = ({ 
  config, 
  product,
  doorsOpen = false
}: { 
  config: ConfigurationState; 
  product: ProductDefinition;
  doorsOpen?: boolean;
}) => {
  // Extract dimensions from configuration
  const ruHeightMatch = String(config.selections['ru-height'] || 'ru-42').match(/ru-(\d+)/);
  const ruHeight = ruHeightMatch ? parseInt(ruHeightMatch[1]) : 42;
  
  const widthMatch = String(config.selections['width'] || 'width-600').match(/width-(\d+)/);
  const widthMm = widthMatch ? parseInt(widthMatch[1]) : 600;
  
  const depthMatch = String(config.selections['depth'] || 'depth-800').match(/depth-(\d+)/);
  const depthMm = depthMatch ? parseInt(depthMatch[1]) : 800;
  
  // Convert to meters
  const height = (ruHeight * RU_HEIGHT_MM + 100) / 1000; // Add 100mm for top/bottom frame
  const width = widthMm / 1000;
  const depth = depthMm / 1000;
  
  const frameThickness = 0.04;
  const panelThickness = 0.002;
  
  // Door type
  const doorType = config.selections['front-door'] || 'door-perf-steel';
  const isPerforated = doorType === 'door-perf-steel' || doorType?.includes?.('perf');
  
  // Hinge side (left or right hand)
  const hingeSide = config.selections['hinge-side'] || 'hinge-left';
  const isLeftHinge = hingeSide === 'hinge-left';
  
  // Door dimensions
  const doorWidth = width - frameThickness * 2 - 0.01;
  const doorHeight = height - frameThickness * 2 - 0.01;
  
  // Has castors?
  const accessories = config.selections['accessories'] as Record<string, number> || {};
  const hasCastors = (accessories['acc-castors'] || 0) > 0;
  const hasVentedTopPanel = (accessories['acc-top-vented'] || 0) > 0;
  
  const baseHeight = hasCastors ? 0.06 : 0.04;
  
  return (
    <group position={[0, height/2 + baseHeight, 0]}>
      {/* Main Cabinet Frame - Corner posts */}
      {[
        [-width/2 + frameThickness/2, 0, -depth/2 + frameThickness/2],
        [width/2 - frameThickness/2, 0, -depth/2 + frameThickness/2],
        [-width/2 + frameThickness/2, 0, depth/2 - frameThickness/2],
        [width/2 - frameThickness/2, 0, depth/2 - frameThickness/2],
      ].map((pos, i) => (
        <mesh key={`post-${i}`} position={pos as [number, number, number]} castShadow>
          <boxGeometry args={[frameThickness, height, frameThickness]} />
          <meshStandardMaterial color={COLORS.MANNEX_BLACK} roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
      
      {/* Top Frame */}
      <group position={[0, height/2 - frameThickness/2, 0]}>
        {/* Front/Back rails */}
        {[-depth/2 + frameThickness/2, depth/2 - frameThickness/2].map((z, i) => (
          <mesh key={`top-fb-${i}`} position={[0, 0, z]} castShadow>
            <boxGeometry args={[width - frameThickness*2, frameThickness, frameThickness]} />
            <meshStandardMaterial color={COLORS.MANNEX_BLACK} roughness={0.6} metalness={0.3} />
          </mesh>
        ))}
        {/* Left/Right rails */}
        {[-width/2 + frameThickness/2, width/2 - frameThickness/2].map((x, i) => (
          <mesh key={`top-lr-${i}`} position={[x, 0, 0]} castShadow>
            <boxGeometry args={[frameThickness, frameThickness, depth - frameThickness*2]} />
            <meshStandardMaterial color={COLORS.MANNEX_BLACK} roughness={0.6} metalness={0.3} />
          </mesh>
        ))}
        {/* Top Panel */}
        <group position={[0, frameThickness/2 + 0.001, 0]}>
          {hasVentedTopPanel ? (
            <group rotation={[-Math.PI / 2, 0, 0]}>
              <PerforatedPanel 
                width={width - frameThickness*2 - 0.01}
                height={depth - frameThickness*2 - 0.01}
                depth={0.002}
              />
            </group>
          ) : (
            <mesh>
              <boxGeometry args={[width - frameThickness*2 - 0.01, 0.002, depth - frameThickness*2 - 0.01]} />
              <meshStandardMaterial color={COLORS.MANNEX_BLACK} roughness={0.7} metalness={0.2} />
            </mesh>
          )}
        </group>
      </group>
      
      {/* Bottom Frame */}
      <group position={[0, -height/2 + frameThickness/2, 0]}>
        {/* Front/Back rails */}
        {[-depth/2 + frameThickness/2, depth/2 - frameThickness/2].map((z, i) => (
          <mesh key={`bot-fb-${i}`} position={[0, 0, z]} castShadow>
            <boxGeometry args={[width - frameThickness*2, frameThickness, frameThickness]} />
            <meshStandardMaterial color={COLORS.MANNEX_BLACK} roughness={0.6} metalness={0.3} />
          </mesh>
        ))}
        {/* Left/Right rails */}
        {[-width/2 + frameThickness/2, width/2 - frameThickness/2].map((x, i) => (
          <mesh key={`bot-lr-${i}`} position={[x, 0, 0]} castShadow>
            <boxGeometry args={[frameThickness, frameThickness, depth - frameThickness*2]} />
            <meshStandardMaterial color={COLORS.MANNEX_BLACK} roughness={0.6} metalness={0.3} />
          </mesh>
        ))}
      </group>
      
      {/* Front Door - Perforated or Solid */}
      {/* Door pivots at hinge edge, swings outward from front face */}
      <group 
        position={[
          isLeftHinge ? (-width/2 + frameThickness) : (width/2 - frameThickness), 
          0, 
          depth/2 - frameThickness/2
        ]}
      >
        <group rotation={[0, doorsOpen ? (isLeftHinge ? -Math.PI/2 : Math.PI/2) : 0, 0]}>
          <group position={[isLeftHinge ? doorWidth/2 : -doorWidth/2, 0, 0]}>
            {isPerforated ? (
              <PerforatedPanel 
                width={doorWidth} 
                height={doorHeight}
                depth={panelThickness}
              />
            ) : (
              <SolidPanel 
                width={doorWidth} 
                height={doorHeight}
                depth={panelThickness}
              />
            )}
            {/* Door Lock - on opposite side of hinge */}
            <DoorLock position={[isLeftHinge ? (doorWidth/2 - 0.05) : (-doorWidth/2 + 0.05), 0, panelThickness/2 + 0.01]} />
          </group>
        </group>
      </group>
      
      {/* Rear Door - Usually perforated for airflow */}
      {/* Rear door hinge is on opposite side from front door */}
      <group 
        position={[
          isLeftHinge ? (width/2 - frameThickness) : (-width/2 + frameThickness), 
          0, 
          -depth/2 + frameThickness/2
        ]}
      >
        <group rotation={[0, doorsOpen ? (isLeftHinge ? Math.PI/2 : -Math.PI/2) : 0, 0]}>
          <group position={[isLeftHinge ? -doorWidth/2 : doorWidth/2, 0, 0]}>
            <PerforatedPanel 
              width={doorWidth} 
              height={doorHeight}
              depth={panelThickness}
            />
          </group>
        </group>
      </group>
      
      {/* Side Panels - Solid Steel */}
      {[-1, 1].map((side, i) => (
        <group key={`side-${i}`} position={[side * (width/2 - 0.001), 0, 0]} rotation={[0, Math.PI/2, 0]}>
          <SolidPanel 
            width={depth - frameThickness * 2 - 0.01} 
            height={height - frameThickness * 2 - 0.01}
            depth={panelThickness}
          />
        </group>
      ))}
      
      {/* 19" Mounting Rails - Front */}
      <MountingRail 
        height={height - frameThickness * 2} 
        ruCount={ruHeight}
        position={[-RACK_19_INCH_MM/2000 - 0.01, 0, depth/2 - 0.08]}
      />
      <MountingRail 
        height={height - frameThickness * 2} 
        ruCount={ruHeight}
        position={[RACK_19_INCH_MM/2000 + 0.01, 0, depth/2 - 0.08]}
      />
      
      {/* 19" Mounting Rails - Rear */}
      <MountingRail 
        height={height - frameThickness * 2} 
        ruCount={ruHeight}
        position={[-RACK_19_INCH_MM/2000 - 0.01, 0, -depth/2 + 0.08]}
      />
      <MountingRail 
        height={height - frameThickness * 2} 
        ruCount={ruHeight}
        position={[RACK_19_INCH_MM/2000 + 0.01, 0, -depth/2 + 0.08]}
      />
      
      {/* Levelling Feet or Castors */}
      {hasCastors ? (
        <>
          <Castor position={[-width/2 + 0.06, -height/2 - 0.04, -depth/2 + 0.06]} />
          <Castor position={[width/2 - 0.06, -height/2 - 0.04, -depth/2 + 0.06]} />
          <Castor position={[-width/2 + 0.06, -height/2 - 0.04, depth/2 - 0.06]} />
          <Castor position={[width/2 - 0.06, -height/2 - 0.04, depth/2 - 0.06]} />
        </>
      ) : (
        <>
          <LevellingFoot position={[-width/2 + 0.05, -height/2 - 0.01, -depth/2 + 0.05]} />
          <LevellingFoot position={[width/2 - 0.05, -height/2 - 0.01, -depth/2 + 0.05]} />
          <LevellingFoot position={[-width/2 + 0.05, -height/2 - 0.01, depth/2 - 0.05]} />
          <LevellingFoot position={[width/2 - 0.05, -height/2 - 0.01, depth/2 - 0.05]} />
        </>
      )}
      
      {/* Argent Logo on front (subtle) */}
      <mesh position={[0, height/2 - 0.06, depth/2 + 0.003]}>
        <planeGeometry args={[0.08, 0.015]} />
        <meshBasicMaterial color="#333" transparent opacity={0.8} />
      </mesh>
    </group>
  );
};

/**
 * 25 Series Network/Server Rack
 * Similar to 10 Series but with more configuration options
 */
const Series25Rack = ({ config, product, doorsOpen = false }: { config: ConfigurationState; product: ProductDefinition; doorsOpen?: boolean }) => {
  // For now, use the same base as 10 Series with minor differences
  return <Series10Rack config={config} product={product} doorsOpen={doorsOpen} />;
};

/**
 * 40 Series Open Frame Rack
 * Open design with posts only, no panels
 */
const Series40Rack = ({ config, product, doorsOpen = false }: { config: ConfigurationState; product: ProductDefinition; doorsOpen?: boolean }) => {
  // Note: Open frame racks typically don't have doors - doorsOpen prop included for interface consistency
  const ruHeightMatch = String(config.selections['ru-height'] || 'ru-42').match(/ru-(\d+)/);
  const ruHeight = ruHeightMatch ? parseInt(ruHeightMatch[1]) : 42;
  
  const widthMatch = String(config.selections['width'] || 'width-600').match(/width-(\d+)/);
  const widthMm = widthMatch ? parseInt(widthMatch[1]) : 600;
  
  const depthMatch = String(config.selections['depth'] || 'depth-800').match(/depth-(\d+)/);
  const depthMm = depthMatch ? parseInt(depthMatch[1]) : 800;
  
  const postType = config.selections['post-type'] || 'post-4';
  const is2Post = postType === 'post-2' || postType?.includes?.('2');
  
  const height = (ruHeight * RU_HEIGHT_MM + 100) / 1000;
  const width = widthMm / 1000;
  const depth = is2Post ? 0.1 : depthMm / 1000;
  
  const postSize = 0.05;
  
  return (
    <group position={[0, height/2 + 0.04, 0]}>
      {/* Posts */}
      {is2Post ? (
        // 2-Post configuration
        <>
          <mesh position={[-RACK_19_INCH_MM/2000 - postSize/2, 0, 0]} castShadow>
            <boxGeometry args={[postSize, height, postSize]} />
            <meshStandardMaterial color={COLORS.MANNEX_BLACK} roughness={0.6} metalness={0.3} />
          </mesh>
          <mesh position={[RACK_19_INCH_MM/2000 + postSize/2, 0, 0]} castShadow>
            <boxGeometry args={[postSize, height, postSize]} />
            <meshStandardMaterial color={COLORS.MANNEX_BLACK} roughness={0.6} metalness={0.3} />
          </mesh>
          {/* Mounting Rails */}
          <MountingRail height={height - 0.05} ruCount={ruHeight} position={[-RACK_19_INCH_MM/2000, 0, postSize/2 + 0.01]} />
          <MountingRail height={height - 0.05} ruCount={ruHeight} position={[RACK_19_INCH_MM/2000, 0, postSize/2 + 0.01]} />
        </>
      ) : (
        // 4-Post configuration
        <>
          {[
            [-width/2 + postSize/2, 0, -depth/2 + postSize/2],
            [width/2 - postSize/2, 0, -depth/2 + postSize/2],
            [-width/2 + postSize/2, 0, depth/2 - postSize/2],
            [width/2 - postSize/2, 0, depth/2 - postSize/2],
          ].map((pos, i) => (
            <mesh key={`post-${i}`} position={pos as [number, number, number]} castShadow>
              <boxGeometry args={[postSize, height, postSize]} />
              <meshStandardMaterial color={COLORS.MANNEX_BLACK} roughness={0.6} metalness={0.3} />
            </mesh>
          ))}
          {/* Cross braces */}
          {[-height/2 + 0.05, height/2 - 0.05].map((y, i) => (
            <group key={`brace-${i}`} position={[0, y, 0]}>
              <mesh position={[0, 0, -depth/2 + postSize/2]}>
                <boxGeometry args={[width - postSize * 2, 0.03, 0.03]} />
                <meshStandardMaterial color={COLORS.MANNEX_BLACK} roughness={0.6} metalness={0.3} />
              </mesh>
              <mesh position={[0, 0, depth/2 - postSize/2]}>
                <boxGeometry args={[width - postSize * 2, 0.03, 0.03]} />
                <meshStandardMaterial color={COLORS.MANNEX_BLACK} roughness={0.6} metalness={0.3} />
              </mesh>
            </group>
          ))}
          {/* Mounting Rails - Front */}
          <MountingRail height={height - 0.05} ruCount={ruHeight} position={[-RACK_19_INCH_MM/2000 - 0.01, 0, depth/2 - 0.08]} />
          <MountingRail height={height - 0.05} ruCount={ruHeight} position={[RACK_19_INCH_MM/2000 + 0.01, 0, depth/2 - 0.08]} />
          {/* Mounting Rails - Rear */}
          <MountingRail height={height - 0.05} ruCount={ruHeight} position={[-RACK_19_INCH_MM/2000 - 0.01, 0, -depth/2 + 0.08]} />
          <MountingRail height={height - 0.05} ruCount={ruHeight} position={[RACK_19_INCH_MM/2000 + 0.01, 0, -depth/2 + 0.08]} />
        </>
      )}
      
      {/* Levelling Feet */}
      {is2Post ? (
        <>
          <LevellingFoot position={[-RACK_19_INCH_MM/2000 - postSize/2, -height/2 - 0.01, 0]} />
          <LevellingFoot position={[RACK_19_INCH_MM/2000 + postSize/2, -height/2 - 0.01, 0]} />
        </>
      ) : (
        <>
          <LevellingFoot position={[-width/2 + 0.05, -height/2 - 0.01, -depth/2 + 0.05]} />
          <LevellingFoot position={[width/2 - 0.05, -height/2 - 0.01, -depth/2 + 0.05]} />
          <LevellingFoot position={[-width/2 + 0.05, -height/2 - 0.01, depth/2 - 0.05]} />
          <LevellingFoot position={[width/2 - 0.05, -height/2 - 0.01, depth/2 - 0.05]} />
        </>
      )}
    </group>
  );
};

/**
 * 50 Series Security Rack
 * Enhanced security features, heavier construction
 */
const Series50Rack = ({ config, product, doorsOpen = false }: { config: ConfigurationState; product: ProductDefinition; doorsOpen?: boolean }) => {
  const securityClass = config.selections['security-class'];
  const isClassC = securityClass === 'security-class-c';
  
  // Use 10 Series base with security enhancements
  return (
    <group>
      <Series10Rack config={config} product={product} doorsOpen={doorsOpen} />
      {/* Security badge */}
      <mesh position={[0, 1.0, 0.35]}>
        <planeGeometry args={[0.1, 0.03]} />
        <meshBasicMaterial color={isClassC ? '#dc2626' : '#f59e0b'} />
      </mesh>
    </group>
  );
};

/**
 * V50 Data Vault - In-rack security enclosure
 */
const V50DataVault = ({ config, product, doorsOpen = false }: { config: ConfigurationState; product: ProductDefinition; doorsOpen?: boolean }) => {
  const ruHeightMatch = String(config.selections['ru-height'] || 'ru-4').match(/ru-(\d+)/);
  const ruHeight = ruHeightMatch ? parseInt(ruHeightMatch[1]) : 4;
  
  const height = (ruHeight * RU_HEIGHT_MM) / 1000;
  const width = RACK_19_INCH_MM / 1000; // Standard 19" width
  const depth = 0.4; // 400mm depth
  
  return (
    <group position={[0, height/2 + 0.02, 0]}>
      {/* Main enclosure body */}
      <mesh castShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={COLORS.MANNEX_BLACK} roughness={0.6} metalness={0.3} />
      </mesh>
      
      {/* Front door - perforated - hinged on left, swings outward */}
      <group position={[-width/2 + 0.01, 0, depth/2]}>
        <group rotation={[0, doorsOpen ? -Math.PI/2 : 0, 0]}>
          <group position={[(width - 0.02) / 2, 0, 0]}>
            <PerforatedPanel 
              width={width - 0.02} 
              height={height - 0.02}
              depth={0.002}
            />
            <DoorLock position={[(width - 0.02) / 2 - 0.03, 0, 0.01]} />
          </group>
        </group>
      </group>
      
      {/* Mounting flanges */}
      {[-1, 1].map((side, i) => (
        <mesh key={`flange-${i}`} position={[side * (width/2 + 0.01), 0, 0]} castShadow>
          <boxGeometry args={[0.02, height, 0.03]} />
          <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
};

// ============================================================================
// MAIN SCENE
// ============================================================================

interface ArgentSceneProps {
  config: ConfigurationState;
  product: ProductDefinition;
  bgMode: 'dark' | 'light' | 'photo';
  controlsRef: React.MutableRefObject<any>;
  doorsOpen: boolean;
}

const ArgentScene: React.FC<ArgentSceneProps> = ({ config, product, bgMode, controlsRef, doorsOpen }) => {
  const seriesInfo = getArgentSeriesInfo(product.id);
  
  // Determine which rack component to render based on series
  const RackComponent = useMemo(() => {
    if (!seriesInfo) return Series10Rack;
    
    switch (seriesInfo.key) {
      case '10':
        return Series10Rack;
      case '25':
        return Series25Rack;
      case '40':
        return Series40Rack;
      case '50':
        return Series50Rack;
      case 'v50':
        return V50DataVault;
      default:
        return Series10Rack;
    }
  }, [seriesInfo]);
  
  // Calculate camera target based on rack size
  const ruHeightMatch = String(config.selections['ru-height'] || 'ru-42').match(/ru-(\d+)/);
  const ruHeight = ruHeightMatch ? parseInt(ruHeightMatch[1]) : 42;
  const rackHeight = (ruHeight * RU_HEIGHT_MM + 100) / 1000;
  
  return (
    <>
      {/* Environment matching Boscotek */}
      {bgMode === 'photo' ? <Environment preset="warehouse" background blur={0.6} /> : <Environment preset="city" />}
      {bgMode === 'dark' && <color attach="background" args={['#18181b']} />}
      {bgMode === 'light' && <color attach="background" args={['#e4e4e7']} />}
      
      {/* Lighting matching Boscotek */}
      <ambientLight intensity={bgMode === 'photo' ? 1.0 : 0.8} />
      <directionalLight position={[5, 8, 5]} intensity={bgMode === 'photo' ? 2.0 : 1.5} castShadow shadow-bias={-0.0001} />
      <directionalLight position={[-3, 4, -2]} intensity={0.6} />
      
      {/* Grid matching Boscotek */}
      {bgMode !== 'photo' && (
        <Grid 
          position={[0, -0.01, 0]} 
          args={[10.5, 10.5]} 
          cellSize={0.5} 
          cellThickness={0.5} 
          cellColor={bgMode === 'light' ? '#a1a1aa' : '#3f3f46'} 
          sectionSize={1} 
          sectionThickness={1} 
          sectionColor={bgMode === 'light' ? '#71717a' : '#52525b'} 
          fadeDistance={5} 
          fadeStrength={1} 
          infiniteGrid 
        />
      )}
      
      <Suspense fallback={null}>
        <RackComponent config={config} product={product} doorsOpen={doorsOpen} />
      </Suspense>
      
      <ContactShadows 
        position={[0, -0.001, 0]} 
        opacity={0.4} 
        scale={10} 
        blur={2.5} 
        far={4} 
      />
      
      <OrbitControls
        ref={controlsRef}
        makeDefault
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 1.9}
        target={[0, rackHeight / 2, 0]}
      />
    </>
  );
};

// ============================================================================
// SCENE CAPTURE HELPER
// ============================================================================

const SceneCapture: React.FC<{ onCapture: (fn: () => string | null) => void }> = ({ onCapture }) => {
  const { gl } = useThree();
  useEffect(() => {
    onCapture(() => {
      try {
        return gl.domElement.toDataURL('image/png');
      } catch (e) {
        console.error('Screenshot failed:', e);
        return null;
      }
    });
  }, [gl, onCapture]);
  return null;
};

// ============================================================================
// MAIN EXPORT
// ============================================================================

export interface ArgentViewer3DProps {
  product: ProductDefinition;
  config: ConfigurationState;
}

export interface ArgentViewer3DRef {
  captureThumbnail: () => string | null;
}

const ArgentViewer3D = React.forwardRef<ArgentViewer3DRef, ArgentViewer3DProps>(
  ({ product, config }, ref) => {
    const controlsRef = useRef<any>(null);
    const captureRef = useRef<(() => string | null) | null>(null);
    const [bgMode, setBgMode] = useState<'dark' | 'light' | 'photo'>('dark');
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [doorsOpen, setDoorsOpen] = useState(false);
    
    // Space key for pan mode (matching Boscotek)
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space' && !isSpacePressed) {
          setIsSpacePressed(true);
        }
      };
      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          setIsSpacePressed(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }, [isSpacePressed]);
    
    React.useImperativeHandle(ref, () => ({
      captureThumbnail: () => {
        if (captureRef.current) {
          return captureRef.current();
        }
        return null;
      }
    }));
    
    const seriesInfo = getArgentSeriesInfo(product.id);
    
    return (
      <div className="w-full h-full relative">
        {/* Background Mode Toggle - matching Boscotek */}
        <div className="absolute top-4 left-4 z-20 flex gap-1 bg-zinc-900/80 backdrop-blur-sm p-1 rounded-lg border border-zinc-700">
          {(['dark', 'light', 'photo'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setBgMode(mode)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                bgMode === mode 
                  ? 'bg-amber-500 text-black' 
                  : 'text-zinc-300 hover:text-white hover:bg-zinc-700'
              }`}
            >
              {mode === 'dark' ? '🌙' : mode === 'light' ? '☀️' : '📷'}
            </button>
          ))}
          <div className="w-px bg-zinc-600 mx-1"></div>
          <button 
            onClick={() => controlsRef.current?.reset()} 
            className="px-3 py-1 text-xs font-medium rounded transition-colors text-zinc-300 hover:text-white hover:bg-zinc-700" 
            title="Reset Camera View"
          >
            Recenter
          </button>
          <div className="w-px bg-zinc-600 mx-1"></div>
          <button 
            onClick={() => setDoorsOpen(!doorsOpen)} 
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              doorsOpen 
                ? 'bg-blue-500 text-white' 
                : 'text-zinc-300 hover:text-white hover:bg-zinc-700'
            }`}
            title="Toggle doors open/closed"
          >
            {doorsOpen ? '🚪 Close Doors' : '🚪 Open Doors'}
          </button>
        </div>
        
        {/* Series Badge */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 bg-blue-900/80 backdrop-blur-sm rounded-lg border border-blue-700">
          <span className="text-xs font-medium text-blue-200">
            {seriesInfo?.name || 'Argent Server Rack'}
          </span>
        </div>
        
        {/* Canvas */}
        <Canvas
          shadows
          camera={{ position: [2.5, 2.0, 2.5], fov: 42 }}
          gl={{ preserveDrawingBuffer: true }}
        >
          <SceneCapture onCapture={(func) => { captureRef.current = func; }} />
          <ArgentScene 
            config={config} 
            product={product} 
            bgMode={bgMode}
            controlsRef={controlsRef}
            doorsOpen={doorsOpen}
          />
        </Canvas>
        
        {/* Bottom Info - matching Boscotek */}
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end pointer-events-none select-none">
          <div className="text-[10px] text-zinc-500 bg-black/20 p-2 rounded backdrop-blur-sm">
            LMB: Rotate • RMB: Pan • Scroll: Zoom
            {isSpacePressed && <span className="ml-2 text-amber-400">• SPACE: Pan Mode Active</span>}
          </div>
          <div className="text-[10px] text-amber-500/80 bg-black/40 p-2 rounded backdrop-blur-sm border border-amber-900/30 max-w-xs text-right">
            ⚠️ Renderings are approximations only.<br/>Refer to catalog for accurate details.
          </div>
        </div>
        
        {/* Scene Controls Overlay - matching Boscotek */}
        <SceneControlsOverlay controlsRef={controlsRef} />
      </div>
    );
  }
);

ArgentViewer3D.displayName = 'ArgentViewer3D';

export default ArgentViewer3D;
