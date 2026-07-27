/**
 * RecipePicker — choosing what the agent is good at, from inside the composer.
 *
 * This replaces the six-icon journey rail. The rail presented recipes as modes:
 * a permanent piece of chrome implying you were *in* Concierge or *in* Scout,
 * and switching felt like leaving. Since the session is now continuous, a recipe
 * only re-briefs the same agent — so it belongs next to the thing you type into,
 * as a choice you make when you need it, not a wall you navigate.
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronUp, Sparkles } from 'lucide-react';
import { useAtlas } from '@/state/store';
import { RECIPES } from '@/recipes/registry';
import { sendToCopilot, switchRecipe } from '@/ai/session';

export function RecipePicker() {
  const activeId = useAtlas((s) => s.activeScenario);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = RECIPES.find((recipe) => recipe.id === activeId) ?? RECIPES[0];

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  return (
    <div className="recipe-picker" ref={rootRef}>
      <button
        type="button"
        className="recipe-picker__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={active.tagline}
      >
        <Sparkles size={15} aria-hidden="true" style={{ color: 'var(--accent)' }} />
        <span className="recipe-picker__name">{active.title}</span>
        <ChevronUp size={14} aria-hidden="true" className={open ? 'is-open' : undefined} />
      </button>

      {open && (
        <div className="recipe-picker__menu glass" role="menu" aria-label="Recipes">
          {RECIPES.map((recipe) => {
            const isActive = recipe.id === activeId;
            return (
              <div key={recipe.id} className={`recipe-picker__item${isActive ? ' is-active' : ''}`}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  className="recipe-picker__item-main"
                  onClick={() => {
                    switchRecipe(recipe.id);
                    setOpen(false);
                  }}
                  style={{ ['--recipe-accent' as string]: recipe.accent }}
                >
                  <span className="recipe-picker__item-title">{recipe.title}</span>
                  <span className="recipe-picker__item-tagline">{recipe.tagline}</span>
                </button>
                <div className="recipe-picker__starters">
                  {recipe.starters.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      role="menuitem"
                      className="recipe-picker__starter"
                      title={starter}
                      onClick={() => {
                        // switchRecipe is a no-op when this recipe is already
                        // active, so an in-recipe starter keeps the session.
                        switchRecipe(recipe.id);
                        setOpen(false);
                        sendToCopilot(starter);
                      }}
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
