import React, { useEffect, useRef, useState } from 'react';

interface JoystickProps {
  onMove: (x: number, y: number, active: boolean) => void;
  color?: string;
  side: 'left' | 'right';
}

export const Joystick: React.FC<JoystickProps> = ({ onMove, color = 'white', side }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [origin, setOrigin] = useState({ x: 0, y: 0 });

  // Reset when released
  const handleEnd = () => {
    setActive(false);
    setPosition({ x: 0, y: 0 });
    onMove(0, 0, false);
  };

  const handleStart = (clientX: number, clientY: number) => {
    setActive(true);
    setOrigin({ x: clientX, y: clientY });
    setPosition({ x: 0, y: 0 });
    onMove(0, 0, true);
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!active) return;

    const maxDist = 40; // Max joystick radius
    const dx = clientX - origin.x;
    const dy = clientY - origin.y;
    const dist = Math.min(Math.hypot(dx, dy), maxDist);
    const angle = Math.atan2(dy, dx);

    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;

    setPosition({ x, y });
    
    // Normalize output -1 to 1
    onMove(x / maxDist, y / maxDist, true);
  };

  // Touch Events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      handleStart(touch.clientX, touch.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      handleMove(touch.clientX, touch.clientY);
    };

    const onTouchEnd = (e: TouchEvent) => {
        e.preventDefault();
        handleEnd();
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [active, origin]);

  // Mouse Events fallback for desktop testing
  const handleMouseDown = (e: React.MouseEvent) => {
      handleStart(e.clientX, e.clientY);
  };
  
  // Window listeners for drag outside component
  useEffect(() => {
      if(!active) return;
      const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
      const onMouseUp = () => handleEnd();
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      return () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
      }
  }, [active, origin]);

  const baseStyle: React.CSSProperties = {
      position: 'absolute',
      bottom: '40px',
      [side]: '40px',
      width: '120px',
      height: '120px',
      zIndex: 50,
      touchAction: 'none'
  };

  return (
    <div 
        ref={containerRef}
        style={baseStyle}
        onMouseDown={handleMouseDown}
        className="flex items-center justify-center bg-slate-800/50 rounded-full border-2 border-slate-600 backdrop-blur-sm select-none"
    >
        {/* Inner Stick */}
        <div 
            style={{
                transform: `translate(${position.x}px, ${position.y}px)`,
                backgroundColor: active ? color : 'rgba(255,255,255,0.5)',
                transition: active ? 'none' : 'transform 0.2s'
            }}
            className="w-12 h-12 rounded-full shadow-lg pointer-events-none"
        />
    </div>
  );
};
