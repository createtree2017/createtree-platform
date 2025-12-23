import React from 'react';
import { EditorState } from '../types';
import { DPI } from '../constants';
import clsx from 'clsx'; // Utility for conditional classes, assumed available or easy to inline. 
// Note: Since I can't add dependencies, I'll use template literals.

interface PageStripProps {
  state: EditorState;
  onSelectSpread: (index: number) => void;
  onAddSpread: () => void;
}

export const PageStrip: React.FC<PageStripProps> = ({ state, onSelectSpread, onAddSpread }) => {
  // Calculate thumbnail aspect ratio
  const ratio = (state.albumSize.widthInches * 2) / state.albumSize.heightInches;
  const thumbHeight = 80;
  const thumbWidth = thumbHeight * ratio;

  return (
    <div className="h-40 bg-gray-100 border-t border-gray-200 flex flex-col shrink-0">
      <div className="px-4 py-2 flex justify-between items-center text-xs text-gray-500 uppercase font-bold tracking-wider">
        <span>Pages</span>
        <span>{state.spreads.length * 2} Pages total</span>
      </div>
      
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex items-center px-4 space-x-4 pb-2">
        {state.spreads.map((spread, index) => {
          const isActive = index === state.currentSpreadIndex;
          
          return (
            <div 
              key={spread.id}
              onClick={() => onSelectSpread(index)}
              className={`group flex flex-col items-center cursor-pointer transition-all duration-200 ${isActive ? 'scale-105' : 'opacity-70 hover:opacity-100'}`}
            >
              <div 
                className={`relative bg-white shadow-sm border-2 overflow-hidden transition-colors ${isActive ? 'border-indigo-600 shadow-md' : 'border-gray-300 group-hover:border-gray-400'}`}
                style={{ width: thumbWidth, height: thumbHeight }}
              >
                {/* Center Line */}
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-200" />
                
                {/* Tiny preview of objects (simplified for performance) */}
                {spread.objects.map(obj => (
                  <div 
                    key={obj.id}
                    className="absolute bg-gray-200"
                    style={{
                      left: `${(obj.x / (state.albumSize.widthInches * 2 * DPI)) * 100}%`,
                      top: `${(obj.y / (state.albumSize.heightInches * DPI)) * 100}%`,
                      width: `${(obj.width / (state.albumSize.widthInches * 2 * DPI)) * 100}%`,
                      height: `${(obj.height / (state.albumSize.heightInches * DPI)) * 100}%`,
                      transform: `rotate(${obj.rotation}deg)`,
                      backgroundImage: `url(${obj.src})`,
                      backgroundSize: 'cover'
                    }}
                  />
                ))}
              </div>
              <span className={`mt-2 text-xs font-medium ${isActive ? 'text-indigo-600' : 'text-gray-500'}`}>
                 {index * 2 + 1}-{index * 2 + 2}
              </span>
            </div>
          );
        })}

        <button 
          onClick={onAddSpread}
          className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded hover:border-indigo-400 hover:bg-indigo-50 text-gray-400 hover:text-indigo-500 transition-colors"
          style={{ width: thumbWidth, height: thumbHeight }}
        >
          <span className="text-2xl">+</span>
        </button>
        
        {/* Spacing at the end */}
        <div className="w-4 shrink-0" />
      </div>
    </div>
  );
};
