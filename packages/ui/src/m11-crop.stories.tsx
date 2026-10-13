// M11 (M1 carry-over) — crop step of the logo / avatar upload: Figma "DLG — Settings & billing — Logo de l'espace &
// avatar" (RECADRER cercle / carré · zoom).
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ImageCropper, SegmentedControl, type CropShape, type CropState } from './index';

const meta: Meta = { title: 'M11/Image cropper' };
export default meta;
type Story = StoryObj;

// a 600 × 400 landscape test picture (no network)
const PICTURE = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#1f6f5c"/><circle cx="300" cy="200" r="120" fill="#f2c14e"/><text x="300" y="215" font-size="48" text-anchor="middle" fill="#111">Amel</text></svg>',
)}`;

function Cropper({ initialShape }: { initialShape: CropShape }) {
  const [shape, setShape] = useState<CropShape>(initialShape);
  const [crop, setCrop] = useState<CropState>({ zoom: 1, x: 0, y: 0 });
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 p-6">
      <SegmentedControl
        label="Forme"
        value={shape}
        onChange={(v) => setShape(v as CropShape)}
        options={[
          { value: 'circle', label: 'Cercle' },
          { value: 'square', label: 'Carré' },
        ]}
      />
      <ImageCropper src={PICTURE} value={crop} onChange={setCrop} shape={shape} label="Recadrer : glissez pour déplacer" zoomLabel="Zoom" />
      <code className="ts-label-meta text-text-muted">{`zoom ${crop.zoom.toFixed(2)} · x ${Math.round(crop.x)} · y ${Math.round(crop.y)}`}</code>
    </div>
  );
}

export const Circle: Story = { render: () => <Cropper initialShape="circle" /> };
export const Square: Story = { render: () => <Cropper initialShape="square" /> };
