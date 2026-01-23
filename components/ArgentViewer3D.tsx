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
const DOOR_NOTCH_OFFSET_Y = 0.005;

const resolveSelectedColour = (
  product: ProductDefinition,
  selections: Record<string, any>,
  groupId: string,
  fallback: string
): string => {
  const group = product.groups.find(g => g.id === groupId);
  const selected = selections[groupId];
  const opt = group?.options.find(o => o.id === selected);
  const hex = (opt?.meta?.hex || opt?.value) as string | undefined;
  return typeof hex === 'string' ? hex : fallback;
};

const DoorNotch = ({
  position,
  color,
}: {
  position: [number, number, number];
  color: string;
  doorHeight?: number;
}) => {
  const notchHeight = 0.12; // Shorter notch
  const notchWidth = 0.05;
  const cornerRadius = 0.006; // Small corner radius
  
  return (
    <group position={position}>
      {/* Main notch panel - rectangular with slight corner rounding */}
      <mesh position={[0, 0, -0.002]}>
        <boxGeometry args={[notchWidth, notchHeight, 0.004]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.4} />
      </mesh>
      
      {/* Rounded corners - small cylinders at corners */}
      {[
        [-notchWidth/2 + cornerRadius, notchHeight/2 - cornerRadius],
        [notchWidth/2 - cornerRadius, notchHeight/2 - cornerRadius],
        [-notchWidth/2 + cornerRadius, -notchHeight/2 + cornerRadius],
        [notchWidth/2 - cornerRadius, -notchHeight/2 + cornerRadius],
      ].map(([x, y], i) => (
        <mesh key={`corner-${i}`} position={[x, y, 0]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[cornerRadius, cornerRadius, 0.003, 8]} />
          <meshStandardMaterial color={color} roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      
      {/* Lock housing */}
      <mesh position={[0, 0.01, 0.003]}>
        <boxGeometry args={[0.032, 0.05, 0.005]} />
        <meshStandardMaterial color={COLORS.FRAME_DARK} roughness={0.6} metalness={0.3} />
      </mesh>
      
      {/* Lock cylinder */}
      <mesh position={[0, 0.025, 0.006]} rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.007, 0.007, 0.004, 12]} />
        <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.3} metalness={0.7} />
      </mesh>
      
      {/* Handle bar */}
      <mesh position={[0, -0.01, 0.007]}>
        <boxGeometry args={[0.022, 0.022, 0.006]} />
        <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  );
};

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
  // Create perforated panel with see-through holes
  const holeSpacing = 0.02; // 20mm spacing for denser pattern
  const holeRadius = 0.005; // 5mm holes - bigger for more see-through
  const cols = Math.floor((width * 0.88) / holeSpacing);
  const rows = Math.floor((height * 0.88) / holeSpacing);
  
  return (
    <group>
      {/* Main panel - semi-transparent to allow light through holes */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial 
          color={color}
          roughness={0.7} 
          metalness={0.3}
          transparent
          opacity={0.7}
        />
      </mesh>
      
      {/* Perforation holes - transparent circles you can see through */}
      {Array.from({ length: Math.min(rows, 50) }).map((_, row) => 
        Array.from({ length: Math.min(cols, 25) }).map((_, col) => {
          const x = -width * 0.44 + col * holeSpacing + (row % 2) * (holeSpacing / 2);
          const y = -height * 0.44 + row * holeSpacing;
          if (Math.abs(x) > width * 0.46 || Math.abs(y) > height * 0.46) return null;
          return (
            <mesh 
              key={`hole-${row}-${col}`} 
              position={[x, y, depth/2 + 0.0001]}
            >
              <circleGeometry args={[holeRadius, 8]} />
              <meshStandardMaterial 
                color="#000000" 
                transparent 
                opacity={0.15}
                depthWrite={false}
              />
            </mesh>
          );
        })
      )}
      
      {/* Frame borders - solid */}
      <mesh position={[0, height/2 - 0.012, depth/2 + 0.0003]}>
        <boxGeometry args={[width, 0.024, 0.001]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0, -height/2 + 0.012, depth/2 + 0.0003]}>
        <boxGeometry args={[width, 0.024, 0.001]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[-width/2 + 0.012, 0, depth/2 + 0.0003]}>
        <boxGeometry args={[0.024, height - 0.048, 0.001]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[width/2 - 0.012, 0, depth/2 + 0.0003]}>
        <boxGeometry args={[0.024, height - 0.048, 0.001]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.4} />
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
 * Door Panel - exterior uses door colour, interior uses frame colour
 */
const DoorPanel = ({
  width,
  height,
  depth,
  variant,
  frontColor,
}: {
  width: number;
  height: number;
  depth: number;
  variant: 'perforated' | 'solid' | 'polycarbonate';
  frontColor: string;
}) => (
  <group>
    {variant === 'polycarbonate' ? (
      <group>
        {/* Frame ring (punched-through center) */}
        {(() => {
          const border = Math.min(width, height) * 0.06;
          const innerW = width - border * 2;
          const innerH = height - border * 2;
          const frameDepth = depth;
          return (
            <>
              {/* Top */}
              <mesh position={[0, innerH / 2 + border / 2, 0]}>
                <boxGeometry args={[width, border, frameDepth]} />
                <meshStandardMaterial color={frontColor} roughness={0.6} metalness={0.4} />
              </mesh>
              {/* Bottom */}
              <mesh position={[0, -(innerH / 2 + border / 2), 0]}>
                <boxGeometry args={[width, border, frameDepth]} />
                <meshStandardMaterial color={frontColor} roughness={0.6} metalness={0.4} />
              </mesh>
              {/* Left */}
              <mesh position={[-(innerW / 2 + border / 2), 0, 0]}>
                <boxGeometry args={[border, innerH, frameDepth]} />
                <meshStandardMaterial color={frontColor} roughness={0.6} metalness={0.4} />
              </mesh>
              {/* Right */}
              <mesh position={[(innerW / 2 + border / 2), 0, 0]}>
                <boxGeometry args={[border, innerH, frameDepth]} />
                <meshStandardMaterial color={frontColor} roughness={0.6} metalness={0.4} />
              </mesh>
              {/* Clear window - front and back */}
              <mesh position={[0, 0, depth / 2 + 0.0005]}>
                <planeGeometry args={[innerW, innerH]} />
                <meshPhysicalMaterial
                  color="#ffffff"
                  transparent
            opacity={0.5}
            roughness={0.02}
            metalness={0.0}
            transmission={1.0}
                  thickness={0.02}
                  clearcoat={0.8}
                  clearcoatRoughness={0.03}
                  side={THREE.DoubleSide}
                />
              </mesh>
              <mesh position={[0, 0, -depth / 2 - 0.0005]}>
                <planeGeometry args={[innerW, innerH]} />
                <meshPhysicalMaterial
                  color="#ffffff"
                  transparent
                  opacity={0.5}
                  roughness={0.02}
                  metalness={0.0}
                  transmission={0.9}
                  thickness={0.02}
                  clearcoat={0.8}
                  clearcoatRoughness={0.03}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </>
          );
        })()}
      </group>
    ) : variant === 'perforated' ? (
      <PerforatedPanel width={width} height={height} depth={depth} color={frontColor} />
    ) : (
      <SolidPanel width={width} height={height} depth={depth} color={frontColor} />
    )}
  </group>
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
 * Door Handle/Lock Assembly - supports different lock types
 * lockType: 'standard' | 'combination' | 'digital'
 */
const DoorLock = ({ 
  position, 
  lockType = 'standard',
  isClassC = false 
}: { 
  position: [number, number, number];
  lockType?: 'standard' | 'combination' | 'digital';
  isClassC?: boolean;
}) => {
  const lockColor = '#1a1a1a'; // Dark black like reference
  
  if (lockType === 'combination') {
    // Combination Lock - 4 tumbler style, same height as standard (0.09)
    return (
      <group position={position}>
        {/* Main lock body - same height as standard */}
        <mesh castShadow>
          <boxGeometry args={[0.024, 0.09, 0.012]} />
          <meshStandardMaterial color={lockColor} roughness={0.5} metalness={0.3} />
        </mesh>
        {/* Handle recess area at top */}
        <mesh position={[0, 0.03, 0.007]}>
          <boxGeometry args={[0.018, 0.02, 0.002]} />
          <meshStandardMaterial color="#0d0d0d" roughness={0.7} metalness={0.2} />
        </mesh>
        {/* 4 Tumbler dials - compact vertical arrangement */}
        {[0, 1, 2, 3].map((i) => (
          <group key={`tumbler-${i}`} position={[0, 0.01 - i * 0.014, 0.007]}>
            {/* Tumbler outer housing */}
            <mesh>
              <boxGeometry args={[0.016, 0.011, 0.004]} />
              <meshStandardMaterial color="#0a0a0a" roughness={0.9} metalness={0.1} />
            </mesh>
            {/* Number wheel */}
            <mesh position={[0, 0, 0.003]}>
              <boxGeometry args={[0.012, 0.008, 0.002]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.3} />
            </mesh>
            {/* Number indicator line */}
            <mesh position={[0, 0, 0.005]}>
              <boxGeometry args={[0.01, 0.001, 0.001]} />
              <meshStandardMaterial color="#888888" />
            </mesh>
          </group>
        ))}
        {/* Keyhole at bottom */}
        <mesh position={[0, -0.035, 0.007]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.007, 0.007, 0.004, 16]} />
          <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.3} metalness={0.7} />
        </mesh>
        <mesh position={[0, -0.035, 0.01]}>
          <boxGeometry args={[0.002, 0.006, 0.001]} />
          <meshStandardMaterial color="#000000" />
        </mesh>
      </group>
    );
  }
  
  if (lockType === 'digital') {
    // Digital Keypad Lock - 10 button (2x5), same height as standard (0.09)
    return (
      <group position={position}>
        {/* Main lock body - same height as standard */}
        <mesh castShadow>
          <boxGeometry args={[0.026, 0.09, 0.012]} />
          <meshStandardMaterial color={lockColor} roughness={0.5} metalness={0.3} />
        </mesh>
        {/* RFID/Card icon at top */}
        <mesh position={[0, 0.035, 0.007]}>
          <boxGeometry args={[0.01, 0.01, 0.002]} />
          <meshStandardMaterial color="#0d0d0d" roughness={0.8} metalness={0.1} />
        </mesh>
        {/* 10 Keypad buttons - 2 columns x 5 rows - compact */}
        {[0, 1].map((col) =>
          [0, 1, 2, 3, 4].map((row) => (
            <mesh key={`key-${col}-${row}`} position={[-0.005 + col * 0.01, 0.015 - row * 0.012, 0.007]}>
              <boxGeometry args={[0.008, 0.009, 0.003]} />
              <meshStandardMaterial color="#e0e0e0" roughness={0.4} metalness={0.4} />
            </mesh>
          ))
        )}
        {/* LED indicators */}
        <mesh position={[-0.004, -0.035, 0.007]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.002, 0.002, 0.002, 8]} />
          <meshStandardMaterial color={COLORS.LED_GREEN} emissive={COLORS.LED_GREEN} emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[0.004, -0.035, 0.007]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.002, 0.002, 0.002, 8]} />
          <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.1} />
        </mesh>
      </group>
    );
  }
  
  // Standard Keyed Lock - slim rectangular handle like reference image
  return (
    <group position={position}>
      {/* Main lock body - tall slim rectangle */}
      <mesh castShadow>
        <boxGeometry args={[0.022, 0.09, 0.012]} />
        <meshStandardMaterial color={lockColor} roughness={0.5} metalness={0.4} />
      </mesh>
      {/* Slight bevel/indent at top */}
      <mesh position={[0, 0.035, 0.007]}>
        <boxGeometry args={[0.018, 0.015, 0.002]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Keyhole area */}
      <mesh position={[0, -0.015, 0.007]}>
        <boxGeometry args={[0.012, 0.025, 0.002]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.8} metalness={0.1} />
      </mesh>
      {/* Keyhole cylinder */}
      <mesh position={[0, -0.015, 0.009]} rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.004, 12]} />
        <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Key slot */}
      <mesh position={[0, -0.015, 0.012]}>
        <boxGeometry args={[0.002, 0.008, 0.001]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
    </group>
  );
};

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
// ACCESSORY COMPONENTS
// ============================================================================

/**
 * Blanking Top Panel - Solid flat panel for rack enclosure
 */
const BlankingTopPanel = ({ 
  width, 
  depth, 
  frameThickness,
  color = COLORS.MANNEX_BLACK 
}: { 
  width: number; 
  depth: number; 
  frameThickness: number;
  color?: string;
}) => (
  <mesh>
    <boxGeometry args={[width - frameThickness*2 - 0.01, 0.003, depth - frameThickness*2 - 0.01]} />
    <meshStandardMaterial color={color} roughness={0.7} metalness={0.2} />
  </mesh>
);

/**
 * Brush Entry Top Panel - Panel with brush cable entry opening
 */
const BrushEntryTopPanel = ({ 
  width, 
  depth, 
  frameThickness,
  color = COLORS.MANNEX_BLACK 
}: { 
  width: number; 
  depth: number; 
  frameThickness: number;
  color?: string;
}) => {
  const panelWidth = width - frameThickness*2 - 0.01;
  const panelDepth = depth - frameThickness*2 - 0.01;
  const brushWidth = panelWidth * 0.6;
  const brushDepth = 0.08;
  
  return (
    <group>
      {/* Front section */}
      <mesh position={[0, 0, panelDepth/2 - 0.06]}>
        <boxGeometry args={[panelWidth, 0.003, 0.12]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Rear section */}
      <mesh position={[0, 0, -panelDepth/2 + 0.06]}>
        <boxGeometry args={[panelWidth, 0.003, 0.12]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Left section */}
      <mesh position={[-panelWidth/2 + (panelWidth - brushWidth)/4, 0, 0]}>
        <boxGeometry args={[(panelWidth - brushWidth)/2, 0.003, panelDepth - 0.24]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Right section */}
      <mesh position={[panelWidth/2 - (panelWidth - brushWidth)/4, 0, 0]}>
        <boxGeometry args={[(panelWidth - brushWidth)/2, 0.003, panelDepth - 0.24]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Brush strip frame */}
      <mesh position={[0, -0.002, 0]}>
        <boxGeometry args={[brushWidth + 0.02, 0.008, brushDepth + 0.02]} />
        <meshStandardMaterial color={COLORS.FRAME_DARK} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Brush bristles (simplified as dark block) */}
      <mesh position={[0, -0.008, 0]}>
        <boxGeometry args={[brushWidth, 0.012, brushDepth]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.95} metalness={0.0} />
      </mesh>
    </group>
  );
};

/**
 * Fan Tray - Active cooling with 2 or 4 fans
 * Mounts on top of rack, fans lay flat facing upward
 */
const FanTray = ({ 
  width, 
  fanCount = 2,
  color = COLORS.MANNEX_BLACK 
}: { 
  width: number; 
  fanCount?: 2 | 4;
  color?: string;
}) => {
  const trayWidth = width * 0.9;
  const trayThickness = 0.025;
  const trayDepth = 0.18; // Compact depth for roof mount
  const fanRadius = 0.035; // ~70mm fans
  const fanSpacing = trayWidth / (fanCount + 1);
  
  return (
    <group>
      {/* Main tray base - flat horizontal */}
      <mesh>
        <boxGeometry args={[trayWidth, trayThickness, trayDepth]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.2} />
      </mesh>
      
      {/* Mounting flanges (front and back) */}
      {[-trayDepth/2 - 0.008, trayDepth/2 + 0.008].map((z, i) => (
        <mesh key={`flange-${i}`} position={[0, -trayThickness/2, z]}>
          <boxGeometry args={[trayWidth, 0.02, 0.015]} />
          <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
      
      {/* Fan assemblies - laying flat on top */}
      {Array.from({ length: fanCount }).map((_, i) => {
        const xPos = -trayWidth/2 + fanSpacing * (i + 1);
        return (
          <group key={`fan-${i}`} position={[xPos, trayThickness/2 + 0.001, 0]}>
            {/* Fan opening (dark recessed circle) */}
            <mesh position={[0, 0, 0]}>
              <cylinderGeometry args={[fanRadius, fanRadius, 0.003, 32]} />
              <meshStandardMaterial color="#080808" roughness={0.95} metalness={0.05} />
            </mesh>
            
            {/* Outer guard ring */}
            <mesh position={[0, 0.002, 0]}>
              <torusGeometry args={[fanRadius, 0.003, 8, 32]} />
              <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.4} metalness={0.5} />
            </mesh>
            
            {/* Fan grille - concentric rings laying flat */}
            {[0.7, 0.45, 0.2].map((scale, j) => (
              <mesh key={`ring-${j}`} position={[0, 0.003, 0]}>
                <torusGeometry args={[fanRadius * scale, 0.002, 6, 32]} />
                <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.4} metalness={0.5} />
              </mesh>
            ))}
            
            {/* Cross bars on grille - flat */}
            {[0, Math.PI/2, Math.PI/4, -Math.PI/4].map((rot, j) => (
              <mesh key={`bar-${j}`} position={[0, 0.004, 0]} rotation={[0, rot, 0]}>
                <boxGeometry args={[fanRadius * 2, 0.002, 0.003]} />
                <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.4} metalness={0.5} />
              </mesh>
            ))}
            
            {/* Center hub */}
            <mesh position={[0, 0.005, 0]}>
              <cylinderGeometry args={[0.01, 0.01, 0.008, 16]} />
              <meshStandardMaterial color={COLORS.FRAME_DARK} roughness={0.5} metalness={0.4} />
            </mesh>
          </group>
        );
      })}
      
      {/* LED indicator */}
      <mesh position={[trayWidth/2 - 0.02, trayThickness/2 + 0.002, trayDepth/2 - 0.02]}>
        <cylinderGeometry args={[0.004, 0.004, 0.003, 8]} />
        <meshStandardMaterial color={COLORS.LED_GREEN} emissive={COLORS.LED_GREEN} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
};

/**
 * Finger Manager - Horizontal cable organizer (1RU)
 */
const FingerManager = ({
  width,
  ruHeight,
  color = COLORS.MANNEX_BLACK
}: {
  width: number;
  ruHeight: number;
  color?: string;
}) => {
  const managerWidth = width - 0.02; // Slightly narrower than rack
  const managerHeight = RU_HEIGHT_MM / 1000; // 1RU
  const fingerCount = Math.floor(managerWidth / 0.025);
  const fingerWidth = 0.008;
  const fingerDepth = 0.03;
  
  return (
    <group>
      {/* Main frame */}
      <mesh>
        <boxGeometry args={[managerWidth, managerHeight, 0.04]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Mounting ears */}
      {[-managerWidth/2 - 0.015, managerWidth/2 + 0.015].map((x, i) => (
        <mesh key={`ear-${i}`} position={[x, 0, 0.015]}>
          <boxGeometry args={[0.03, managerHeight, 0.01]} />
          <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
      {/* Finger channels (simplified as repeated tabs) */}
      {Array.from({ length: fingerCount }).map((_, i) => {
        const xPos = -managerWidth/2 + 0.02 + i * (managerWidth - 0.04) / (fingerCount - 1);
        return (
          <mesh key={`finger-${i}`} position={[xPos, 0, 0.02 + fingerDepth/2]}>
            <boxGeometry args={[fingerWidth, managerHeight * 0.7, fingerDepth]} />
            <meshStandardMaterial color={COLORS.FRAME_DARK} roughness={0.8} metalness={0.1} />
          </mesh>
        );
      })}
    </group>
  );
};

/**
 * Vertical Cable Manager - Full height cable duct with perforated front
 * Like the 40 Series reference images - tall ducts with slotted fronts
 */
const VerticalCableManager = ({
  position = [0, 0, 0] as [number, number, number],
  height,
  width = 0.15, // 150mm, 300mm, or 400mm
  managerWidth, // Legacy prop alias
  depth = 0.25, // 250mm or 450mm
  rotation = [0, 0, 0] as [number, number, number],
  color = COLORS.MANNEX_BLACK
}: {
  position?: [number, number, number];
  height: number;
  width?: number;
  managerWidth?: number; // Legacy support
  depth?: number;
  rotation?: [number, number, number];
  color?: string;
}) => {
  const actualWidth = managerWidth || width;
  const wallThickness = 0.003;
  const slotHeight = 0.06;
  const slotGap = 0.015;
  const slotCount = Math.floor((height - 0.1) / (slotHeight + slotGap));
  
  return (
    <group position={position} rotation={rotation}>
      {/* Back wall - solid */}
      <mesh position={[0, 0, -depth/2 + wallThickness/2]}>
        <boxGeometry args={[actualWidth, height, wallThickness]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Left wall - solid */}
      <mesh position={[-actualWidth/2 + wallThickness/2, 0, 0]}>
        <boxGeometry args={[wallThickness, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Right wall - solid */}
      <mesh position={[actualWidth/2 - wallThickness/2, 0, 0]}>
        <boxGeometry args={[wallThickness, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Front panel frame */}
      <mesh position={[0, height/2 - 0.015, depth/2 - wallThickness/2]}>
        <boxGeometry args={[actualWidth, 0.03, wallThickness]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, -height/2 + 0.015, depth/2 - wallThickness/2]}>
        <boxGeometry args={[actualWidth, 0.03, wallThickness]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Front perforated/slotted sections */}
      {Array.from({ length: slotCount }).map((_, i) => {
        const yPos = -height/2 + 0.05 + i * (slotHeight + slotGap) + slotHeight/2;
        return (
          <group key={`slot-section-${i}`} position={[0, yPos, depth/2 - wallThickness/2]}>
            {/* Horizontal bars between slots */}
            <mesh position={[0, slotHeight/2 + slotGap/2, 0]}>
              <boxGeometry args={[actualWidth - 0.01, slotGap, wallThickness]} />
              <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
            </mesh>
            {/* Vertical dividers creating slot pattern */}
            {Array.from({ length: Math.floor(actualWidth / 0.03) }).map((_, j) => (
              <mesh key={`divider-${i}-${j}`} position={[-actualWidth/2 + 0.015 + j * 0.03, 0, 0]}>
                <boxGeometry args={[0.004, slotHeight, wallThickness]} />
                <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
              </mesh>
            ))}
          </group>
        );
      })}
      {/* Top cap */}
      <mesh position={[0, height/2 + 0.01, 0]}>
        <boxGeometry args={[actualWidth, 0.02, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Bottom base */}
      <mesh position={[0, -height/2 - 0.01, 0]}>
        <boxGeometry args={[actualWidth, 0.02, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
    </group>
  );
};

/**
 * Cable Shield Assembly MK2 - Horizontal cable tray/shield
 */
const CableShieldAssembly = ({
  position,
  width,
  depth,
  color = COLORS.MANNEX_BLACK
}: {
  position: [number, number, number];
  width: number;
  depth: number;
  color?: string;
}) => {
  const trayHeight = 0.1;
  const wallThickness = 0.003;
  
  return (
    <group position={position}>
      {/* Bottom panel */}
      <mesh position={[0, -trayHeight/2, 0]}>
        <boxGeometry args={[width, wallThickness, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-width/2 + wallThickness/2, 0, 0]}>
        <boxGeometry args={[wallThickness, trayHeight, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Right wall */}
      <mesh position={[width/2 - wallThickness/2, 0, 0]}>
        <boxGeometry args={[wallThickness, trayHeight, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Front lip */}
      <mesh position={[0, 0, depth/2 - wallThickness/2]}>
        <boxGeometry args={[width, trayHeight * 0.6, wallThickness]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Rear lip */}
      <mesh position={[0, 0, -depth/2 + wallThickness/2]}>
        <boxGeometry args={[width, trayHeight * 0.6, wallThickness]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Cross supports */}
      {[-0.15, 0, 0.15].map((z, i) => (
        <mesh key={`support-${i}`} position={[0, -trayHeight/2 + 0.015, z * depth/0.4]}>
          <boxGeometry args={[width - 0.02, 0.015, 0.02]} />
          <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
};

/**
 * Fixed Shelf - Static equipment support (1RU, full depth, 19" mount)
 */
const FixedShelf = ({
  depth,
  color = COLORS.MANNEX_BLACK
}: {
  depth: number;
  color?: string;
}) => {
  const shelfWidth = RACK_19_INCH_MM / 1000; // 19" standard width
  const shelfDepth = depth - 0.04; // Full depth minus clearance
  const shelfThickness = 0.002;
  const lipHeight = RU_HEIGHT_MM / 1000; // 1RU front lip
  const earWidth = 0.02;
  
  return (
    <group>
      {/* Mounting ears (19" rack mount) */}
      {[-shelfWidth/2 - earWidth/2, shelfWidth/2 + earWidth/2].map((x, i) => (
        <mesh key={`ear-${i}`} position={[x, 0, shelfDepth/2]}>
          <boxGeometry args={[earWidth, lipHeight, 0.003]} />
          <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
      
      {/* Front lip (1RU height) */}
      <mesh position={[0, 0, shelfDepth/2]}>
        <boxGeometry args={[shelfWidth, lipHeight, 0.003]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      
      {/* Shelf surface (full depth) */}
      <mesh position={[0, -lipHeight/2 + shelfThickness/2, 0]}>
        <boxGeometry args={[shelfWidth, shelfThickness, shelfDepth]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      
      {/* Side rails for support */}
      {[-shelfWidth/2 + 0.01, shelfWidth/2 - 0.01].map((x, i) => (
        <mesh key={`rail-${i}`} position={[x, -lipHeight/2 - 0.01, 0]}>
          <boxGeometry args={[0.02, 0.02, shelfDepth - 0.02]} />
          <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      
      {/* Rear support bar */}
      <mesh position={[0, -lipHeight/2 - 0.01, -shelfDepth/2 + 0.02]}>
        <boxGeometry args={[shelfWidth - 0.04, 0.02, 0.02]} />
        <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.5} metalness={0.4} />
      </mesh>
    </group>
  );
};

/**
 * Sliding Shelf - Serviceable equipment support with slide rails (1RU, full depth, 19" mount)
 * Extends outside rack when doors are open
 */
const SlidingShelf = ({
  depth,
  extended = false,
  color = COLORS.MANNEX_BLACK
}: {
  depth: number;
  extended?: boolean;
  color?: string;
}) => {
  const shelfWidth = RACK_19_INCH_MM / 1000 - 0.02; // Slightly narrower for rails
  const shelfDepth = depth - 0.04; // Full depth minus clearance
  const shelfThickness = 0.002;
  const lipHeight = RU_HEIGHT_MM / 1000; // 1RU front lip
  const railHeight = 0.02;
  const earWidth = 0.025;
  const extensionOffset = extended ? shelfDepth * 0.7 : 0; // Extends 70% when open
  
  return (
    <group>
      {/* Fixed slide rails (mounted to rack) */}
      {[-shelfWidth/2 - 0.015, shelfWidth/2 + 0.015].map((x, i) => (
        <group key={`rail-assembly-${i}`}>
          {/* Mounting ear */}
          <mesh position={[x, 0, shelfDepth/2]}>
            <boxGeometry args={[earWidth, lipHeight, 0.003]} />
            <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
          </mesh>
          {/* Rail track */}
          <mesh position={[x, -lipHeight/2, 0]}>
            <boxGeometry args={[0.025, railHeight, shelfDepth]} />
            <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.4} metalness={0.5} />
          </mesh>
        </group>
      ))}
      
      {/* Sliding tray */}
      <group position={[0, 0, extensionOffset]}>
        {/* Front lip with handle */}
        <mesh position={[0, 0, shelfDepth/2]}>
          <boxGeometry args={[shelfWidth, lipHeight, 0.003]} />
          <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
        </mesh>
        
        {/* Handle cutout indicator */}
        <mesh position={[0, -lipHeight/4, shelfDepth/2 + 0.002]}>
          <boxGeometry args={[0.08, lipHeight/3, 0.002]} />
          <meshStandardMaterial color={COLORS.FRAME_DARK} roughness={0.8} metalness={0.2} />
        </mesh>
        
        {/* Shelf surface */}
        <mesh position={[0, -lipHeight/2 + shelfThickness/2, 0]}>
          <boxGeometry args={[shelfWidth, shelfThickness, shelfDepth]} />
          <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
        </mesh>
        
        {/* Side lips */}
        {[-shelfWidth/2 + 0.002, shelfWidth/2 - 0.002].map((x, i) => (
          <mesh key={`lip-${i}`} position={[x, -lipHeight/2 + 0.008, 0]}>
            <boxGeometry args={[0.004, 0.015, shelfDepth]} />
            <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

/**
 * Blanking Panel - Cover unused rack space (1RU or 2RU)
 */
const BlankingPanel = ({
  width,
  ruCount = 1,
  color = COLORS.MANNEX_BLACK
}: {
  width: number;
  ruCount?: 1 | 2;
  color?: string;
}) => {
  const panelWidth = width - 0.02;
  const panelHeight = (RU_HEIGHT_MM * ruCount) / 1000 - 0.002;
  const panelThickness = 0.002;
  
  return (
    <group>
      {/* Main panel */}
      <mesh>
        <boxGeometry args={[panelWidth, panelHeight, panelThickness]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Mounting ears */}
      {[-panelWidth/2 - 0.012, panelWidth/2 + 0.012].map((x, i) => (
        <mesh key={`ear-${i}`} position={[x, 0, 0]}>
          <boxGeometry args={[0.024, panelHeight, panelThickness]} />
          <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
};

/**
 * PDU Horizontal - 6-Way power distribution unit
 */
const PDUHorizontal = ({
  width,
  color = COLORS.MANNEX_BLACK
}: {
  width: number;
  color?: string;
}) => {
  const pduWidth = width * 0.85;
  const pduHeight = 0.044; // ~1RU
  const pduDepth = 0.06;
  const outletCount = 6;
  const outletSpacing = (pduWidth - 0.1) / outletCount;
  
  return (
    <group>
      {/* Main housing */}
      <mesh>
        <boxGeometry args={[pduWidth, pduHeight, pduDepth]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Outlet indicators */}
      {Array.from({ length: outletCount }).map((_, i) => {
        const xPos = -pduWidth/2 + 0.05 + outletSpacing * (i + 0.5);
        return (
          <mesh key={`outlet-${i}`} position={[xPos, 0, pduDepth/2 + 0.001]}>
            <boxGeometry args={[0.025, 0.03, 0.002]} />
            <meshStandardMaterial color={COLORS.FRAME_DARK} roughness={0.8} metalness={0.1} />
          </mesh>
        );
      })}
      {/* Power indicator LED */}
      <mesh position={[pduWidth/2 - 0.03, 0.01, pduDepth/2 + 0.001]}>
        <boxGeometry args={[0.008, 0.008, 0.002]} />
        <meshStandardMaterial color={COLORS.LED_GREEN} emissive={COLORS.LED_GREEN} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
};

/**
 * PDU Vertical - 10 or 20-Way power distribution unit
 */
const PDUVertical = ({
  height,
  outletCount = 10,
  color = COLORS.MANNEX_BLACK
}: {
  height: number;
  outletCount?: 10 | 20;
  color?: string;
}) => {
  const pduHeight = height * 0.85;
  const pduWidth = 0.06;
  const pduDepth = 0.055;
  const outletSpacing = (pduHeight - 0.1) / outletCount;
  
  return (
    <group>
      {/* Main housing */}
      <mesh>
        <boxGeometry args={[pduWidth, pduHeight, pduDepth]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Outlet indicators */}
      {Array.from({ length: outletCount }).map((_, i) => {
        const yPos = pduHeight/2 - 0.05 - outletSpacing * i;
        return (
          <mesh key={`outlet-${i}`} position={[pduWidth/2 + 0.001, yPos, 0]}>
            <boxGeometry args={[0.002, 0.022, 0.028]} />
            <meshStandardMaterial color={COLORS.FRAME_DARK} roughness={0.8} metalness={0.1} />
          </mesh>
        );
      })}
      {/* Power indicator LED */}
      <mesh position={[pduWidth/2 + 0.001, pduHeight/2 - 0.025, 0]}>
        <boxGeometry args={[0.002, 0.008, 0.008]} />
        <meshStandardMaterial color={COLORS.LED_GREEN} emissive={COLORS.LED_GREEN} emissiveIntensity={0.5} />
      </mesh>
      {/* Mounting brackets */}
      {[pduHeight/2 - 0.03, -pduHeight/2 + 0.03].map((y, i) => (
        <mesh key={`mount-${i}`} position={[-pduWidth/2 - 0.01, y, 0]}>
          <boxGeometry args={[0.02, 0.025, pduDepth]} />
          <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
    </group>
  );
};

/**
 * Stabiliser Kit - Rear base support bars
 */
const StabiliserKit = ({
  width,
  depth,
  color = COLORS.MANNEX_BLACK
}: {
  width: number;
  depth: number;
  color?: string;
}) => {
  const barLength = depth * 0.6;
  const barWidth = 0.04;
  const barHeight = 0.02;
  
  return (
    <group>
      {/* Left stabiliser bar */}
      <mesh position={[-width/2 + barWidth/2 + 0.02, 0, -barLength/2]}>
        <boxGeometry args={[barWidth, barHeight, barLength]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Right stabiliser bar */}
      <mesh position={[width/2 - barWidth/2 - 0.02, 0, -barLength/2]}>
        <boxGeometry args={[barWidth, barHeight, barLength]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Cross brace */}
      <mesh position={[0, 0, -barLength + 0.02]}>
        <boxGeometry args={[width - 0.08, barHeight, barWidth]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
    </group>
  );
};

/**
 * Baying Kit - Connector brackets between adjacent racks
 */
const BayingKit = ({
  height,
  color = COLORS.STEEL_GREY
}: {
  height: number;
  color?: string;
}) => {
  const bracketHeight = 0.08;
  const bracketWidth = 0.06;
  const bracketDepth = 0.015;
  const positions = [height/2 - 0.1, height/4, 0, -height/4, -height/2 + 0.1];
  
  return (
    <group>
      {positions.map((y, i) => (
        <mesh key={`baying-bracket-${i}`} position={[0, y, 0]}>
          <boxGeometry args={[bracketWidth, bracketHeight, bracketDepth]} />
          <meshStandardMaterial color={color} roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
    </group>
  );
};

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
  const panelThickness = 0.02; // 20mm for quality appearance
  
  // Door types (front and rear)
  const frontDoorType = config.selections['front-door'] || 'door-perf-steel';
  const rearDoorType = config.selections['rear-door'] || frontDoorType;
  const lockTypeSelection = config.selections['lock'] || 'lock-key-standard';
  const lockType: 'standard' | 'combination' | 'digital' = 
    lockTypeSelection === 'lock-combo-standard' || lockTypeSelection === 'lock-combo-class-b' ? 'combination' :
    lockTypeSelection === 'lock-digital' ? 'digital' : 'standard';
  const lockQty = Number(config.selections['lock-qty']) || 1;
  const hasRearLock = lockQty >= 2;
  const doorVariant: 'perforated' | 'solid' | 'polycarbonate' =
    frontDoorType === 'door-polycarbonate'
      ? 'polycarbonate'
      : frontDoorType === 'door-solid-steel'
        ? 'solid'
        : 'perforated';
  const rearVariant: 'perforated' | 'solid' | 'polycarbonate' =
    rearDoorType === 'door-polycarbonate'
      ? 'polycarbonate'
      : rearDoorType === 'door-solid-steel'
        ? 'solid'
        : 'perforated';
  
  // Hinge side (left or right hand)
  const hingeSide = config.selections['hinge-side'] || 'hinge-left';
  const isLeftHinge = hingeSide === 'hinge-left';
  
  // Door dimensions
  const doorWidth = width - frameThickness * 2 - 0.004;
  const doorHeight = height - frameThickness * 2 - 0.004;
  
  // Accessories
  const accessories = config.selections['accessories'] as Record<string, number> || {};
  const hasCastors = (accessories['acc-castors'] || 0) > 0;
  const hasVentedTopPanel = (accessories['acc-top-vented'] || 0) > 0;
  const hasCableLadder = (accessories['acc-cable-ladder'] || 0) > 0;
  const hasBlankingTopPanel = (accessories['acc-top-blanking'] || 0) > 0;
  const hasBrushTopPanel = (accessories['acc-top-brush'] || 0) > 0;
  const hasFanTray2 = (accessories['acc-fan-tray-2'] || 0) > 0;
  const hasFanTray4 = (accessories['acc-fan-tray-4'] || 0) > 0;
  const hasFingerManager = (accessories['acc-finger-manager'] || 0) > 0;
  const hasVCM150 = (accessories['acc-vcm-150-250'] || accessories['acc-vcm-150-450'] || 0) > 0;
  const hasVCM300 = (accessories['acc-vcm-300-250'] || accessories['acc-vcm-300-450'] || 0) > 0;
  const fixedShelfCount = accessories['acc-shelf-fixed'] || 0;
  const slidingShelfCount = accessories['acc-shelf-sliding'] || 0;
  const hasBlankingPanel1U = (accessories['acc-blanking-panel-1u'] || 0) > 0;
  const hasBlankingPanel2U = (accessories['acc-blanking-panel-2u'] || 0) > 0;
  const hasPDU6 = (accessories['acc-pdu-6'] || 0) > 0;
  const hasPDU10V = (accessories['acc-pdu-10-v'] || 0) > 0;
  const hasPDU20V = (accessories['acc-pdu-20-v'] || 0) > 0;
  const hasStabiliser = (accessories['acc-stabiliser'] || 0) > 0;
  const hasBayingKit = (accessories['acc-baying-kit'] || 0) > 0;
  
  const baseHeight = hasCastors ? 0.06 : 0.04;
  const frameColor = resolveSelectedColour(product, config.selections, 'frame-colour', COLORS.MANNEX_BLACK);
  const doorColor = resolveSelectedColour(product, config.selections, 'door-colour', COLORS.MANNEX_BLACK);
  const sidePanelSelection = config.selections['side-panels'] || 'panel-solid-lockable';
  const showSidePanels = sidePanelSelection !== 'panel-none';
  
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
          <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
      
      {/* Top Frame */}
      <group position={[0, height/2 - frameThickness/2, 0]}>
        {/* Front/Back rails */}
        {[-depth/2 + frameThickness/2, depth/2 - frameThickness/2].map((z, i) => (
          <mesh key={`top-fb-${i}`} position={[0, 0, z]} castShadow>
            <boxGeometry args={[width - frameThickness*2, frameThickness, frameThickness]} />
            <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
          </mesh>
        ))}
        {/* Left/Right rails */}
        {[-width/2 + frameThickness/2, width/2 - frameThickness/2].map((x, i) => (
          <mesh key={`top-lr-${i}`} position={[x, 0, 0]} castShadow>
            <boxGeometry args={[frameThickness, frameThickness, depth - frameThickness*2]} />
            <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
          </mesh>
        ))}
        {/* Top Panel - Priority: Brush > Vented > Blanking > Default solid */}
        <group position={[0, frameThickness/2 + 0.001, 0]}>
          {hasBrushTopPanel ? (
            <BrushEntryTopPanel width={width} depth={depth} frameThickness={frameThickness} color={frameColor} />
          ) : hasVentedTopPanel ? (
            <group rotation={[-Math.PI / 2, 0, 0]}>
              <PerforatedPanel 
                width={width - frameThickness*2 - 0.01}
                height={depth - frameThickness*2 - 0.01}
                depth={0.002}
                color={frameColor}
              />
            </group>
          ) : hasBlankingTopPanel ? (
            <BlankingTopPanel width={width} depth={depth} frameThickness={frameThickness} color={frameColor} />
          ) : (
            <mesh>
              <boxGeometry args={[width - frameThickness*2 - 0.01, 0.002, depth - frameThickness*2 - 0.01]} />
              <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} />
            </mesh>
          )}
        </group>
        {/* Fan Tray (mounted on top at front, breaking through roof) */}
        {(hasFanTray2 || hasFanTray4) && (
          <group position={[0, frameThickness/2 + 0.012, depth/2 - frameThickness - 0.12]}>
            <FanTray 
              width={width} 
              fanCount={hasFanTray4 ? 4 : 2} 
              color={frameColor} 
            />
          </group>
        )}
        {/* Cable ladder (top rear) */}
        {hasCableLadder && (
          <group position={[0, 0.03, -depth/2 + frameThickness * 2 + 0.06]}>
            <mesh>
              <boxGeometry args={[width - frameThickness * 3, 0.02, 0.12]} />
              <meshStandardMaterial color={COLORS.FRAME_DARK} roughness={0.5} metalness={0.4} />
            </mesh>
            {[0.02, -0.02].map((y, idx) => (
              <mesh key={`ladder-rail-${idx}`} position={[0, y, 0]}>
                <boxGeometry args={[width - frameThickness * 3, 0.004, 0.02]} />
                <meshStandardMaterial color={COLORS.FRAME_DARK} roughness={0.5} metalness={0.4} />
              </mesh>
            ))}
          </group>
        )}
      </group>
      
      {/* Bottom Frame */}
      <group position={[0, -height/2 + frameThickness/2, 0]}>
        {/* Front/Back rails */}
        {[-depth/2 + frameThickness/2, depth/2 - frameThickness/2].map((z, i) => (
          <mesh key={`bot-fb-${i}`} position={[0, 0, z]} castShadow>
            <boxGeometry args={[width - frameThickness*2, frameThickness, frameThickness]} />
            <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
          </mesh>
        ))}
        {/* Left/Right rails */}
        {[-width/2 + frameThickness/2, width/2 - frameThickness/2].map((x, i) => (
          <mesh key={`bot-lr-${i}`} position={[x, 0, 0]} castShadow>
            <boxGeometry args={[frameThickness, frameThickness, depth - frameThickness*2]} />
            <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
          </mesh>
        ))}
      </group>
      
      {/* Front Door - Perforated or Solid */}
      {/* Door pivots at hinge edge, swings outward from front face */}
      <group 
        position={[
          isLeftHinge ? (-width/2 + frameThickness) : (width/2 - frameThickness), 
          0, 
          depth/2 - frameThickness/4
        ]}
      >
        <group rotation={[0, doorsOpen ? (isLeftHinge ? -Math.PI/2 : Math.PI/2) : 0, 0]}>
          <group position={[isLeftHinge ? doorWidth/2 : -doorWidth/2, 0, 0]}>
            <DoorPanel
              width={doorWidth}
              height={doorHeight}
              depth={panelThickness}
              variant={doorVariant}
              frontColor={doorColor}
            />
            {/* Door Lock - on opposite side of hinge */}
            <DoorLock position={[isLeftHinge ? (doorWidth/2 - 0.05) : (-doorWidth/2 + 0.05), 0, panelThickness/2 + 0.01]} lockType={lockType} />
            {doorVariant !== 'solid' && (
              <DoorNotch
                position={[
                  isLeftHinge ? (doorWidth/2 - 0.05) : (-doorWidth/2 + 0.05),
                  DOOR_NOTCH_OFFSET_Y,
                  panelThickness/2 + 0.003,
                ]}
                color={doorColor}
                doorHeight={doorHeight}
              />
            )}
            {/* 3-point lock indicator */}
            <mesh position={[isLeftHinge ? (doorWidth/2 - 0.045) : (-doorWidth/2 + 0.045), 0, panelThickness/2 + 0.004]}>
              <boxGeometry args={[0.006, doorHeight * 0.7, 0.002]} />
              <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.4} metalness={0.7} />
            </mesh>
            {[doorHeight/2 - 0.04, -(doorHeight/2 - 0.04)].map((y, idx) => (
              <mesh key={`lock-pin-front-${idx}`} position={[isLeftHinge ? (doorWidth/2 - 0.045) : (-doorWidth/2 + 0.045), y, panelThickness/2 + 0.006]}>
                <boxGeometry args={[0.014, 0.012, 0.004]} />
                <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.4} metalness={0.7} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
      
      {/* Rear Door - matches selected rear door type */}
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
            <DoorPanel
              width={doorWidth}
              height={doorHeight}
              depth={panelThickness}
              variant={rearVariant}
              frontColor={doorColor}
            />
            {/* Rear Door Lock - only when lock qty >= 2 */}
            {hasRearLock && (
              <>
                <DoorLock position={[isLeftHinge ? (-doorWidth/2 + 0.05) : (doorWidth/2 - 0.05), 0, -panelThickness/2 - 0.01]} lockType={lockType} />
                {rearVariant !== 'solid' && (
                  <DoorNotch position={[isLeftHinge ? (-doorWidth/2 + 0.05) : (doorWidth/2 - 0.05), DOOR_NOTCH_OFFSET_Y, -panelThickness/2 - 0.003]} color={doorColor} doorHeight={doorHeight} />
                )}
              </>
            )}
          </group>
        </group>
      </group>
      
      {/* Side Panels - Solid Steel */}
      {showSidePanels && [-1, 1].map((side, i) => (
        <group key={`side-${i}`} position={[side * (width/2 - 0.001), 0, 0]} rotation={[0, Math.PI/2, 0]}>
          <SolidPanel 
            width={depth - frameThickness * 2 - 0.01} 
            height={height - frameThickness * 2 - 0.01}
            depth={panelThickness}
            color={frameColor}
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

      {/* ============ ACCESSORIES ============ */}
      
      {/* Finger Manager (horizontal cable organizer) - mounted at top front */}
      {hasFingerManager && (
        <group position={[0, height/2 - frameThickness - 0.05, depth/2 - 0.06]}>
          <FingerManager width={width} ruHeight={ruHeight} color={frameColor} />
        </group>
      )}

      {/* Vertical Cable Manager 150mm - left side (inside rack, against left wall, opening faces center) */}
      {hasVCM150 && (
        <group position={[-width/2 + frameThickness + 0.05, 0, 0]} rotation={[0, -Math.PI/2, 0]}>
          <VerticalCableManager height={height - frameThickness * 2} managerWidth={0.15} color={frameColor} />
        </group>
      )}

      {/* Vertical Cable Manager 300mm - right side (inside rack, against right wall, opening faces center) */}
      {hasVCM300 && (
        <group position={[width/2 - frameThickness - 0.05, 0, 0]} rotation={[0, Math.PI/2, 0]}>
          <VerticalCableManager height={height - frameThickness * 2} managerWidth={0.30} color={frameColor} />
        </group>
      )}

      {/* Fixed Shelves - stacked at RU positions from bottom */}
      {fixedShelfCount > 0 && Array.from({ length: fixedShelfCount }).map((_, i) => {
        const ruPosition = 5 + i * 8; // Start at RU 5, space 8 RU apart
        const yPos = -height/2 + frameThickness + (ruPosition * RU_HEIGHT_MM / 1000);
        return (
          <group key={`fixed-shelf-${i}`} position={[0, yPos, 0]}>
            <FixedShelf depth={depth} color={frameColor} />
          </group>
        );
      })}

      {/* Sliding Shelves - stacked at RU positions, extend when doors open */}
      {slidingShelfCount > 0 && Array.from({ length: slidingShelfCount }).map((_, i) => {
        const ruPosition = 10 + i * 8; // Start at RU 10, space 8 RU apart
        const yPos = -height/2 + frameThickness + (ruPosition * RU_HEIGHT_MM / 1000);
        return (
          <group key={`sliding-shelf-${i}`} position={[0, yPos, 0]}>
            <SlidingShelf depth={depth} extended={doorsOpen} color={frameColor} />
          </group>
        );
      })}

      {/* Blanking Panel 1RU - front, upper third */}
      {hasBlankingPanel1U && (
        <group position={[0, height/4, depth/2 - 0.02]}>
          <BlankingPanel width={width} ruCount={1} color={frameColor} />
        </group>
      )}

      {/* Blanking Panel 2RU - front, lower section */}
      {hasBlankingPanel2U && (
        <group position={[0, -height/4, depth/2 - 0.02]}>
          <BlankingPanel width={width} ruCount={2} color={frameColor} />
        </group>
      )}

      {/* PDU 6-Way Horizontal - rear mounted */}
      {hasPDU6 && (
        <group position={[0, -height/3 + 0.1, -depth/2 + 0.06]}>
          <PDUHorizontal width={width} color={frameColor} />
        </group>
      )}

      {/* PDU 10-Way Vertical - left rear */}
      {hasPDU10V && (
        <group position={[-width/2 + 0.05, 0, -depth/2 + 0.05]} rotation={[0, Math.PI/2, 0]}>
          <PDUVertical height={height * 0.6} outletCount={10} color={frameColor} />
        </group>
      )}

      {/* PDU 20-Way Vertical - right rear */}
      {hasPDU20V && (
        <group position={[width/2 - 0.05, 0, -depth/2 + 0.05]} rotation={[0, -Math.PI/2, 0]}>
          <PDUVertical height={height * 0.85} outletCount={20} color={frameColor} />
        </group>
      )}

      {/* Stabiliser Kit - rear base */}
      {hasStabiliser && (
        <group position={[0, -height/2 - 0.01, -depth/2]}>
          <StabiliserKit width={width} depth={depth} color={frameColor} />
        </group>
      )}

      {/* Baying Kit - side connectors (shown on right side) */}
      {hasBayingKit && (
        <group position={[width/2 + 0.01, 0, 0]}>
          <BayingKit height={height} />
        </group>
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
 * Distinct features: H-frame rigidity, perforated front door, rear barn doors,
 * lockable side panels, cable trays, and labeled vertical angles.
 */
const Series25Rack = ({ config, product, doorsOpen = false }: { config: ConfigurationState; product: ProductDefinition; doorsOpen?: boolean }) => {
  const ruHeightMatch = String(config.selections['ru-height'] || 'ru-42').match(/ru-(\d+)/);
  const ruHeight = ruHeightMatch ? parseInt(ruHeightMatch[1]) : 42;

  const widthMatch = String(config.selections['width'] || 'width-600').match(/width-(\d+)/);
  const widthMm = widthMatch ? parseInt(widthMatch[1]) : 600;

  const depthMatch = String(config.selections['depth'] || 'depth-800').match(/depth-(\d+)/);
  const depthMm = depthMatch ? parseInt(depthMatch[1]) : 800;

  const height = (ruHeight * RU_HEIGHT_MM + 100) / 1000;
  const width = widthMm / 1000;
  const depth = depthMm / 1000;

  const frameThickness = 0.04;
  const panelThickness = 0.02; // 20mm for quality appearance

  const frontDoorType = config.selections['front-door'] || 'door-perf-steel';
  const rearDoorType = config.selections['rear-door'] || frontDoorType;
  const lockTypeSelection = config.selections['lock'] || 'lock-key-standard';
  const lockType: 'standard' | 'combination' | 'digital' = 
    lockTypeSelection === 'lock-combo-standard' || lockTypeSelection === 'lock-combo-class-b' ? 'combination' :
    lockTypeSelection === 'lock-digital' ? 'digital' : 'standard';
  const lockQty = Number(config.selections['lock-qty']) || 1;
  const hasRearLock = lockQty >= 2;
  const isFrontSplit = frontDoorType === 'door-split';
  const isRearSplit = rearDoorType === 'door-split';
  const frontVariant: 'perforated' | 'solid' | 'polycarbonate' =
    frontDoorType === 'door-polycarbonate'
      ? 'polycarbonate'
      : frontDoorType === 'door-solid-steel'
        ? 'solid'
        : 'perforated';
  const rearVariant: 'perforated' | 'solid' | 'polycarbonate' =
    rearDoorType === 'door-polycarbonate'
      ? 'polycarbonate'
      : rearDoorType === 'door-solid-steel'
        ? 'solid'
        : 'perforated';

  const hingeSide = config.selections['hinge-side'] || 'hinge-left';
  const isLeftHinge = hingeSide === 'hinge-left';

  // Accessories
  const accessories = config.selections['accessories'] as Record<string, number> || {};
  const hasCastors = (accessories['acc-castors'] || 0) > 0;
  const hasVentedTopPanel = (accessories['acc-top-vented'] || 0) > 0;
  const hasCableLadder = (accessories['acc-cable-ladder'] || 0) > 0;
  const hasBlankingTopPanel = (accessories['acc-top-blanking'] || 0) > 0;
  const hasBrushTopPanel = (accessories['acc-top-brush'] || 0) > 0;
  const hasFanTray2 = (accessories['acc-fan-tray-2'] || 0) > 0;
  const hasFanTray4 = (accessories['acc-fan-tray-4'] || 0) > 0;
  const hasFingerManager = (accessories['acc-finger-manager'] || 0) > 0;
  const hasVCM150 = (accessories['acc-vcm-150-250'] || accessories['acc-vcm-150-450'] || 0) > 0;
  const hasVCM300 = (accessories['acc-vcm-300-250'] || accessories['acc-vcm-300-450'] || 0) > 0;
  const fixedShelfCount = accessories['acc-shelf-fixed'] || 0;
  const slidingShelfCount = accessories['acc-shelf-sliding'] || 0;
  const hasBlankingPanel1U = (accessories['acc-blanking-panel-1u'] || 0) > 0;
  const hasBlankingPanel2U = (accessories['acc-blanking-panel-2u'] || 0) > 0;
  const hasPDU6 = (accessories['acc-pdu-6'] || 0) > 0;
  const hasPDU10V = (accessories['acc-pdu-10-v'] || 0) > 0;
  const hasPDU20V = (accessories['acc-pdu-20-v'] || 0) > 0;
  const hasStabiliser = (accessories['acc-stabiliser'] || 0) > 0;
  const hasBayingKit = (accessories['acc-baying-kit'] || 0) > 0;

  const baseHeight = hasCastors ? 0.06 : 0.04;
  const doorWidth = width - frameThickness * 2 - 0.004;
  const doorHeight = height - frameThickness * 2 - 0.004;
  const frameColor = resolveSelectedColour(product, config.selections, 'frame-colour', COLORS.MANNEX_BLACK);
  const doorColor = resolveSelectedColour(product, config.selections, 'door-colour', COLORS.MANNEX_BLACK);

  const sidePanelSelection = config.selections['side-panels'] || 'panel-solid-lockable';
  const showSidePanels = sidePanelSelection !== 'panel-none';
  const isVentedSidePanel = sidePanelSelection === 'panel-vented';
  const sidePanelWidth = depth - frameThickness * 2 - 0.01;
  const sidePanelHeight = height - frameThickness * 2 - 0.01;
  const sideLockY = sidePanelHeight / 2 - 0.08;

  return (
    <group position={[0, height/2 + baseHeight, 0]}>
      {/* Main Cabinet Frame - Corner posts */}
      {[
        [-width/2 + frameThickness/2, 0, -depth/2 + frameThickness/2],
        [width/2 - frameThickness/2, 0, -depth/2 + frameThickness/2],
        [-width/2 + frameThickness/2, 0, depth/2 - frameThickness/2],
        [width/2 - frameThickness/2, 0, depth/2 - frameThickness/2],
      ].map((pos, i) => (
        <mesh key={`post-25-${i}`} position={pos as [number, number, number]} castShadow>
          <boxGeometry args={[frameThickness, height, frameThickness]} />
          <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
        </mesh>
      ))}

      {/* H-Frame Rigidity - Mid-height side rails */}
      {[-width/2 + frameThickness/2, width/2 - frameThickness/2].map((x, i) => (
        <mesh key={`hframe-${i}`} position={[x, 0, 0]} castShadow>
          <boxGeometry args={[frameThickness, frameThickness, depth - frameThickness * 2]} />
          <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.4} />
        </mesh>
      ))}

      {/* Top Frame */}
      <group position={[0, height/2 - frameThickness/2, 0]}>
        {[-depth/2 + frameThickness/2, depth/2 - frameThickness/2].map((z, i) => (
          <mesh key={`top-25-fb-${i}`} position={[0, 0, z]} castShadow>
            <boxGeometry args={[width - frameThickness*2, frameThickness, frameThickness]} />
            <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
          </mesh>
        ))}
        {[-width/2 + frameThickness/2, width/2 - frameThickness/2].map((x, i) => (
          <mesh key={`top-25-lr-${i}`} position={[x, 0, 0]} castShadow>
            <boxGeometry args={[frameThickness, frameThickness, depth - frameThickness*2]} />
            <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
          </mesh>
        ))}
        {/* Top Panel - Priority: Brush > Vented > Blanking > Default solid */}
        <group position={[0, frameThickness/2 + 0.001, 0]}>
          {hasBrushTopPanel ? (
            <BrushEntryTopPanel width={width} depth={depth} frameThickness={frameThickness} color={frameColor} />
          ) : hasVentedTopPanel ? (
            <group rotation={[-Math.PI / 2, 0, 0]}>
              <PerforatedPanel 
                width={width - frameThickness*2 - 0.01}
                height={depth - frameThickness*2 - 0.01}
                depth={0.002}
                color={frameColor}
              />
            </group>
          ) : hasBlankingTopPanel ? (
            <BlankingTopPanel width={width} depth={depth} frameThickness={frameThickness} color={frameColor} />
          ) : (
            <mesh>
              <boxGeometry args={[width - frameThickness*2 - 0.01, 0.002, depth - frameThickness*2 - 0.01]} />
              <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} />
            </mesh>
          )}
        </group>
        {/* Fan Tray (mounted on top at front, breaking through roof) */}
        {(hasFanTray2 || hasFanTray4) && (
          <group position={[0, frameThickness/2 + 0.012, depth/2 - frameThickness - 0.12]}>
            <FanTray 
              width={width} 
              fanCount={hasFanTray4 ? 4 : 2} 
              color={frameColor} 
            />
          </group>
        )}
        {/* Cable ladder (top rear) */}
        {hasCableLadder && (
          <group position={[0, 0.03, -depth/2 + frameThickness * 2 + 0.06]}>
            <mesh>
              <boxGeometry args={[width - frameThickness * 3, 0.02, 0.12]} />
              <meshStandardMaterial color={COLORS.FRAME_DARK} roughness={0.5} metalness={0.4} />
            </mesh>
            {[0.02, -0.02].map((y, idx) => (
              <mesh key={`ladder-25-rail-${idx}`} position={[0, y, 0]}>
                <boxGeometry args={[width - frameThickness * 3, 0.004, 0.02]} />
                <meshStandardMaterial color={COLORS.FRAME_DARK} roughness={0.5} metalness={0.4} />
              </mesh>
            ))}
          </group>
        )}
      </group>

      {/* Bottom Frame */}
      <group position={[0, -height/2 + frameThickness/2, 0]}>
        {[-depth/2 + frameThickness/2, depth/2 - frameThickness/2].map((z, i) => (
          <mesh key={`bot-25-fb-${i}`} position={[0, 0, z]} castShadow>
            <boxGeometry args={[width - frameThickness*2, frameThickness, frameThickness]} />
            <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
          </mesh>
        ))}
        {[-width/2 + frameThickness/2, width/2 - frameThickness/2].map((x, i) => (
          <mesh key={`bot-25-lr-${i}`} position={[x, 0, 0]} castShadow>
            <boxGeometry args={[frameThickness, frameThickness, depth - frameThickness*2]} />
            <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
          </mesh>
        ))}
      </group>

      {/* Front Door */}
      {!isFrontSplit && (
        <group position={[isLeftHinge ? (-width/2 + frameThickness) : (width/2 - frameThickness), 0, depth/2 - frameThickness/4]}>
          <group rotation={[0, doorsOpen ? (isLeftHinge ? -Math.PI/2 : Math.PI/2) : 0, 0]}>
            <group position={[isLeftHinge ? doorWidth/2 : -doorWidth/2, 0, 0]}>
              <DoorPanel
                width={doorWidth}
                height={doorHeight}
                depth={panelThickness}
                variant={frontVariant}
                frontColor={doorColor}
              />
              <DoorLock position={[isLeftHinge ? (doorWidth/2 - 0.05) : (-doorWidth/2 + 0.05), 0, panelThickness/2 + 0.01]} lockType={lockType} />
              {frontVariant !== 'solid' && (
                <DoorNotch
                  position={[
                    isLeftHinge ? (doorWidth/2 - 0.05) : (-doorWidth/2 + 0.05),
                    DOOR_NOTCH_OFFSET_Y,
                    panelThickness/2 + 0.003,
                  ]}
                  color={doorColor}
                  doorHeight={doorHeight}
                />
              )}
            </group>
          </group>
        </group>
      )}
      {isFrontSplit && (
        <group position={[0, 0, depth/2 - frameThickness/4]}>
          {/* Left front door */}
          <group position={[-width/2 + frameThickness, 0, 0]}>
            <group rotation={[0, doorsOpen ? -Math.PI/2 : 0, 0]}>
              <group position={[doorWidth/4, 0, 0]}>
                <DoorPanel
                  width={doorWidth / 2}
                  height={doorHeight}
                  depth={panelThickness}
                  variant={frontVariant}
                  frontColor={doorColor}
                />
              </group>
            </group>
          </group>
          {/* Right front door */}
          <group position={[width/2 - frameThickness, 0, 0]}>
            <group rotation={[0, doorsOpen ? Math.PI/2 : 0, 0]}>
              <group position={[-doorWidth/4, 0, 0]}>
                <DoorPanel
                  width={doorWidth / 2}
                  height={doorHeight}
                  depth={panelThickness}
                  variant={frontVariant}
                  frontColor={doorColor}
                />
              </group>
            </group>
          </group>
          {/* Center lock */}
          <DoorLock position={[0, 0, panelThickness/2 + 0.01]} lockType={lockType} />
          {frontVariant !== 'solid' && (
            <DoorNotch position={[0, DOOR_NOTCH_OFFSET_Y, panelThickness/2 + 0.003]} color={doorColor} doorHeight={doorHeight} />
          )}
        </group>
      )}

      {/* Rear Doors - barn style split when selected */}
      {!isRearSplit && (
        <group position={[isLeftHinge ? (width/2 - frameThickness) : (-width/2 + frameThickness), 0, -depth/2 + frameThickness/2]}>
          <group rotation={[0, doorsOpen ? (isLeftHinge ? Math.PI/2 : -Math.PI/2) : 0, 0]}>
            <group position={[isLeftHinge ? -doorWidth/2 : doorWidth/2, 0, 0]}>
              <DoorPanel
                width={doorWidth}
                height={doorHeight}
                depth={panelThickness}
                variant={rearVariant}
                frontColor={doorColor}
              />
              {/* Rear Door Lock - only when lock qty >= 2 */}
              {hasRearLock && (
                <DoorLock position={[isLeftHinge ? (-doorWidth/2 + 0.05) : (doorWidth/2 - 0.05), 0, -panelThickness/2 - 0.01]} lockType={lockType} />
              )}
              {rearVariant !== 'solid' && hasRearLock && (
                <DoorNotch
                  position={[
                    isLeftHinge ? (-doorWidth/2 + 0.05) : (doorWidth/2 - 0.05),
                    DOOR_NOTCH_OFFSET_Y,
                    -panelThickness/2 - 0.003
                  ]}
                  color={doorColor}
                  doorHeight={doorHeight}
                />
              )}
              {/* 3-point lock indicator (rear) */}
              <mesh position={[isLeftHinge ? (-doorWidth/2 + 0.045) : (doorWidth/2 - 0.045), 0, panelThickness/2 + 0.004]}>
                <boxGeometry args={[0.006, doorHeight * 0.7, 0.002]} />
                <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.4} metalness={0.7} />
              </mesh>
              {[doorHeight/2 - 0.04, -(doorHeight/2 - 0.04)].map((y, idx) => (
                <mesh key={`lock-pin-rear-${idx}`} position={[isLeftHinge ? (-doorWidth/2 + 0.045) : (doorWidth/2 - 0.045), y, panelThickness/2 + 0.006]}>
                  <boxGeometry args={[0.014, 0.012, 0.004]} />
                  <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.4} metalness={0.7} />
                </mesh>
              ))}
            </group>
          </group>
        </group>
      )}
      {isRearSplit && (
        <group position={[0, 0, -depth/2 + frameThickness/2]}>
          {/* Left rear door */}
          <group position={[-width/2 + frameThickness, 0, 0]}>
            <group rotation={[0, doorsOpen ? Math.PI/2 : 0, 0]}>
              <group position={[doorWidth/4, 0, 0]}>
                <DoorPanel
                  width={doorWidth / 2}
                  height={doorHeight}
                  depth={panelThickness}
                  variant={rearVariant}
                  frontColor={doorColor}
                />
                {/* Rear left door lock - only when lock qty >= 2 */}
                {hasRearLock && (
                  <DoorLock position={[doorWidth/4 - 0.03, 0, -panelThickness/2 - 0.01]} lockType={lockType} />
                )}
                {rearVariant !== 'solid' && hasRearLock && (
                  <DoorNotch
                    position={[doorWidth/4 - 0.03, DOOR_NOTCH_OFFSET_Y, -panelThickness/2 - 0.001]}
                    color={doorColor}
                  />
                )}
                <mesh position={[doorWidth/4 - 0.02, 0, panelThickness/2 + 0.004]}>
                  <boxGeometry args={[0.006, doorHeight * 0.7, 0.002]} />
                  <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.4} metalness={0.7} />
                </mesh>
                {[doorHeight/2 - 0.04, -(doorHeight/2 - 0.04)].map((y, idx) => (
                  <mesh key={`lock-pin-rear-left-${idx}`} position={[doorWidth/4 - 0.02, y, panelThickness/2 + 0.006]}>
                    <boxGeometry args={[0.014, 0.012, 0.004]} />
                    <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.4} metalness={0.7} />
                  </mesh>
                ))}
              </group>
            </group>
          </group>
          {/* Right rear door */}
          <group position={[width/2 - frameThickness, 0, 0]}>
            <group rotation={[0, doorsOpen ? -Math.PI/2 : 0, 0]}>
              <group position={[-doorWidth/4, 0, 0]}>
                <DoorPanel
                  width={doorWidth / 2}
                  height={doorHeight}
                  depth={panelThickness}
                  variant={rearVariant}
                  frontColor={doorColor}
                />
                {/* Rear right door lock - only when lock qty >= 2 */}
                {hasRearLock && (
                  <DoorLock position={[-doorWidth/4 + 0.03, 0, -panelThickness/2 - 0.01]} lockType={lockType} />
                )}
                {rearVariant !== 'solid' && hasRearLock && (
                  <DoorNotch
                    position={[-doorWidth/4 + 0.03, DOOR_NOTCH_OFFSET_Y, -panelThickness/2 - 0.001]}
                    color={doorColor}
                  />
                )}
                <mesh position={[-doorWidth/4 + 0.02, 0, panelThickness/2 + 0.004]}>
                  <boxGeometry args={[0.006, doorHeight * 0.7, 0.002]} />
                  <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.4} metalness={0.7} />
                </mesh>
                {[doorHeight/2 - 0.04, -(doorHeight/2 - 0.04)].map((y, idx) => (
                  <mesh key={`lock-pin-rear-right-${idx}`} position={[-doorWidth/4 + 0.02, y, panelThickness/2 + 0.006]}>
                    <boxGeometry args={[0.014, 0.012, 0.004]} />
                    <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.4} metalness={0.7} />
                  </mesh>
                ))}
              </group>
            </group>
          </group>
        </group>
      )}

      {/* Side Panels - lockable/removable */}
      {showSidePanels && [-1, 1].map((side, i) => {
        const lockFaceZ = (panelThickness / 2 + 0.006) * side;
        const lockFaceZInset = (panelThickness / 2 + 0.009) * side;
        return (
        <group key={`side-25-${i}`} position={[side * (width/2 - 0.001), 0, 0]} rotation={[0, Math.PI/2, 0]}>
          {isVentedSidePanel ? (
            <PerforatedPanel 
              width={sidePanelWidth} 
              height={sidePanelHeight}
              depth={panelThickness}
              color={frameColor}
            />
          ) : (
            <SolidPanel 
              width={sidePanelWidth} 
              height={sidePanelHeight}
              depth={panelThickness}
              color={frameColor}
            />
          )}
          {/* Side panel lock - circular style (top/middle area) */}
          <mesh position={[0, sideLockY, lockFaceZ]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.006, 20]} />
            <meshStandardMaterial color={COLORS.STEEL_GREY} roughness={0.35} metalness={0.75} />
          </mesh>
          <mesh position={[0, sideLockY, lockFaceZInset]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
            <circleGeometry args={[0.006, 20]} />
            <meshStandardMaterial color="#111111" roughness={0.9} metalness={0.2} />
          </mesh>
        </group>
      )})}

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

      {/* Base - castors or levelling feet */}
      {hasCastors ? (
        <group position={[0, -height/2 - 0.02, 0]}>
          {[
            [-width/2 + 0.08, 0, -depth/2 + 0.08],
            [width/2 - 0.08, 0, -depth/2 + 0.08],
            [-width/2 + 0.08, 0, depth/2 - 0.08],
            [width/2 - 0.08, 0, depth/2 - 0.08],
          ].map((pos, i) => (
            <Castor key={`castor-25-${i}`} position={pos as [number, number, number]} />
          ))}
        </group>
      ) : (
        <group position={[0, -height/2 - 0.01, 0]}>
          {[
            [-width/2 + 0.06, 0, -depth/2 + 0.06],
            [width/2 - 0.06, 0, -depth/2 + 0.06],
            [-width/2 + 0.06, 0, depth/2 - 0.06],
            [width/2 - 0.06, 0, depth/2 - 0.06],
          ].map((pos, i) => (
            <LevellingFoot key={`foot-25-${i}`} position={pos as [number, number, number]} />
          ))}
        </group>
      )}

      {/* ============ ACCESSORIES ============ */}
      
      {/* Finger Manager (horizontal cable organizer) - mounted at top front */}
      {hasFingerManager && (
        <group position={[0, height/2 - frameThickness - 0.05, depth/2 - 0.06]}>
          <FingerManager width={width} ruHeight={ruHeight} color={frameColor} />
        </group>
      )}

      {/* Vertical Cable Manager 150mm - left side (inside rack, against left wall, opening faces center) */}
      {hasVCM150 && (
        <group position={[-width/2 + frameThickness + 0.05, 0, 0]} rotation={[0, -Math.PI/2, 0]}>
          <VerticalCableManager height={height - frameThickness * 2} managerWidth={0.15} color={frameColor} />
        </group>
      )}

      {/* Vertical Cable Manager 300mm - right side (inside rack, against right wall, opening faces center) */}
      {hasVCM300 && (
        <group position={[width/2 - frameThickness - 0.05, 0, 0]} rotation={[0, Math.PI/2, 0]}>
          <VerticalCableManager height={height - frameThickness * 2} managerWidth={0.30} color={frameColor} />
        </group>
      )}

      {/* Fixed Shelves - stacked at RU positions from bottom */}
      {fixedShelfCount > 0 && Array.from({ length: fixedShelfCount }).map((_, i) => {
        const ruPosition = 5 + i * 8; // Start at RU 5, space 8 RU apart
        const yPos = -height/2 + frameThickness + (ruPosition * RU_HEIGHT_MM / 1000);
        return (
          <group key={`fixed-shelf-${i}`} position={[0, yPos, 0]}>
            <FixedShelf depth={depth} color={frameColor} />
          </group>
        );
      })}

      {/* Sliding Shelves - stacked at RU positions, extend when doors open */}
      {slidingShelfCount > 0 && Array.from({ length: slidingShelfCount }).map((_, i) => {
        const ruPosition = 10 + i * 8; // Start at RU 10, space 8 RU apart
        const yPos = -height/2 + frameThickness + (ruPosition * RU_HEIGHT_MM / 1000);
        return (
          <group key={`sliding-shelf-${i}`} position={[0, yPos, 0]}>
            <SlidingShelf depth={depth} extended={doorsOpen} color={frameColor} />
          </group>
        );
      })}

      {/* Blanking Panel 1RU - front, upper third */}
      {hasBlankingPanel1U && (
        <group position={[0, height/4, depth/2 - 0.02]}>
          <BlankingPanel width={width} ruCount={1} color={frameColor} />
        </group>
      )}

      {/* Blanking Panel 2RU - front, lower section */}
      {hasBlankingPanel2U && (
        <group position={[0, -height/4, depth/2 - 0.02]}>
          <BlankingPanel width={width} ruCount={2} color={frameColor} />
        </group>
      )}

      {/* PDU 6-Way Horizontal - rear mounted */}
      {hasPDU6 && (
        <group position={[0, -height/3 + 0.1, -depth/2 + 0.06]}>
          <PDUHorizontal width={width} color={frameColor} />
        </group>
      )}

      {/* PDU 10-Way Vertical - left rear */}
      {hasPDU10V && (
        <group position={[-width/2 + 0.05, 0, -depth/2 + 0.05]} rotation={[0, Math.PI/2, 0]}>
          <PDUVertical height={height * 0.6} outletCount={10} color={frameColor} />
        </group>
      )}

      {/* PDU 20-Way Vertical - right rear */}
      {hasPDU20V && (
        <group position={[width/2 - 0.05, 0, -depth/2 + 0.05]} rotation={[0, -Math.PI/2, 0]}>
          <PDUVertical height={height * 0.85} outletCount={20} color={frameColor} />
        </group>
      )}

      {/* Stabiliser Kit - rear base */}
      {hasStabiliser && (
        <group position={[0, -height/2 - 0.01, -depth/2]}>
          <StabiliserKit width={width} depth={depth} color={frameColor} />
        </group>
      )}

      {/* Baying Kit - side connectors (shown on right side) */}
      {hasBayingKit && (
        <group position={[width/2 + 0.01, 0, 0]}>
          <BayingKit height={height} />
        </group>
      )}
    </group>
  );
};

/**
 * Cable Chimney Component - Top-mounted cable exit (simple version)
 */
const CableChimney = ({ 
  position, 
  width = 0.3, 
  depth = 0.25,
  color = COLORS.MANNEX_BLACK 
}: { 
  position: [number, number, number];
  width?: number;
  depth?: number;
  color?: string;
}) => (
  <group position={position}>
    {/* Main chimney body - open top box */}
    <mesh position={[0, 0.075, 0]}>
      <boxGeometry args={[width, 0.15, depth]} />
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
    </mesh>
    {/* Opening cutout indicator */}
    <mesh position={[0, 0.155, 0]}>
      <boxGeometry args={[width - 0.02, 0.01, depth - 0.02]} />
      <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.1} />
    </mesh>
    {/* Cable entry slots */}
    {[-1, 1].map((side, i) => (
      <mesh key={`slot-${i}`} position={[side * (width/2 - 0.02), 0.05, 0]}>
        <boxGeometry args={[0.01, 0.08, depth - 0.04]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
      </mesh>
    ))}
  </group>
);

/**
 * Corner Chimney Tower - Tall hollow post at corners for cable routing
 * These extend above the rack and have openings for cable egress
 */
const CornerChimneyTower = ({ 
  position, 
  rackHeight,
  towerHeight = 0.35, // Height above rack
  size = 0.1, // Square size
  color = COLORS.MANNEX_BLACK 
}: { 
  position: [number, number, number];
  rackHeight: number;
  towerHeight?: number;
  size?: number;
  color?: string;
}) => {
  const totalHeight = rackHeight + towerHeight;
  const wallThickness = 0.004;
  
  return (
    <group position={position}>
      {/* Tower walls - hollow square post */}
      {/* Front wall */}
      <mesh position={[0, towerHeight/2, size/2 - wallThickness/2]}>
        <boxGeometry args={[size, totalHeight, wallThickness]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, towerHeight/2, -size/2 + wallThickness/2]}>
        <boxGeometry args={[size, totalHeight, wallThickness]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-size/2 + wallThickness/2, towerHeight/2, 0]}>
        <boxGeometry args={[wallThickness, totalHeight, size - wallThickness * 2]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Right wall */}
      <mesh position={[size/2 - wallThickness/2, towerHeight/2, 0]}>
        <boxGeometry args={[wallThickness, totalHeight, size - wallThickness * 2]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Top cap with opening */}
      <mesh position={[0, totalHeight/2 + towerHeight/2 - 0.01, 0]}>
        <boxGeometry args={[size, 0.02, size]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Cable entry slots on sides */}
      {[
        [0, -rackHeight/4, size/2],
        [0, -rackHeight/4, -size/2],
        [size/2, -rackHeight/4, 0],
        [-size/2, -rackHeight/4, 0],
      ].map((pos, i) => (
        <mesh key={`slot-${i}`} position={pos as [number, number, number]} rotation={[0, i < 2 ? 0 : Math.PI/2, 0]}>
          <boxGeometry args={[size * 0.6, rackHeight * 0.4, 0.002]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
};

/**
 * Cable Slack Spool - Cable management spool
 */
const SlackSpool = ({ 
  position, 
  diameter = 0.195,
  color = COLORS.MANNEX_BLACK 
}: { 
  position: [number, number, number];
  diameter?: number;
  color?: string;
}) => (
  <group position={position}>
    {/* Spool drum */}
    <mesh rotation={[0, 0, Math.PI/2]}>
      <cylinderGeometry args={[diameter/2, diameter/2, 0.04, 24]} />
      <meshStandardMaterial color={color} roughness={0.5} metalness={0.4} />
    </mesh>
    {/* Spool flanges */}
    {[-0.025, 0.025].map((x, i) => (
      <mesh key={`flange-${i}`} position={[x, 0, 0]} rotation={[0, 0, Math.PI/2]}>
        <cylinderGeometry args={[diameter/2 + 0.015, diameter/2 + 0.015, 0.005, 24]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.4} />
      </mesh>
    ))}
    {/* Mounting bracket */}
    <mesh position={[0.04, 0, 0]}>
      <boxGeometry args={[0.03, 0.06, 0.03]} />
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
    </mesh>
  </group>
);

/**
 * 40 Series Open Frame Rack
 * Open design with posts, extensive cable management options
 */
const Series40Rack = ({ config, product, doorsOpen = false }: { config: ConfigurationState; product: ProductDefinition; doorsOpen?: boolean }) => {
  const ruHeightMatch = String(config.selections['ru-height'] || 'ru-45').match(/ru-(\d+)/);
  const ruHeight = ruHeightMatch ? parseInt(ruHeightMatch[1]) : 45;
  
  const widthMatch = String(config.selections['width'] || 'width-600').match(/width-(\d+)/);
  const widthMm = widthMatch ? parseInt(widthMatch[1]) : 600;
  
  const depthMatch = String(config.selections['depth'] || 'depth-800').match(/depth-(\d+)/);
  const depthMm = depthMatch ? parseInt(depthMatch[1]) : 800;
  
  const postType = config.selections['post-type'] || 'post-4';
  const is2Post = postType === 'post-2' || postType?.includes?.('2');
  
  const height = (ruHeight * RU_HEIGHT_MM + 100) / 1000;
  const width = widthMm / 1000;
  // Both 2-post and 4-post use selected depth (default 600mm if not set)
  // 2-post reduced by 40% to match reference proportions
  const baseDepth = (depthMm || 600) / 1000;
  const depth = is2Post ? baseDepth * 0.6 : baseDepth;
  
  const postSize = 0.05;
  const frameColor = resolveSelectedColour(product, config.selections, 'frame-colour', COLORS.MANNEX_BLACK);
  
  // Accessories
  const accessories = config.selections['accessories'] as Record<string, number> || {};
  
  // VCM detection - check both depth variants for each width
  const hasVCM150_250 = (accessories['acc-vcm-150-250'] || 0) > 0;
  const hasVCM150_450 = (accessories['acc-vcm-150-450'] || 0) > 0;
  const hasVCM300_250 = (accessories['acc-vcm-300-250'] || 0) > 0;
  const hasVCM300_450 = (accessories['acc-vcm-300-450'] || 0) > 0;
  const hasVCM400_250 = (accessories['acc-vcm-400-250'] || 0) > 0;
  const hasVCM400_450 = (accessories['acc-vcm-400-450'] || 0) > 0;
  
  const hasVCM150 = hasVCM150_250 || hasVCM150_450;
  const hasVCM300 = hasVCM300_250 || hasVCM300_450;
  const hasVCM400 = hasVCM400_250 || hasVCM400_450;
  
  const cableChimneyCount = accessories['acc-chimney'] || accessories['acc-cable-chimney'] || 0;
  const hasCableChimney = cableChimneyCount > 0;
  const hasCableShield = (accessories['acc-cable-shield'] || 0) > 0;
  const slackSpool195Count = accessories['acc-slack-spool-195'] || accessories['acc-slack-spool'] || 0;
  const slackSpool125Count = accessories['acc-slack-spool-125'] || 0;
  const hasFingerManager = (accessories['acc-finger-manager'] || 0) > 0;
  const hasCableLadder = (accessories['acc-cable-ladder'] || 0) > 0;
  const hasCastors = (accessories['acc-castors'] || 0) > 0;
  const hasBoltDownBracket = (accessories['acc-bolt-down-bracket'] || 0) > 0;
  const fixedShelfCount = accessories['acc-shelf-fixed'] || 0;
  const slidingShelfCount = accessories['acc-shelf-sliding'] || 0;
  const pdu6Count = accessories['acc-pdu-6'] || 0;
  const pdu10vCount = accessories['acc-pdu-10-v'] || 0;
  
  // Side panel option (optional for open frame)
  const sidePanelType = config.selections['side-panel'] || 'panel-none';
  const hasSidePanels = sidePanelType !== 'panel-none' && !sidePanelType?.includes?.('none');
  
  // VCM width selection (priority: 400mm > 300mm > 150mm)
  const vcmWidth = hasVCM400 ? 0.4 : hasVCM300 ? 0.3 : hasVCM150 ? 0.15 : 0;
  // VCM depth based on selected variant (450mm or 250mm)
  const vcmDepth = (hasVCM150_450 || hasVCM300_450 || hasVCM400_450) ? 0.45 : 0.25;
  
  return (
    <group position={[0, height/2 + (hasCastors ? 0.06 : 0.04), 0]}>
      {/* Posts */}
      {is2Post ? (
        // 2-Post Frame with Side VCM Cabinets
        <>
          {/* Side cabinet width - VCM cabinets on each side */}
          {(() => {
            const sideCabinetWidth = vcmWidth > 0 ? vcmWidth + 0.05 : 0.2; // VCM width + frame, or default 200mm
            const centerWidth = RACK_19_INCH_MM/1000 + 0.01; // 19" + minimal margin
            const totalWidth = centerWidth + sideCabinetWidth * 2;
            
            return (
              <>
                {/* LEFT VCM CABINET */}
                <group position={[-(centerWidth/2 + sideCabinetWidth/2), 0, 0]}>
                  {/* Cabinet box */}
                  {/* Outer side */}
                  <mesh position={[-sideCabinetWidth/2 + 0.002, 0, 0]} castShadow>
                    <boxGeometry args={[0.003, height, depth]} />
                    <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} />
                  </mesh>
                  {/* Inner side */}
                  <mesh position={[sideCabinetWidth/2 - 0.002, 0, 0]} castShadow>
                    <boxGeometry args={[0.003, height, depth]} />
                    <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} />
                  </mesh>
                  {/* Back */}
                  <mesh position={[0, 0, -depth/2 + 0.002]}>
                    <boxGeometry args={[sideCabinetWidth, height, 0.003]} />
                    <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} />
                  </mesh>
                  {/* Top - OPEN with rails around edge */}
                  {/* Front rail */}
                  <mesh position={[0, height/2 - 0.01, depth/2 - 0.015]}>
                    <boxGeometry args={[sideCabinetWidth, 0.02, 0.03]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                  </mesh>
                  {/* Back rail */}
                  <mesh position={[0, height/2 - 0.01, -depth/2 + 0.015]}>
                    <boxGeometry args={[sideCabinetWidth, 0.02, 0.03]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                  </mesh>
                  {/* Left rail */}
                  <mesh position={[-sideCabinetWidth/2 + 0.015, height/2 - 0.01, 0]}>
                    <boxGeometry args={[0.03, 0.02, depth]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                  </mesh>
                  {/* Right rail */}
                  <mesh position={[sideCabinetWidth/2 - 0.015, height/2 - 0.01, 0]}>
                    <boxGeometry args={[0.03, 0.02, depth]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                  </mesh>
                  {/* Bottom */}
                  <mesh position={[0, -height/2 + 0.015, 0]}>
                    <boxGeometry args={[sideCabinetWidth, 0.03, depth]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                  </mesh>
                  {/* Front Door */}
                  <group 
                    position={[-sideCabinetWidth/2 + 0.003, 0, depth/2]}
                    rotation={[0, doorsOpen ? -Math.PI * 0.6 : 0, 0]}
                  >
                    <group position={[sideCabinetWidth/2, 0, 0]}>
                      <mesh castShadow>
                        <boxGeometry args={[sideCabinetWidth - 0.01, height - 0.02, 0.003]} />
                        <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} />
                      </mesh>
                      {/* Two small round locks - horizontal across middle, near edges */}
                      {/* Left lock */}
                      <group position={[-0.07, 0, 0.005]}>
                        <mesh rotation={[Math.PI/2, 0, 0]}>
                          <cylinderGeometry args={[0.012, 0.012, 0.008, 16]} />
                          <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.7} />
                        </mesh>
                        {/* Keyhole */}
                        <mesh position={[0, 0, 0.005]} rotation={[Math.PI/2, 0, 0]}>
                          <cylinderGeometry args={[0.003, 0.003, 0.003, 8]} />
                          <meshStandardMaterial color="#c4a052" roughness={0.3} metalness={0.8} />
                        </mesh>
                      </group>
                      {/* Right lock */}
                      <group position={[0.07, 0, 0.005]}>
                        <mesh rotation={[Math.PI/2, 0, 0]}>
                          <cylinderGeometry args={[0.012, 0.012, 0.008, 16]} />
                          <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.7} />
                        </mesh>
                        {/* Keyhole */}
                        <mesh position={[0, 0, 0.005]} rotation={[Math.PI/2, 0, 0]}>
                          <cylinderGeometry args={[0.003, 0.003, 0.003, 8]} />
                          <meshStandardMaterial color="#c4a052" roughness={0.3} metalness={0.8} />
                        </mesh>
                      </group>
                    </group>
                  </group>
                  {/* Chimney tower on top - 50% depth, at the BACK - ALL SIDES CLOSED, TOP OPEN */}
                  <group position={[0, height/2 + 0.2, -depth/4]}>
                    {/* Front wall */}
                    <mesh position={[0, 0, depth/4 - 0.002]}>
                      <boxGeometry args={[sideCabinetWidth, 0.4, 0.003]} />
                      <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                    </mesh>
                    {/* Back wall */}
                    <mesh position={[0, 0, -depth/4 + 0.002]}>
                      <boxGeometry args={[sideCabinetWidth, 0.4, 0.003]} />
                      <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                    </mesh>
                    {/* Outer side wall (left) */}
                    <mesh position={[-sideCabinetWidth/2 + 0.002, 0, 0]}>
                      <boxGeometry args={[0.003, 0.4, depth/2]} />
                      <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                    </mesh>
                    {/* Inner side wall (right) */}
                    <mesh position={[sideCabinetWidth/2 - 0.002, 0, 0]}>
                      <boxGeometry args={[0.003, 0.4, depth/2]} />
                      <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                    </mesh>
                    {/* NO top cap - open top */}
                  </group>
                  {/* Internal VCM finger slots */}
                  <VerticalCableManager 
                    position={[0, 0, 0]} 
                    height={height - 0.1} 
                    width={sideCabinetWidth - 0.04}
                    depth={depth - 0.05}
                    color={COLORS.MANNEX_BLACK}
                  />
                </group>
                
                {/* RIGHT VCM CABINET */}
                <group position={[(centerWidth/2 + sideCabinetWidth/2), 0, 0]}>
                  {/* Cabinet box */}
                  {/* Inner side */}
                  <mesh position={[-sideCabinetWidth/2 + 0.002, 0, 0]} castShadow>
                    <boxGeometry args={[0.003, height, depth]} />
                    <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} />
                  </mesh>
                  {/* Outer side */}
                  <mesh position={[sideCabinetWidth/2 - 0.002, 0, 0]} castShadow>
                    <boxGeometry args={[0.003, height, depth]} />
                    <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} />
                  </mesh>
                  {/* Back */}
                  <mesh position={[0, 0, -depth/2 + 0.002]}>
                    <boxGeometry args={[sideCabinetWidth, height, 0.003]} />
                    <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} />
                  </mesh>
                  {/* Top - OPEN with rails around edge */}
                  {/* Front rail */}
                  <mesh position={[0, height/2 - 0.01, depth/2 - 0.015]}>
                    <boxGeometry args={[sideCabinetWidth, 0.02, 0.03]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                  </mesh>
                  {/* Back rail */}
                  <mesh position={[0, height/2 - 0.01, -depth/2 + 0.015]}>
                    <boxGeometry args={[sideCabinetWidth, 0.02, 0.03]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                  </mesh>
                  {/* Left rail */}
                  <mesh position={[-sideCabinetWidth/2 + 0.015, height/2 - 0.01, 0]}>
                    <boxGeometry args={[0.03, 0.02, depth]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                  </mesh>
                  {/* Right rail */}
                  <mesh position={[sideCabinetWidth/2 - 0.015, height/2 - 0.01, 0]}>
                    <boxGeometry args={[0.03, 0.02, depth]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                  </mesh>
                  {/* Bottom */}
                  <mesh position={[0, -height/2 + 0.015, 0]}>
                    <boxGeometry args={[sideCabinetWidth, 0.03, depth]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                  </mesh>
                  {/* Front Door */}
                  <group 
                    position={[sideCabinetWidth/2 - 0.003, 0, depth/2]}
                    rotation={[0, doorsOpen ? Math.PI * 0.6 : 0, 0]}
                  >
                    <group position={[-sideCabinetWidth/2, 0, 0]}>
                      <mesh castShadow>
                        <boxGeometry args={[sideCabinetWidth - 0.01, height - 0.02, 0.003]} />
                        <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} />
                      </mesh>
                      {/* Two small round locks - horizontal across middle, near edges */}
                      {/* Left lock */}
                      <group position={[-0.07, 0, 0.005]}>
                        <mesh rotation={[Math.PI/2, 0, 0]}>
                          <cylinderGeometry args={[0.012, 0.012, 0.008, 16]} />
                          <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.7} />
                        </mesh>
                        {/* Keyhole */}
                        <mesh position={[0, 0, 0.005]} rotation={[Math.PI/2, 0, 0]}>
                          <cylinderGeometry args={[0.003, 0.003, 0.003, 8]} />
                          <meshStandardMaterial color="#c4a052" roughness={0.3} metalness={0.8} />
                        </mesh>
                      </group>
                      {/* Right lock */}
                      <group position={[0.07, 0, 0.005]}>
                        <mesh rotation={[Math.PI/2, 0, 0]}>
                          <cylinderGeometry args={[0.012, 0.012, 0.008, 16]} />
                          <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.7} />
                        </mesh>
                        {/* Keyhole */}
                        <mesh position={[0, 0, 0.005]} rotation={[Math.PI/2, 0, 0]}>
                          <cylinderGeometry args={[0.003, 0.003, 0.003, 8]} />
                          <meshStandardMaterial color="#c4a052" roughness={0.3} metalness={0.8} />
                        </mesh>
                      </group>
                    </group>
                  </group>
                  {/* Chimney tower on top - 50% depth, at the BACK - ALL SIDES CLOSED, TOP OPEN */}
                  <group position={[0, height/2 + 0.2, -depth/4]}>
                    {/* Front wall */}
                    <mesh position={[0, 0, depth/4 - 0.002]}>
                      <boxGeometry args={[sideCabinetWidth, 0.4, 0.003]} />
                      <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                    </mesh>
                    {/* Back wall */}
                    <mesh position={[0, 0, -depth/4 + 0.002]}>
                      <boxGeometry args={[sideCabinetWidth, 0.4, 0.003]} />
                      <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                    </mesh>
                    {/* Outer side wall (right) */}
                    <mesh position={[sideCabinetWidth/2 - 0.002, 0, 0]}>
                      <boxGeometry args={[0.003, 0.4, depth/2]} />
                      <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                    </mesh>
                    {/* Inner side wall (left) */}
                    <mesh position={[-sideCabinetWidth/2 + 0.002, 0, 0]}>
                      <boxGeometry args={[0.003, 0.4, depth/2]} />
                      <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                    </mesh>
                    {/* NO top cap - open top */}
                  </group>
                  {/* Internal VCM finger slots */}
                  <VerticalCableManager 
                    position={[0, 0, 0]} 
                    height={height - 0.1} 
                    width={sideCabinetWidth - 0.04}
                    depth={depth - 0.05}
                    color={COLORS.MANNEX_BLACK}
                  />
                </group>
                
                {/* CENTER OPEN FRAME - Cage structure with mounting rails */}
                <group position={[0, 0, 0]}>
                  {/* Cage vertical posts at corners - hollow tubes (4 walls, open top) */}
                  {[
                    [-centerWidth/2 + 0.015, depth/2 - 0.015],
                    [centerWidth/2 - 0.015, depth/2 - 0.015],
                    [-centerWidth/2 + 0.015, -depth/2 + 0.015],
                    [centerWidth/2 - 0.015, -depth/2 + 0.015],
                  ].map(([x, z], i) => (
                    <group key={`cage-post-${i}`} position={[x, 0, z]}>
                      {/* Front wall */}
                      <mesh position={[0, 0, 0.014]}>
                        <boxGeometry args={[0.03, height - 0.02, 0.002]} />
                        <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                      </mesh>
                      {/* Back wall */}
                      <mesh position={[0, 0, -0.014]}>
                        <boxGeometry args={[0.03, height - 0.02, 0.002]} />
                        <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                      </mesh>
                      {/* Left wall */}
                      <mesh position={[-0.014, 0, 0]}>
                        <boxGeometry args={[0.002, height - 0.02, 0.03]} />
                        <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                      </mesh>
                      {/* Right wall */}
                      <mesh position={[0.014, 0, 0]}>
                        <boxGeometry args={[0.002, height - 0.02, 0.03]} />
                        <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                      </mesh>
                      {/* NO top - open */}
                    </group>
                  ))}
                  
                  {/* NO top horizontal bars - posts open at top */}
                  
                  {/* Cage horizontal bars - bottom */}
                  <mesh position={[0, -height/2 + 0.02, depth/2 - 0.015]}>
                    <boxGeometry args={[centerWidth, 0.025, 0.025]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                  </mesh>
                  <mesh position={[0, -height/2 + 0.02, -depth/2 + 0.015]}>
                    <boxGeometry args={[centerWidth, 0.025, 0.025]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                  </mesh>
                  <mesh position={[-centerWidth/2 + 0.015, -height/2 + 0.02, 0]}>
                    <boxGeometry args={[0.025, 0.025, depth]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                  </mesh>
                  <mesh position={[centerWidth/2 - 0.015, -height/2 + 0.02, 0]}>
                    <boxGeometry args={[0.025, 0.025, depth]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                  </mesh>
                  
                  {/* Cage cross bar - higher and wider */}
                  <mesh position={[0, height/4, depth/2 - 0.015]}>
                    <boxGeometry args={[centerWidth + 0.04, 0.04, 0.04]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                  </mesh>
                  <mesh position={[0, height/4, -depth/2 + 0.015]}>
                    <boxGeometry args={[centerWidth + 0.04, 0.04, 0.04]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                  </mesh>
                  
                  {/* Mounting Rails - 19" standard inside cage */}
                  <MountingRail height={height - 0.1} ruCount={ruHeight} position={[-RACK_19_INCH_MM/2000, 0, depth/4]} />
                  <MountingRail height={height - 0.1} ruCount={ruHeight} position={[RACK_19_INCH_MM/2000, 0, depth/4]} />
                  <MountingRail height={height - 0.1} ruCount={ruHeight} position={[-RACK_19_INCH_MM/2000, 0, -depth/4]} />
                  <MountingRail height={height - 0.1} ruCount={ruHeight} position={[RACK_19_INCH_MM/2000, 0, -depth/4]} />
                </group>
                
                {/* Cable Walkway Bridge - Upside-down U arch shape */}
                <group position={[0, height/2 + 0.02, depth/4]}>
                  {/* Arch top (horizontal span) */}
                  <mesh position={[0, 0.08, 0]}>
                    <boxGeometry args={[centerWidth + 0.02, 0.015, 0.12]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                  </mesh>
                  
                  {/* Left vertical leg of arch */}
                  <mesh position={[-(centerWidth/2 + 0.01), 0.04, 0]}>
                    <boxGeometry args={[0.015, 0.1, 0.12]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                  </mesh>
                  
                  {/* Right vertical leg of arch */}
                  <mesh position={[(centerWidth/2 + 0.01), 0.04, 0]}>
                    <boxGeometry args={[0.015, 0.1, 0.12]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                  </mesh>
                  
                  {/* Front rail on arch top */}
                  <mesh position={[0, 0.1, 0.055]}>
                    <boxGeometry args={[centerWidth + 0.04, 0.025, 0.01]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                  </mesh>
                  {/* Back rail on arch top */}
                  <mesh position={[0, 0.1, -0.055]}>
                    <boxGeometry args={[centerWidth + 0.04, 0.025, 0.01]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                  </mesh>
                  
                </group>
              </>
            );
          })()}
        </>
      ) : (
        // 4-Post Frame - 4 corner BOXES, back 2 have chimneys, solid outer panels, mesh inner panels
        <>
          {(() => {
            const boxWidth = 0.25; // Corner box width FIXED at 250mm
            const boxDepth = 0.25; // Corner box depth FIXED at 250mm
            const centerWidth = RACK_19_INCH_MM/1000 + 0.01;
            const chimneyHeight = 0.4; // Extra height for back chimneys
            // VCM dimensions only affect the cable ladder and internal VCM - not box sizes
            
            // Total width from outer left to outer right
            const totalWidth = centerWidth + boxWidth * 2;
            
            return (
              <>
                {/* === PILLAR 1: BACK-LEFT BOX with CHIMNEY and DOOR === */}
                <group position={[-centerWidth/2 - boxWidth/2, 0, -depth/2 + boxDepth/2]}>
                  {/* Box walls - outer side, front solid (back is door) */}
                  <mesh position={[-boxWidth/2 + 0.002, 0, 0]} castShadow><boxGeometry args={[0.003, height, boxDepth]} /><meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} /></mesh>
                  <mesh position={[0, 0, boxDepth/2 - 0.002]} castShadow><boxGeometry args={[boxWidth, height, 0.003]} /><meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} /></mesh>
                  {/* Inner wall facing gap - HORIZONTAL MESH */}
                  <group position={[boxWidth/2 - 0.002, 0, 0]}>
                    {Array.from({ length: Math.floor(height / 0.06) }).map((_, i) => (
                      <mesh key={`bl-bar-${i}`} position={[0, -height/2 + 0.03 + i * 0.06, 0]}>
                        <boxGeometry args={[0.003, 0.015, boxDepth - 0.02]} />
                        <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                      </mesh>
                    ))}
                  </group>
                  <mesh position={[0, -height/2 + 0.015, 0]}><boxGeometry args={[boxWidth, 0.03, boxDepth]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  {/* Top edge rails */}
                  <mesh position={[0, height/2 - 0.01, boxDepth/2 - 0.015]}><boxGeometry args={[boxWidth, 0.02, 0.03]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  <mesh position={[0, height/2 - 0.01, -boxDepth/2 + 0.015]}><boxGeometry args={[boxWidth, 0.02, 0.03]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  <mesh position={[-boxWidth/2 + 0.015, height/2 - 0.01, 0]}><boxGeometry args={[0.03, 0.02, boxDepth]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  <mesh position={[boxWidth/2 - 0.015, height/2 - 0.01, 0]}><boxGeometry args={[0.03, 0.02, boxDepth]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  {/* Fixed Shelf in pillar 1 */}
                  {fixedShelfCount >= 1 && (
                    <group position={[0, -height/4, 0]}>
                      <mesh><boxGeometry args={[boxWidth - 0.02, 0.015, boxDepth - 0.02]} /><meshStandardMaterial color={COLORS.MANNEX_BLACK} roughness={0.6} metalness={0.3} /></mesh>
                    </group>
                  )}
                  {/* Sliding Shelf in pillar 1 */}
                  {slidingShelfCount >= 1 && (
                    <group position={[0, height/4, doorsOpen ? -0.08 : 0]}>
                      <mesh><boxGeometry args={[boxWidth - 0.02, 0.015, boxDepth - 0.02]} /><meshStandardMaterial color="#333333" roughness={0.5} metalness={0.4} /></mesh>
                    </group>
                  )}
                  {/* PDU 10-Way Vertical in pillar 1 - inner front corner, facing center gap */}
                  {pdu10vCount >= 1 && (
                    <group position={[boxWidth/2 - 0.04, 0, boxDepth/2 - 0.04]} rotation={[0, Math.PI * 3/4, 0]}>
                      <mesh><boxGeometry args={[0.03, height * 0.6, 0.04]} /><meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.3} /></mesh>
                      {Array.from({ length: 10 }).map((_, j) => (
                        <mesh key={`p1-outlet-${j}`} position={[0.016, -height * 0.25 + j * (height * 0.5 / 9), 0]}>
                          <boxGeometry args={[0.002, 0.03, 0.025]} />
                          <meshStandardMaterial color="#444444" roughness={0.5} />
                        </mesh>
                      ))}
                    </group>
                  )}
                  {/* Back Door - hinges on outer left edge, opens outward */}
                  <group position={[-boxWidth/2 + 0.003, 0, -boxDepth/2]} rotation={[0, doorsOpen ? Math.PI * 0.6 : 0, 0]}>
                    <group position={[boxWidth/2, 0, 0]}>
                      <mesh castShadow><boxGeometry args={[boxWidth - 0.01, height - 0.02, 0.003]} /><meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} /></mesh>
                      <group position={[-0.07, 0, -0.005]}><mesh rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.012, 0.012, 0.008, 16]} /><meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.7} /></mesh></group>
                      <group position={[0.07, 0, -0.005]}><mesh rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.012, 0.012, 0.008, 16]} /><meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.7} /></mesh></group>
                    </group>
                  </group>
                  {/* Chimney on top - shows when Cable Chimney count >= 1 */}
                  {cableChimneyCount >= 1 && (
                    <group position={[0, height/2 + chimneyHeight/2, 0]}>
                      <mesh position={[0, 0, boxDepth/2 - 0.002]}><boxGeometry args={[boxWidth, chimneyHeight, 0.003]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                      <mesh position={[0, 0, -boxDepth/2 + 0.002]}><boxGeometry args={[boxWidth, chimneyHeight, 0.003]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                      <mesh position={[-boxWidth/2 + 0.002, 0, 0]}><boxGeometry args={[0.003, chimneyHeight, boxDepth]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                      <mesh position={[boxWidth/2 - 0.002, 0, 0]}><boxGeometry args={[0.003, chimneyHeight, boxDepth]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                    </group>
                  )}
                </group>
                
                {/* === PILLAR 2: BACK-RIGHT BOX with CHIMNEY and DOOR === */}
                <group position={[centerWidth/2 + boxWidth/2, 0, -depth/2 + boxDepth/2]}>
                  {/* Box walls - outer side, front solid (back is door) */}
                  <mesh position={[boxWidth/2 - 0.002, 0, 0]} castShadow><boxGeometry args={[0.003, height, boxDepth]} /><meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} /></mesh>
                  <mesh position={[0, 0, boxDepth/2 - 0.002]} castShadow><boxGeometry args={[boxWidth, height, 0.003]} /><meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} /></mesh>
                  {/* Inner wall facing gap - HORIZONTAL MESH */}
                  <group position={[-boxWidth/2 + 0.002, 0, 0]}>
                    {Array.from({ length: Math.floor(height / 0.06) }).map((_, i) => (
                      <mesh key={`br-bar-${i}`} position={[0, -height/2 + 0.03 + i * 0.06, 0]}>
                        <boxGeometry args={[0.003, 0.015, boxDepth - 0.02]} />
                        <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                      </mesh>
                    ))}
                  </group>
                  <mesh position={[0, -height/2 + 0.015, 0]}><boxGeometry args={[boxWidth, 0.03, boxDepth]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  {/* Top edge rails */}
                  <mesh position={[0, height/2 - 0.01, boxDepth/2 - 0.015]}><boxGeometry args={[boxWidth, 0.02, 0.03]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  <mesh position={[0, height/2 - 0.01, -boxDepth/2 + 0.015]}><boxGeometry args={[boxWidth, 0.02, 0.03]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  <mesh position={[-boxWidth/2 + 0.015, height/2 - 0.01, 0]}><boxGeometry args={[0.03, 0.02, boxDepth]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  <mesh position={[boxWidth/2 - 0.015, height/2 - 0.01, 0]}><boxGeometry args={[0.03, 0.02, boxDepth]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  {/* Fixed Shelf in pillar 2 */}
                  {fixedShelfCount >= 2 && (
                    <group position={[0, -height/4, 0]}>
                      <mesh><boxGeometry args={[boxWidth - 0.02, 0.015, boxDepth - 0.02]} /><meshStandardMaterial color={COLORS.MANNEX_BLACK} roughness={0.6} metalness={0.3} /></mesh>
                    </group>
                  )}
                  {/* Sliding Shelf in pillar 2 */}
                  {slidingShelfCount >= 2 && (
                    <group position={[0, height/4, doorsOpen ? -0.08 : 0]}>
                      <mesh><boxGeometry args={[boxWidth - 0.02, 0.015, boxDepth - 0.02]} /><meshStandardMaterial color="#333333" roughness={0.5} metalness={0.4} /></mesh>
                    </group>
                  )}
                  {/* PDU 10-Way Vertical in pillar 2 - inner front corner, facing center gap */}
                  {pdu10vCount >= 2 && (
                    <group position={[-boxWidth/2 + 0.04, 0, boxDepth/2 - 0.04]} rotation={[0, -Math.PI * 3/4, 0]}>
                      <mesh><boxGeometry args={[0.03, height * 0.6, 0.04]} /><meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.3} /></mesh>
                      {Array.from({ length: 10 }).map((_, j) => (
                        <mesh key={`p2-outlet-${j}`} position={[-0.016, -height * 0.25 + j * (height * 0.5 / 9), 0]}>
                          <boxGeometry args={[0.002, 0.03, 0.025]} />
                          <meshStandardMaterial color="#444444" roughness={0.5} />
                        </mesh>
                      ))}
                    </group>
                  )}
                  {/* Back Door - hinges on outer right edge, opens outward */}
                  <group position={[boxWidth/2 - 0.003, 0, -boxDepth/2]} rotation={[0, doorsOpen ? -Math.PI * 0.6 : 0, 0]}>
                    <group position={[-boxWidth/2, 0, 0]}>
                      <mesh castShadow><boxGeometry args={[boxWidth - 0.01, height - 0.02, 0.003]} /><meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} /></mesh>
                      <group position={[-0.07, 0, -0.005]}><mesh rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.012, 0.012, 0.008, 16]} /><meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.7} /></mesh></group>
                      <group position={[0.07, 0, -0.005]}><mesh rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.012, 0.012, 0.008, 16]} /><meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.7} /></mesh></group>
                    </group>
                  </group>
                  {/* Chimney on top - shows when Cable Chimney count >= 2 */}
                  {cableChimneyCount >= 2 && (
                    <group position={[0, height/2 + chimneyHeight/2, 0]}>
                      <mesh position={[0, 0, boxDepth/2 - 0.002]}><boxGeometry args={[boxWidth, chimneyHeight, 0.003]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                      <mesh position={[0, 0, -boxDepth/2 + 0.002]}><boxGeometry args={[boxWidth, chimneyHeight, 0.003]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                      <mesh position={[-boxWidth/2 + 0.002, 0, 0]}><boxGeometry args={[0.003, chimneyHeight, boxDepth]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                      <mesh position={[boxWidth/2 - 0.002, 0, 0]}><boxGeometry args={[0.003, chimneyHeight, boxDepth]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                    </group>
                  )}
                </group>
                
                {/* === PILLAR 3: FRONT-LEFT BOX with DOOR === */}
                <group position={[-centerWidth/2 - boxWidth/2, 0, depth/2 - boxDepth/2]}>
                  {/* Box body - back and outer side solid */}
                  <mesh position={[0, 0, -boxDepth/2 + 0.002]} castShadow><boxGeometry args={[boxWidth, height, 0.003]} /><meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} /></mesh>
                  <mesh position={[-boxWidth/2 + 0.002, 0, 0]} castShadow><boxGeometry args={[0.003, height, boxDepth]} /><meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} /></mesh>
                  {/* Inner wall facing gap - HORIZONTAL MESH */}
                  <group position={[boxWidth/2 - 0.002, 0, 0]}>
                    {Array.from({ length: Math.floor(height / 0.06) }).map((_, i) => (
                      <mesh key={`fl-bar-${i}`} position={[0, -height/2 + 0.03 + i * 0.06, 0]}>
                        <boxGeometry args={[0.003, 0.015, boxDepth - 0.02]} />
                        <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                      </mesh>
                    ))}
                  </group>
                  <mesh position={[0, -height/2 + 0.015, 0]}><boxGeometry args={[boxWidth, 0.03, boxDepth]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  {/* Top edge rails */}
                  <mesh position={[0, height/2 - 0.01, boxDepth/2 - 0.015]}><boxGeometry args={[boxWidth, 0.02, 0.03]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  <mesh position={[0, height/2 - 0.01, -boxDepth/2 + 0.015]}><boxGeometry args={[boxWidth, 0.02, 0.03]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  <mesh position={[-boxWidth/2 + 0.015, height/2 - 0.01, 0]}><boxGeometry args={[0.03, 0.02, boxDepth]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  <mesh position={[boxWidth/2 - 0.015, height/2 - 0.01, 0]}><boxGeometry args={[0.03, 0.02, boxDepth]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  {/* Fixed Shelf in pillar 3 */}
                  {fixedShelfCount >= 3 && (
                    <group position={[0, -height/4, 0]}>
                      <mesh><boxGeometry args={[boxWidth - 0.02, 0.015, boxDepth - 0.02]} /><meshStandardMaterial color={COLORS.MANNEX_BLACK} roughness={0.6} metalness={0.3} /></mesh>
                    </group>
                  )}
                  {/* Sliding Shelf in pillar 3 */}
                  {slidingShelfCount >= 3 && (
                    <group position={[0, height/4, doorsOpen ? 0.08 : 0]}>
                      <mesh><boxGeometry args={[boxWidth - 0.02, 0.015, boxDepth - 0.02]} /><meshStandardMaterial color="#333333" roughness={0.5} metalness={0.4} /></mesh>
                    </group>
                  )}
                  {/* PDU 10-Way Vertical in pillar 3 - back corner at 45 degrees */}
                  {pdu10vCount >= 3 && (
                    <group position={[-boxWidth/2 + 0.04, 0, -boxDepth/2 + 0.04]} rotation={[0, -Math.PI/4, 0]}>
                      <mesh><boxGeometry args={[0.03, height * 0.6, 0.04]} /><meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.3} /></mesh>
                      {Array.from({ length: 10 }).map((_, j) => (
                        <mesh key={`p3-outlet-${j}`} position={[0.016, -height * 0.25 + j * (height * 0.5 / 9), 0]}>
                          <boxGeometry args={[0.002, 0.03, 0.025]} />
                          <meshStandardMaterial color="#444444" roughness={0.5} />
                        </mesh>
                      ))}
                    </group>
                  )}
                  {/* Front Door */}
                  <group position={[-boxWidth/2 + 0.003, 0, boxDepth/2]} rotation={[0, doorsOpen ? -Math.PI * 0.6 : 0, 0]}>
                    <group position={[boxWidth/2, 0, 0]}>
                      <mesh castShadow><boxGeometry args={[boxWidth - 0.01, height - 0.02, 0.003]} /><meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} /></mesh>
                      {/* Circle handles */}
                      <group position={[-0.07, 0, 0.005]}><mesh rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.012, 0.012, 0.008, 16]} /><meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.7} /></mesh></group>
                      <group position={[0.07, 0, 0.005]}><mesh rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.012, 0.012, 0.008, 16]} /><meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.7} /></mesh></group>
                    </group>
                  </group>
                </group>
                
                {/* === PILLAR 4: FRONT-RIGHT BOX with DOOR === */}
                <group position={[centerWidth/2 + boxWidth/2, 0, depth/2 - boxDepth/2]}>
                  {/* Box body - back and outer side solid */}
                  <mesh position={[0, 0, -boxDepth/2 + 0.002]} castShadow><boxGeometry args={[boxWidth, height, 0.003]} /><meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} /></mesh>
                  <mesh position={[boxWidth/2 - 0.002, 0, 0]} castShadow><boxGeometry args={[0.003, height, boxDepth]} /><meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} /></mesh>
                  {/* Inner wall facing gap - HORIZONTAL MESH */}
                  <group position={[-boxWidth/2 + 0.002, 0, 0]}>
                    {Array.from({ length: Math.floor(height / 0.06) }).map((_, i) => (
                      <mesh key={`fr-bar-${i}`} position={[0, -height/2 + 0.03 + i * 0.06, 0]}>
                        <boxGeometry args={[0.003, 0.015, boxDepth - 0.02]} />
                        <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                      </mesh>
                    ))}
                  </group>
                  <mesh position={[0, -height/2 + 0.015, 0]}><boxGeometry args={[boxWidth, 0.03, boxDepth]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  {/* Top edge rails */}
                  <mesh position={[0, height/2 - 0.01, boxDepth/2 - 0.015]}><boxGeometry args={[boxWidth, 0.02, 0.03]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  <mesh position={[0, height/2 - 0.01, -boxDepth/2 + 0.015]}><boxGeometry args={[boxWidth, 0.02, 0.03]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  <mesh position={[-boxWidth/2 + 0.015, height/2 - 0.01, 0]}><boxGeometry args={[0.03, 0.02, boxDepth]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  <mesh position={[boxWidth/2 - 0.015, height/2 - 0.01, 0]}><boxGeometry args={[0.03, 0.02, boxDepth]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  {/* Fixed Shelf in pillar 4 */}
                  {fixedShelfCount >= 4 && (
                    <group position={[0, -height/4, 0]}>
                      <mesh><boxGeometry args={[boxWidth - 0.02, 0.015, boxDepth - 0.02]} /><meshStandardMaterial color={COLORS.MANNEX_BLACK} roughness={0.6} metalness={0.3} /></mesh>
                    </group>
                  )}
                  {/* Sliding Shelf in pillar 4 */}
                  {slidingShelfCount >= 4 && (
                    <group position={[0, height/4, doorsOpen ? 0.08 : 0]}>
                      <mesh><boxGeometry args={[boxWidth - 0.02, 0.015, boxDepth - 0.02]} /><meshStandardMaterial color="#333333" roughness={0.5} metalness={0.4} /></mesh>
                    </group>
                  )}
                  {/* PDU 10-Way Vertical in pillar 4 - back corner at 45 degrees */}
                  {pdu10vCount >= 4 && (
                    <group position={[boxWidth/2 - 0.04, 0, -boxDepth/2 + 0.04]} rotation={[0, Math.PI/4, 0]}>
                      <mesh><boxGeometry args={[0.03, height * 0.6, 0.04]} /><meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.3} /></mesh>
                      {Array.from({ length: 10 }).map((_, j) => (
                        <mesh key={`p4-outlet-${j}`} position={[-0.016, -height * 0.25 + j * (height * 0.5 / 9), 0]}>
                          <boxGeometry args={[0.002, 0.03, 0.025]} />
                          <meshStandardMaterial color="#444444" roughness={0.5} />
                        </mesh>
                      ))}
                    </group>
                  )}
                  {/* Front Door */}
                  <group position={[boxWidth/2 - 0.003, 0, boxDepth/2]} rotation={[0, doorsOpen ? Math.PI * 0.6 : 0, 0]}>
                    <group position={[-boxWidth/2, 0, 0]}>
                      <mesh castShadow><boxGeometry args={[boxWidth - 0.01, height - 0.02, 0.003]} /><meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} /></mesh>
                      {/* Circle handles */}
                      <group position={[-0.07, 0, 0.005]}><mesh rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.012, 0.012, 0.008, 16]} /><meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.7} /></mesh></group>
                      <group position={[0.07, 0, 0.005]}><mesh rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.012, 0.012, 0.008, 16]} /><meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.7} /></mesh></group>
                    </group>
                  </group>
                </group>
                
                {/* === LEFT OUTER SIDE PANEL - SOLID === */}
                <mesh position={[-centerWidth/2 - boxWidth + 0.002, 0, 0]} castShadow>
                  <boxGeometry args={[0.003, height, depth - boxDepth * 2]} />
                  <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} />
                </mesh>
                
                {/* === RIGHT OUTER SIDE PANEL - SOLID === */}
                <mesh position={[centerWidth/2 + boxWidth - 0.002, 0, 0]} castShadow>
                  <boxGeometry args={[0.003, height, depth - boxDepth * 2]} />
                  <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} />
                </mesh>
                
                {/* === LEFT INNER MESH PANEL (facing center) === */}
                <group position={[-centerWidth/2 - 0.002, 0, 0]}>
                  {/* Frame */}
                  <mesh position={[0, height/2 - 0.015, 0]}><boxGeometry args={[0.02, 0.03, depth - boxDepth * 2]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  <mesh position={[0, -height/2 + 0.015, 0]}><boxGeometry args={[0.02, 0.03, depth - boxDepth * 2]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  <mesh position={[0, 0, (depth - boxDepth * 2)/2 - 0.015]}><boxGeometry args={[0.02, height - 0.06, 0.03]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  <mesh position={[0, 0, -(depth - boxDepth * 2)/2 + 0.015]}><boxGeometry args={[0.02, height - 0.06, 0.03]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  {/* Perforated mesh - grid of holes */}
                  {Array.from({ length: Math.floor((height - 0.1) / 0.05) }).map((_, row) => 
                    Array.from({ length: Math.floor((depth - boxDepth * 2 - 0.08) / 0.05) }).map((_, col) => (
                      <mesh key={`left-inner-hole-${row}-${col}`} position={[0, -height/2 + 0.06 + row * 0.05, -(depth - boxDepth * 2)/2 + 0.06 + col * 0.05]} rotation={[0, Math.PI/2, 0]}>
                        <ringGeometry args={[0.008, 0.015, 6]} />
                        <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} side={2} />
                      </mesh>
                    ))
                  ).flat()}
                  {/* Backing mesh panel */}
                  <mesh>
                    <boxGeometry args={[0.002, height - 0.08, depth - boxDepth * 2 - 0.06]} />
                    <meshStandardMaterial color={frameColor} roughness={0.8} metalness={0.2} transparent opacity={0.4} />
                  </mesh>
                </group>
                
                {/* === RIGHT INNER MESH PANEL (facing center) === */}
                <group position={[centerWidth/2 + 0.002, 0, 0]}>
                  {/* Frame */}
                  <mesh position={[0, height/2 - 0.015, 0]}><boxGeometry args={[0.02, 0.03, depth - boxDepth * 2]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  <mesh position={[0, -height/2 + 0.015, 0]}><boxGeometry args={[0.02, 0.03, depth - boxDepth * 2]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  <mesh position={[0, 0, (depth - boxDepth * 2)/2 - 0.015]}><boxGeometry args={[0.02, height - 0.06, 0.03]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  <mesh position={[0, 0, -(depth - boxDepth * 2)/2 + 0.015]}><boxGeometry args={[0.02, height - 0.06, 0.03]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  {/* Perforated mesh - grid of holes */}
                  {Array.from({ length: Math.floor((height - 0.1) / 0.05) }).map((_, row) => 
                    Array.from({ length: Math.floor((depth - boxDepth * 2 - 0.08) / 0.05) }).map((_, col) => (
                      <mesh key={`right-inner-hole-${row}-${col}`} position={[0, -height/2 + 0.06 + row * 0.05, -(depth - boxDepth * 2)/2 + 0.06 + col * 0.05]} rotation={[0, Math.PI/2, 0]}>
                        <ringGeometry args={[0.008, 0.015, 6]} />
                        <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} side={2} />
                      </mesh>
                    ))
                  ).flat()}
                  {/* Backing mesh panel */}
                  <mesh>
                    <boxGeometry args={[0.002, height - 0.08, depth - boxDepth * 2 - 0.06]} />
                    <meshStandardMaterial color={frameColor} roughness={0.8} metalness={0.2} transparent opacity={0.4} />
                  </mesh>
                </group>
                
                {/* === BOTTOM FRAME === */}
                <mesh position={[0, -height/2 + 0.015, 0]}>
                  <boxGeometry args={[centerWidth, 0.03, depth]} />
                  <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                </mesh>
                
                {/* CENTER CAGE */}
                <group position={[0, 0, 0]}>
                  {/* Posts */}
                  {[
                    [-centerWidth/2 + 0.015, depth/2 - 0.015],
                    [centerWidth/2 - 0.015, depth/2 - 0.015],
                    [-centerWidth/2 + 0.015, -depth/2 + 0.015],
                    [centerWidth/2 - 0.015, -depth/2 + 0.015],
                  ].map(([x, z], i) => (
                    <group key={`cage-post-${i}`} position={[x, 0, z]}>
                      <mesh position={[0, 0, 0.014]}><boxGeometry args={[0.03, height - 0.02, 0.002]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                      <mesh position={[0, 0, -0.014]}><boxGeometry args={[0.03, height - 0.02, 0.002]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                      <mesh position={[-0.014, 0, 0]}><boxGeometry args={[0.002, height - 0.02, 0.03]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                      <mesh position={[0.014, 0, 0]}><boxGeometry args={[0.002, height - 0.02, 0.03]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                    </group>
                  ))}
                  {/* Bottom bars */}
                  <mesh position={[0, -height/2 + 0.02, depth/2 - 0.015]}><boxGeometry args={[centerWidth, 0.025, 0.025]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  <mesh position={[0, -height/2 + 0.02, -depth/2 + 0.015]}><boxGeometry args={[centerWidth, 0.025, 0.025]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  <mesh position={[-centerWidth/2 + 0.015, -height/2 + 0.02, 0]}><boxGeometry args={[0.025, 0.025, depth]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  <mesh position={[centerWidth/2 - 0.015, -height/2 + 0.02, 0]}><boxGeometry args={[0.025, 0.025, depth]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  {/* Cross bars */}
                  <mesh position={[0, height/4, depth/2 - 0.015]}><boxGeometry args={[centerWidth + 0.04, 0.04, 0.04]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  <mesh position={[0, height/4, -depth/2 + 0.015]}><boxGeometry args={[centerWidth + 0.04, 0.04, 0.04]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                  {/* Mounting Rails */}
                  <MountingRail height={height - 0.1} ruCount={ruHeight} position={[-RACK_19_INCH_MM/2000, 0, depth/4]} />
                  <MountingRail height={height - 0.1} ruCount={ruHeight} position={[RACK_19_INCH_MM/2000, 0, depth/4]} />
                  <MountingRail height={height - 0.1} ruCount={ruHeight} position={[-RACK_19_INCH_MM/2000, 0, -depth/4]} />
                  <MountingRail height={height - 0.1} ruCount={ruHeight} position={[RACK_19_INCH_MM/2000, 0, -depth/4]} />
                </group>
                
                {/* Cable Ladder - width changes with VCM selection */}
                {(hasVCM150 || hasVCM300 || hasVCM400) && (() => {
                  const ladderWidth = vcmWidth > 0 ? vcmWidth : 0.15; // Use VCM width or default 150mm
                  return (
                    <group position={[0, height/2 + 0.02, depth/4]}>
                      {/* Top span */}
                      <mesh position={[0, 0.08, 0]}><boxGeometry args={[centerWidth + 0.02, 0.015, ladderWidth]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                      {/* Left leg */}
                      <mesh position={[-(centerWidth/2 + 0.01), 0.04, 0]}><boxGeometry args={[0.015, 0.1, ladderWidth]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                      {/* Right leg */}
                      <mesh position={[(centerWidth/2 + 0.01), 0.04, 0]}><boxGeometry args={[0.015, 0.1, ladderWidth]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                      {/* Front rail */}
                      <mesh position={[0, 0.1, ladderWidth/2 - 0.005]}><boxGeometry args={[centerWidth + 0.04, 0.025, 0.01]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                      {/* Back rail */}
                      <mesh position={[0, 0.1, -ladderWidth/2 + 0.005]}><boxGeometry args={[centerWidth + 0.04, 0.025, 0.01]} /><meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} /></mesh>
                      {/* Ladder rungs */}
                      {Array.from({ length: Math.floor(centerWidth / 0.08) }).map((_, i) => (
                        <mesh key={`rung-${i}`} position={[-centerWidth/2 + 0.04 + i * 0.08, 0.085, 0]}>
                          <boxGeometry args={[0.01, 0.01, ladderWidth - 0.02]} />
                          <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                        </mesh>
                      ))}
                    </group>
                  );
                })()}
              </>
            );
          })()}
        </>
      )}
      
      {/* Note: VCM is built into the corner boxes for 4-post, no separate VCM needed */}
      
      {/* PDU 6-Way Horizontal - distributed across 4 pillars, stacking 5-8 */}
      {(() => {
        const centerWidth = RACK_19_INCH_MM/1000 + 0.01;
        const boxWidth = 0.25;
        const boxDepth = 0.25;
        return (
          <>
      {/* Pillar 1 (back-left): PDU 1 and 5 */}
      {pdu6Count >= 1 && (
        <group position={[-centerWidth/2 - boxWidth/2, -height/4, -depth/2 + boxDepth/2]}>
          <mesh><boxGeometry args={[boxWidth - 0.03, 0.04, 0.04]} /><meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.3} /></mesh>
          {Array.from({ length: 6 }).map((_, j) => (
            <mesh key={`p1-h-outlet-${j}`} position={[-0.08 + j * 0.032, 0, 0.021]}><boxGeometry args={[0.025, 0.02, 0.002]} /><meshStandardMaterial color="#333333" /></mesh>
          ))}
        </group>
      )}
      {pdu6Count >= 5 && (
        <group position={[-centerWidth/2 - boxWidth/2, -height/4 + 0.08, -depth/2 + boxDepth/2]}>
          <mesh><boxGeometry args={[boxWidth - 0.03, 0.04, 0.04]} /><meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.3} /></mesh>
          {Array.from({ length: 6 }).map((_, j) => (
            <mesh key={`p1-h2-outlet-${j}`} position={[-0.08 + j * 0.032, 0, 0.021]}><boxGeometry args={[0.025, 0.02, 0.002]} /><meshStandardMaterial color="#333333" /></mesh>
          ))}
        </group>
      )}
      {/* Pillar 2 (back-right): PDU 2 and 6 */}
      {pdu6Count >= 2 && (
        <group position={[centerWidth/2 + boxWidth/2, -height/4, -depth/2 + boxDepth/2]}>
          <mesh><boxGeometry args={[boxWidth - 0.03, 0.04, 0.04]} /><meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.3} /></mesh>
          {Array.from({ length: 6 }).map((_, j) => (
            <mesh key={`p2-h-outlet-${j}`} position={[-0.08 + j * 0.032, 0, 0.021]}><boxGeometry args={[0.025, 0.02, 0.002]} /><meshStandardMaterial color="#333333" /></mesh>
          ))}
        </group>
      )}
      {pdu6Count >= 6 && (
        <group position={[centerWidth/2 + boxWidth/2, -height/4 + 0.08, -depth/2 + boxDepth/2]}>
          <mesh><boxGeometry args={[boxWidth - 0.03, 0.04, 0.04]} /><meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.3} /></mesh>
          {Array.from({ length: 6 }).map((_, j) => (
            <mesh key={`p2-h2-outlet-${j}`} position={[-0.08 + j * 0.032, 0, 0.021]}><boxGeometry args={[0.025, 0.02, 0.002]} /><meshStandardMaterial color="#333333" /></mesh>
          ))}
        </group>
      )}
      {/* Pillar 3 (front-left): PDU 3 and 7 */}
      {pdu6Count >= 3 && (
        <group position={[-centerWidth/2 - boxWidth/2, -height/4, depth/2 - boxDepth/2]}>
          <mesh><boxGeometry args={[boxWidth - 0.03, 0.04, 0.04]} /><meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.3} /></mesh>
          {Array.from({ length: 6 }).map((_, j) => (
            <mesh key={`p3-h-outlet-${j}`} position={[-0.08 + j * 0.032, 0, 0.021]}><boxGeometry args={[0.025, 0.02, 0.002]} /><meshStandardMaterial color="#333333" /></mesh>
          ))}
        </group>
      )}
      {pdu6Count >= 7 && (
        <group position={[-centerWidth/2 - boxWidth/2, -height/4 + 0.08, depth/2 - boxDepth/2]}>
          <mesh><boxGeometry args={[boxWidth - 0.03, 0.04, 0.04]} /><meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.3} /></mesh>
          {Array.from({ length: 6 }).map((_, j) => (
            <mesh key={`p3-h2-outlet-${j}`} position={[-0.08 + j * 0.032, 0, 0.021]}><boxGeometry args={[0.025, 0.02, 0.002]} /><meshStandardMaterial color="#333333" /></mesh>
          ))}
        </group>
      )}
      {/* Pillar 4 (front-right): PDU 4 and 8 */}
      {pdu6Count >= 4 && (
        <group position={[centerWidth/2 + boxWidth/2, -height/4, depth/2 - boxDepth/2]}>
          <mesh><boxGeometry args={[boxWidth - 0.03, 0.04, 0.04]} /><meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.3} /></mesh>
          {Array.from({ length: 6 }).map((_, j) => (
            <mesh key={`p4-h-outlet-${j}`} position={[-0.08 + j * 0.032, 0, 0.021]}><boxGeometry args={[0.025, 0.02, 0.002]} /><meshStandardMaterial color="#333333" /></mesh>
          ))}
        </group>
      )}
      {pdu6Count >= 8 && (
        <group position={[centerWidth/2 + boxWidth/2, -height/4 + 0.08, depth/2 - boxDepth/2]}>
          <mesh><boxGeometry args={[boxWidth - 0.03, 0.04, 0.04]} /><meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.3} /></mesh>
          {Array.from({ length: 6 }).map((_, j) => (
            <mesh key={`p4-h2-outlet-${j}`} position={[-0.08 + j * 0.032, 0, 0.021]}><boxGeometry args={[0.025, 0.02, 0.002]} /><meshStandardMaterial color="#333333" /></mesh>
          ))}
        </group>
      )}
          </>
        );
      })()}
      
      {/* Note: PDU 10-Way Vertical units are distributed across the 4 corner pillars */}
      
      {/* Cable Shield Assembly MK2 - Horizontal cable tray */}
      {!is2Post && hasCableShield && (
        <CableShieldAssembly 
          position={[0, height/2 - 0.08, 0]} 
          width={width - postSize * 2}
          depth={depth - postSize * 2}
          color={frameColor}
        />
      )}
      
      {/* Note: Cable Chimneys are now integrated as Corner Chimney Towers above */}
      
      {/* Cable Slack Spools 195mm */}
      {!is2Post && slackSpool195Count > 0 && (
        <>
          {Array.from({ length: Math.min(slackSpool195Count, 4) }).map((_, i) => {
            const side = i % 2 === 0 ? -1 : 1;
            const zPos = i < 2 ? depth/4 : -depth/4;
            return (
              <SlackSpool 
                key={`spool195-${i}`}
                position={[side * (width/2 + 0.08), height/4 - i * 0.25, zPos]}
                diameter={0.195}
                color={frameColor}
              />
            );
          })}
        </>
      )}
      
      {/* Cable Slack Spools 125mm */}
      {!is2Post && slackSpool125Count > 0 && (
        <>
          {Array.from({ length: Math.min(slackSpool125Count, 4) }).map((_, i) => {
            const side = i % 2 === 0 ? -1 : 1;
            const zPos = i < 2 ? -depth/4 : depth/4;
            return (
              <SlackSpool 
                key={`spool125-${i}`}
                position={[side * (width/2 + 0.06), -height/4 + i * 0.2, zPos]}
                diameter={0.125}
                color={frameColor}
              />
            );
          })}
        </>
      )}
      
      {/* Finger Manager / Horizontal Cable Manager */}
      {!is2Post && hasFingerManager && (
        <FingerManager 
          position={[0, height/2 - RU_HEIGHT_MM/1000, depth/2 - 0.1]}
          width={RACK_19_INCH_MM/1000}
        />
      )}
      
      {/* Cable Ladder */}
      {!is2Post && hasCableLadder && (
        <group position={[0, height/2 - 0.02, 0]}>
          {/* Ladder rails */}
          {[-1, 1].map((side, i) => (
            <mesh key={`ladder-rail-${i}`} position={[side * 0.15, 0, 0]}>
              <boxGeometry args={[0.03, 0.02, depth - 0.1]} />
              <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
            </mesh>
          ))}
          {/* Ladder rungs */}
          {Array.from({ length: Math.floor((depth - 0.1) / 0.1) }).map((_, i) => (
            <mesh key={`ladder-rung-${i}`} position={[0, 0.005, -depth/2 + 0.1 + i * 0.1]}>
              <boxGeometry args={[0.27, 0.01, 0.02]} />
              <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
            </mesh>
          ))}
        </group>
      )}
      
      {/* Optional Side Panels - Large panels between corner towers */}
      {!is2Post && hasSidePanels && (
        <>
          {[-1, 1].map((side, i) => (
            <group key={`side-panel-${i}`} position={[side * (width/2 + (hasCableChimney ? 0.05 : 0)), 0, 0]}>
              {/* Main side panel */}
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.003, height - 0.1, depth - (hasCableChimney ? 0.2 : 0.1)]} />
                <meshStandardMaterial color={frameColor} roughness={0.7} metalness={0.2} />
              </mesh>
              {/* Panel edge frame */}
              <mesh position={[side * 0.01, 0, 0]}>
                <boxGeometry args={[0.02, height - 0.12, 0.02]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
              </mesh>
              {/* Top edge */}
              <mesh position={[side * 0.005, height/2 - 0.06, 0]}>
                <boxGeometry args={[0.01, 0.02, depth - (hasCableChimney ? 0.22 : 0.12)]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
              </mesh>
              {/* Bottom edge */}
              <mesh position={[side * 0.005, -height/2 + 0.06, 0]}>
                <boxGeometry args={[0.01, 0.02, depth - (hasCableChimney ? 0.22 : 0.12)]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
              </mesh>
            </group>
          ))}
        </>
      )}
      
      {/* Bolt Down Brackets - Floor mounting (fixed position based on 4-post corner box width) */}
      {!is2Post && hasBoltDownBracket && (
        <>
          {[-1, 1].map((side, i) => {
            const fixedBoxWidth = 0.25; // Match the fixed corner box width
            const centerWidth = RACK_19_INCH_MM/1000 + 0.01;
            return (
              <group key={`bolt-bracket-${i}`} position={[side * (centerWidth/2 + fixedBoxWidth/2), -height/2 - 0.02, 0]}>
                {/* L-bracket base */}
                <mesh position={[0, 0, 0]}>
                  <boxGeometry args={[fixedBoxWidth + 0.04, 0.01, 0.15]} />
                  <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                </mesh>
                {/* Vertical tab */}
                <mesh position={[side * -0.02, 0.03, 0]}>
                  <boxGeometry args={[0.01, 0.06, 0.15]} />
                  <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
                </mesh>
                {/* Bolt holes (visual) */}
                {[-0.05, 0.05].map((z, j) => (
                  <mesh key={`bolt-${i}-${j}`} position={[0, 0.006, z]}>
                    <cylinderGeometry args={[0.008, 0.008, 0.002, 12]} />
                    <meshStandardMaterial color="#333333" roughness={0.8} />
                  </mesh>
                ))}
              </group>
            );
          })}
        </>
      )}
      
      {/* Levelling Feet or Castors */}
      {is2Post ? (
        <>
          {hasCastors ? (
            <>
              <Castor position={[-RACK_19_INCH_MM/2000 - postSize/2, -height/2 - 0.03, 0]} />
              <Castor position={[RACK_19_INCH_MM/2000 + postSize/2, -height/2 - 0.03, 0]} />
            </>
          ) : (
            <>
              <LevellingFoot position={[-RACK_19_INCH_MM/2000 - postSize/2, -height/2 - 0.01, 0]} />
              <LevellingFoot position={[RACK_19_INCH_MM/2000 + postSize/2, -height/2 - 0.01, 0]} />
            </>
          )}
        </>
      ) : (
        <>
          {hasCastors ? (
            <>
              <Castor position={[-width/2 + 0.05, -height/2 - 0.03, -depth/2 + 0.05]} />
              <Castor position={[width/2 - 0.05, -height/2 - 0.03, -depth/2 + 0.05]} />
              <Castor position={[-width/2 + 0.05, -height/2 - 0.03, depth/2 - 0.05]} />
              <Castor position={[width/2 - 0.05, -height/2 - 0.03, depth/2 - 0.05]} />
            </>
          ) : (
            <>
              <LevellingFoot position={[-width/2 + 0.05, -height/2 - 0.01, -depth/2 + 0.05]} />
              <LevellingFoot position={[width/2 - 0.05, -height/2 - 0.01, -depth/2 + 0.05]} />
              <LevellingFoot position={[-width/2 + 0.05, -height/2 - 0.01, depth/2 - 0.05]} />
              <LevellingFoot position={[width/2 - 0.05, -height/2 - 0.01, depth/2 - 0.05]} />
            </>
          )}
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
  const frameColor = resolveSelectedColour(product, config.selections, 'frame-colour', COLORS.MANNEX_BLACK);
  const doorColor = resolveSelectedColour(product, config.selections, 'door-colour', COLORS.MANNEX_BLACK);
  
  return (
    <group position={[0, height/2 + 0.02, 0]}>
      {/* Main enclosure body */}
      <mesh castShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
      </mesh>
      
      {/* Front door - perforated - hinged on left, swings outward */}
      <group position={[-width/2 + 0.01, 0, depth/2]}>
        <group rotation={[0, doorsOpen ? -Math.PI/2 : 0, 0]}>
          <group position={[(width - 0.02) / 2, 0, 0]}>
          <DoorPanel
            width={width - 0.02}
            height={height - 0.02}
            depth={0.002}
            variant={'perforated'}
            frontColor={doorColor}
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
    const [bgMode, setBgMode] = useState<'dark' | 'light' | 'photo'>('photo');
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
