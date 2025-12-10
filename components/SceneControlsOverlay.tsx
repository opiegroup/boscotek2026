import React, { useState, useEffect, useCallback, useRef } from 'react';

interface SceneControlsOverlayProps {
  controlsRef: React.MutableRefObject<any>;
}

const SceneControlsOverlay: React.FC<SceneControlsOverlayProps> = ({ controlsRef }) => {
  const [isPanning, setIsPanning] = useState(false);
  const [panDirection, setPanDirection] = useState<'up' | 'down' | 'left' | 'right' | null>(null);
  const panIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Pan step sizes
  const NUDGE_AMOUNT = 0.1;
  const PAN_SPEED = 0.05;

  // Pan the camera/target
  const pan = useCallback((deltaX: number, deltaY: number) => {
    if (!controlsRef.current) return;
    
    const controls = controlsRef.current;
    
    // Get the camera's right and up vectors
    const camera = controls.object;
    const offset = camera.position.clone().sub(controls.target);
    
    // Calculate pan vectors based on current camera orientation
    const panLeft = new (window as any).THREE.Vector3();
    panLeft.setFromMatrixColumn(camera.matrix, 0); // Get X column (right)
    panLeft.multiplyScalar(-deltaX);
    
    const panUp = new (window as any).THREE.Vector3();
    panUp.setFromMatrixColumn(camera.matrix, 1); // Get Y column (up)
    panUp.multiplyScalar(deltaY);
    
    // Apply pan to both camera and target to maintain the same view
    controls.target.add(panLeft).add(panUp);
    camera.position.add(panLeft).add(panUp);
    
    controls.update();
  }, [controlsRef]);

  // Handle single click (nudge)
  const handleNudge = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    switch (direction) {
      case 'left':
        pan(NUDGE_AMOUNT, 0);
        break;
      case 'right':
        pan(-NUDGE_AMOUNT, 0);
        break;
      case 'up':
        pan(0, NUDGE_AMOUNT);
        break;
      case 'down':
        pan(0, -NUDGE_AMOUNT);
        break;
    }
  }, [pan, NUDGE_AMOUNT]);

  // Start continuous panning
  const startPanning = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    setIsPanning(true);
    setPanDirection(direction);
  }, []);

  // Stop continuous panning
  const stopPanning = useCallback(() => {
    setIsPanning(false);
    setPanDirection(null);
    if (panIntervalRef.current) {
      clearInterval(panIntervalRef.current);
      panIntervalRef.current = null;
    }
  }, []);

  // Continuous panning effect
  useEffect(() => {
    if (isPanning && panDirection) {
      panIntervalRef.current = setInterval(() => {
        switch (panDirection) {
          case 'left':
            pan(PAN_SPEED, 0);
            break;
          case 'right':
            pan(-PAN_SPEED, 0);
            break;
          case 'up':
            pan(0, PAN_SPEED);
            break;
          case 'down':
            pan(0, -PAN_SPEED);
            break;
        }
      }, 16); // ~60fps
    }

    return () => {
      if (panIntervalRef.current) {
        clearInterval(panIntervalRef.current);
      }
    };
  }, [isPanning, panDirection, pan, PAN_SPEED]);

  // Reset view
  const handleReset = useCallback(() => {
    if (!controlsRef.current) return;
    
    const controls = controlsRef.current;
    controls.reset();
  }, [controlsRef]);

  // Arrow button component
  const ArrowButton = ({ 
    direction, 
    icon, 
    ariaLabel 
  }: { 
    direction: 'up' | 'down' | 'left' | 'right'; 
    icon: string; 
    ariaLabel: string;
  }) => (
    <button
      onClick={() => handleNudge(direction)}
      onMouseDown={() => startPanning(direction)}
      onMouseUp={stopPanning}
      onMouseLeave={stopPanning}
      onTouchStart={() => startPanning(direction)}
      onTouchEnd={stopPanning}
      className={`
        w-10 h-10 flex items-center justify-center
        bg-zinc-800/90 hover:bg-zinc-700 
        border border-zinc-600 hover:border-zinc-500
        text-zinc-300 hover:text-white
        transition-all duration-150
        backdrop-blur-sm
        ${isPanning && panDirection === direction ? 'bg-amber-500/90 text-black border-amber-400' : ''}
      `}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {icon}
    </button>
  );

  return (
    <div className="absolute bottom-4 right-4 z-10 select-none">
      {/* Tooltip */}
      <div className="mb-2 text-right">
        <div className="inline-block bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded px-3 py-1.5 text-[10px] text-zinc-400">
          💡 Hold <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300 font-mono">Space</kbd> + drag to pan
        </div>
      </div>

      {/* Control pad */}
      <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-700 rounded-lg p-2 shadow-xl">
        <div className="grid grid-cols-3 gap-0.5">
          {/* Top row */}
          <div></div>
          <ArrowButton direction="up" icon="↑" ariaLabel="Pan up" />
          <div></div>

          {/* Middle row */}
          <ArrowButton direction="left" icon="←" ariaLabel="Pan left" />
          
          {/* Reset button (center) */}
          <button
            onClick={handleReset}
            className="w-10 h-10 flex items-center justify-center bg-zinc-800/90 hover:bg-amber-500 border border-zinc-600 hover:border-amber-400 text-zinc-400 hover:text-black transition-all duration-150 text-xs font-bold"
            aria-label="Reset view"
            title="Reset view"
          >
            ⊙
          </button>
          
          <ArrowButton direction="right" icon="→" ariaLabel="Pan right" />

          {/* Bottom row */}
          <div></div>
          <ArrowButton direction="down" icon="↓" ariaLabel="Pan down" />
          <div></div>
        </div>
      </div>
    </div>
  );
};

export default SceneControlsOverlay;
