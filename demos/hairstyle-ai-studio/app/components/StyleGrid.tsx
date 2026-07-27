import React from 'react';
import { Sparkles, Check } from 'lucide-react';
import { STYLES } from '../data/styleOptions';
import { PresetImage } from './PresetImage';

interface StyleGridProps {
  onSelect: (style: string) => void;
  selectedStyle?: string;
  activeTab: 'All' | 'Women' | 'Men';
  onTabChange: (tab: 'All' | 'Women' | 'Men') => void;
  title?: string;
}

export const StyleGrid: React.FC<StyleGridProps> = ({
  onSelect,
  selectedStyle = '',
  activeTab,
  onTabChange,
  title
}) => {
  const filteredStyles = STYLES.filter(section => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Women') return section.category.includes('Women');
    if (activeTab === 'Men') return section.category.includes('Men');
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            {title && <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">{title}</h3>}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-full border border-slate-200/40 dark:border-slate-800">
            {(['All', 'Women', 'Men'] as const).map((tab) => (
                <button
                key={tab}
                onClick={() => onTabChange(tab)}
                aria-pressed={activeTab === tab}
                className={`min-h-11 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    activeTab === tab
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
                >
                {tab}
                </button>
            ))}
            </div>
        </div>
        <p className="text-[10px] text-gray-400 font-medium hidden sm:block">Select a vibe to start</p>
      </div>

      <div className="space-y-6">
        {filteredStyles.map((section) => (
          <div key={section.category} className="space-y-2.5">
            <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1 mb-2.5 flex items-center gap-2">
              <span className="w-1 h-3.5 bg-primary rounded-full"></span>
              {section.category}
            </h3>

            {/* Scrollable horizontal filmstrip on mobile, standard grid on desktop */}
            <div className="flex sm:grid overflow-x-auto sm:overflow-visible gap-4 pb-4 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x sm:snap-none hide-scrollbar sm:grid-cols-2 lg:grid-cols-4">
              {section.items.map((item) => {
                const isSelected = String(selectedStyle || '').includes(item.label);

                return (
                  <button
                    type="button"
                    key={item.id}
                    aria-pressed={isSelected}
                    aria-label={`${isSelected ? 'Selected' : 'Try'} ${item.label}: ${item.desc}`}
                    onClick={() => onSelect(`${item.label} - ${item.desc}`)}
                    className={`
                      relative group rounded-2xl overflow-hidden text-left bg-white dark:bg-slate-900 border transition-all duration-300
                      snap-start shrink-0 w-[220px] sm:w-auto sm:shrink
                      focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/40
                      ${isSelected
                        ? 'ring-4 ring-primary-500/20 border-primary-500 shadow-lg scale-[1.01] z-10'
                        : 'border-slate-100 dark:border-slate-800/80 hover:border-primary-300 dark:hover:border-primary-800 hover:shadow-md'}
                    `}
                  >
                    <div className="aspect-[4/3] relative overflow-hidden">
                      <PresetImage src={item.img} alt={item.label} />
                      <div className={`absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent transition-all duration-300 ${isSelected ? 'opacity-100' : 'opacity-50 group-hover:opacity-90'}`} />

                      <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${isSelected ? 'opacity-100 scale-100' : 'opacity-100 sm:opacity-0 scale-100 sm:scale-95 sm:group-hover:opacity-100 sm:group-hover:scale-100 sm:group-focus-visible:opacity-100'}`}>
                        <span
                          className={`
                            px-3.5 py-1.5 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all shadow-md
                            ${isSelected
                              ? 'bg-white text-primary'
                              : 'bg-primary text-white hover:bg-primary-600'}
                          `}
                        >
                          <Sparkles size={12} fill={isSelected ? 'currentColor' : 'none'} />
                          {isSelected ? 'Applied' : 'Try Vibe'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 relative bg-white dark:bg-slate-900">
                      <h4 className="text-gray-900 dark:text-white font-extrabold text-xs leading-tight mb-0.5">{item.label}</h4>
                      <p className="text-gray-500 dark:text-slate-400 text-[10px] leading-snug line-clamp-1">{item.desc}</p>

                      {isSelected && (
                        <div className="absolute top-3 right-3 text-primary">
                           <Check size={14} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
