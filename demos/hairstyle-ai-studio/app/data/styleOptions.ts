import { Scissors, Palette, Waves, Sparkles } from 'lucide-react';

export const STYLE_PRINCIPLES = [
  {
    id: 'cut',
    label: 'Cut & Shape',
    icon: Scissors,
    options: ['Pixie', 'Bob', 'Lob', 'Shag', 'Wolf Cut', 'Mullet', 'Layered', 'Blunt', 'Undercut', 'Fade']
  },
  {
    id: 'color',
    label: 'Color & Tone',
    icon: Palette,
    options: ['Platinum', 'Balayage', 'Money Piece', 'Copper', 'Espresso', 'Pastel', 'Neon', 'Silver', 'Ombre']
  },
  {
    id: 'texture',
    label: 'Texture & Finish',
    icon: Waves,
    options: ['Messy', 'Sleek', 'Wavy', 'Curly', 'Coily', 'Braided', 'Glass Hair', 'Voluminous']
  },
  {
    id: 'aesthetic',
    label: 'Aesthetic',
    icon: Sparkles,
    options: ['Y2K', 'Old Money', 'Clean Girl', 'Edgy', 'Soft Girl', 'Cyberpunk', 'Boho']
  }
];

export const STYLES = [
  {
    category: "Women's Trending",
    items: [
      {
        id: 'wolf-cut',
        label: 'Wolf Cut',
        desc: 'Textured layers with curtain bangs',
        img: 'images/optimized/women/wolf-cut.jpg'
      },
      {
        id: 'mixie-cut',
        label: 'The Mixie',
        desc: 'Bold pixie-mullet hybrid with wispy nape',
        img: 'images/mixie-cut-woman.jpg'
      },
      {
        id: 'holographic-shag',
        label: 'Holographic Shag',
        desc: 'Edgy shag with silver/pastel iridescent tones',
        img: 'images/holographic-shag-woman.jpg'
      },
      {
        id: 'copper-shag',
        label: 'Copper Shag',
        desc: '70s inspired shag in vibrant copper',
        img: 'images/optimized/women/copper-shag.jpg'
      },
      {
        id: 'butterfly-cut',
        label: 'Butterfly Cut',
        desc: 'Voluminous layers and face-framing',
        img: 'images/optimized/women/butterfly-cut.jpg'
      }
    ]
  },
  {
    category: "Women's Classics",
    items: [
      {
        id: 'pixie-cut',
        label: 'Pixie Cut',
        desc: 'Chic, textured short crop',
        img: 'images/optimized/women/pixie-cut.jpg'
      },
      {
        id: 'mermaid-waves',
        label: 'Mermaid Waves',
        desc: 'Long, loose beachy waves',
        img: 'images/optimized/women/mermaid-waves.jpg'
      },
      {
        id: 'italian-bob',
        label: 'Italian Bob',
        desc: 'Soft, voluminous neck-length bob',
        img: 'images/optimized/women/italian-bob.jpg'
      },
      {
        id: 'glass-bob',
        label: 'Glass Bob',
        desc: 'Ultra-shiny sharp espresso bob',
        img: 'images/optimized/women/glass-bob.jpg'
      }
    ]
  },
  {
    category: "Men's Trending",
    items: [
      {
        id: 'curly-fringe',
        label: 'Curly Fringe',
        desc: 'Messy natural curls with high fade',
        img: 'images/curly-fringe-man.jpg'
      },
      {
        id: 'soft-pompadour',
        label: 'Soft Pompadour',
        desc: 'Matte swept-back volume',
        img: 'images/soft-pompadour-man.jpg'
      },
      {
        id: 'modern-mullet',
        label: 'Modern Mullet',
        desc: 'Fade sides, longer back, textured top',
        img: 'images/optimized/men/modern-mullet.jpg'
      },
      {
        id: 'textured-crop',
        label: 'Textured Crop',
        desc: 'Short matte finish with forward fringe',
        img: 'images/optimized/men/textured-crop.jpg'
      }
    ]
  },
  {
    category: "Men's Classics",
    items: [
      {
        id: 'buzz-cut',
        label: 'Buzz Cut',
        desc: 'Clean, uniform short length',
        img: 'images/optimized/men/textured-crop-classic.jpg'
      },
      {
        id: 'side-part',
        label: 'Side Part',
        desc: 'Professional taper with defined part',
        img: 'images/optimized/men/modern-mullet-classic.jpg'
      },
      {
        id: 'long-flow',
        label: 'Long Flow',
        desc: 'Natural long waves with volume',
        img: 'images/optimized/men/long-flow.jpg'
      },
      {
        id: 'the-flow',
        label: 'The Flow',
        desc: 'Medium length pushed back styles',
        img: 'images/optimized/men/the-flow.jpg'
      }
    ]
  }
];

export const LUCKY_PROMPTS = [
  "A futuristic cyberpunk bob with neon blue streaks",
  "Vintage 1950s hollywood glamour waves",
  "A wild, textured wolf cut with silver tips",
  "Braided crown with loose wisps framing the face"
];
