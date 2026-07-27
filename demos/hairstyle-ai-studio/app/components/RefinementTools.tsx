import React, { useState } from 'react';
import { Ruler, Palette, Layers, Scissors } from 'lucide-react';

export const REFINEMENT_TOOLS = [
  {
    id: 'length',
    label: 'Length',
    icon: Ruler,
    options: ['Trim ends', 'Shoulder length', 'Chin length', 'Short pixie', 'Long extensions']
  },
  {
    id: 'color',
    label: 'Color',
    icon: Palette,
    options: ['Lighter', 'Darker', 'Warmer tone', 'Cooler tone', 'Add highlights', 'Root shadow']
  },
  {
    id: 'texture',
    label: 'Texture',
    icon: Layers,
    options: ['More volume', 'Less volume', 'Smoother', 'Messier', 'Defined curls']
  },
  {
    id: 'cut',
    label: 'Cut Details',
    icon: Scissors,
    options: ['Add bangs', 'Curtain bangs', 'Face framing', 'Blunt cut', 'Razored edges']
  }
];

interface RefinementToolsProps {
  selectedOptions: string[];
  onToggle: (option: string) => void;
  disabled?: boolean;
}

export const RefinementTools: React.FC<RefinementToolsProps> = ({ selectedOptions, onToggle, disabled }) => {
  const [activeTab, setActiveTab] = useState<string>('length');

  const activeTool = REFINEMENT_TOOLS.find(t => t.id === activeTab) || REFINEMENT_TOOLS[0];

  return (
    <div className="mt-4 space-y-3.5">
      {/* Category selector tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1.5 border-b border-slate-100 dark:border-slate-800 hide-scrollbar">
        {REFINEMENT_TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive = tool.id === activeTab;
          // Count selected options in this category
          const selectedCount = tool.options.filter(opt => selectedOptions.includes(opt)).length;

          return (
            <button
              key={tool.id}
              onClick={() => setActiveTab(tool.id)}
              disabled={disabled}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border shrink-0
                ${isActive
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200/60 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700'}
              `}
            >
              <Icon size={12} />
              <span>{tool.label}</span>
              {selectedCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-primary text-white text-[9px] flex items-center justify-center font-bold">
                  {selectedCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Options for the active category */}
      <div className="flex flex-wrap gap-2 py-1">
        {activeTool.options.map((option) => {
          const isSelected = selectedOptions.includes(option);
          return (
            <button
              key={option}
              onClick={() => onToggle(option)}
              disabled={disabled}
              className={`
                text-xs px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap font-medium
                ${isSelected
                  ? 'bg-primary border-primary text-white shadow-sm'
                  : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-650 dark:text-slate-300 hover:border-primary-350'}
              `}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
};
