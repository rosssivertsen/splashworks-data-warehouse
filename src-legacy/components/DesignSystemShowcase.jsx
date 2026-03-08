// Design System Showcase Component for testing and validation
import React from 'react';
import { 
  textStyles, 
  presetStyles, 
  backgroundStyles, 
  borderStyles,
  shadowStyles,
  cn 
} from '../styles/themeUtils';

const DesignSystemShowcase = () => {
  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      <div className={textStyles.h2}>Design System Showcase</div>
      
      {/* Typography */}
      <section className="space-y-4">
        <div className={textStyles.h3}>Typography</div>
        <div className="space-y-2">
          <div className={textStyles.h1}>Heading 1</div>
          <div className={textStyles.h2}>Heading 2</div>
          <div className={textStyles.h3}>Heading 3</div>
          <div className={textStyles.h4}>Heading 4</div>
          <div className={textStyles.body}>Body text - This is the standard body text style.</div>
          <div className={textStyles.bodySmall}>Small body text - Used for secondary information.</div>
          <div className={textStyles.caption}>Caption text - Used for labels and metadata.</div>
          <a href="#" className={textStyles.link}>This is a link</a>
        </div>
      </section>

      {/* Buttons */}
      <section className="space-y-4">
        <div className={textStyles.h3}>Buttons</div>
        <div className="flex flex-wrap gap-4">
          <button className={presetStyles.button.primary}>
            Primary Button
          </button>
          <button className={presetStyles.button.secondary}>
            Secondary Button
          </button>
          <button className={presetStyles.button.outline}>
            Outline Button
          </button>
          <button className={presetStyles.button.ghost}>
            Ghost Button
          </button>
        </div>
      </section>

      {/* Cards */}
      <section className="space-y-4">
        <div className={textStyles.h3}>Cards</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={presetStyles.card.default}>
            <div className={textStyles.h6}>Default Card</div>
            <div className={textStyles.bodySmall}>
              This is a standard card with default styling.
            </div>
          </div>
          <div className={presetStyles.card.elevated}>
            <div className={textStyles.h6}>Elevated Card</div>
            <div className={textStyles.bodySmall}>
              This card has enhanced shadow for prominence.
            </div>
          </div>
          <div className={presetStyles.card.interactive}>
            <div className={textStyles.h6}>Interactive Card</div>
            <div className={textStyles.bodySmall}>
              This card responds to hover and can be clicked.
            </div>
          </div>
        </div>
      </section>

      {/* Badges */}
      <section className="space-y-4">
        <div className={textStyles.h3}>Badges</div>
        <div className="flex flex-wrap gap-2">
          <span className={presetStyles.badge.success}>Success Badge</span>
          <span className={presetStyles.badge.warning}>Warning Badge</span>
          <span className={presetStyles.badge.error}>Error Badge</span>
          <span className={presetStyles.badge.info}>Info Badge</span>
          <span className={presetStyles.badge.neutral}>Neutral Badge</span>
        </div>
      </section>

      {/* Status Indicators */}
      <section className="space-y-4">
        <div className={textStyles.h3}>Status Indicators</div>
        <div className="space-y-3">
          <div className={presetStyles.status.success}>
            <strong>Success:</strong> Operation completed successfully
          </div>
          <div className={presetStyles.status.warning}>
            <strong>Warning:</strong> Please review this information
          </div>
          <div className={presetStyles.status.error}>
            <strong>Error:</strong> Something went wrong
          </div>
          <div className={presetStyles.status.info}>
            <strong>Info:</strong> Here's some helpful information
          </div>
        </div>
      </section>

      {/* Inputs */}
      <section className="space-y-4">
        <div className={textStyles.h3}>Form Inputs</div>
        <div className="space-y-3">
          <div>
            <label className={textStyles.label}>Default Input</label>
            <input 
              type="text" 
              className={presetStyles.input.default}
              placeholder="Enter some text..."
            />
          </div>
          <div>
            <label className={textStyles.label}>Error Input</label>
            <input 
              type="text" 
              className={presetStyles.input.error}
              placeholder="This has an error..."
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default DesignSystemShowcase;