'use client';
// Crop step of the logo / avatar upload — Figma "DLG — Settings & billing — Logo de l'espace & avatar" (RECADRER cercle /
// carré · zoom; ENVOI… n %; errors IMAGE_TOO_LARGE / IMAGE_TYPE_INVALID). The kept square is redrawn at 512 px (the size
// the API stores) before it is sent; an upload error stays inside the dialog with the picture kept.
import { Button, cropSquare, Dialog, FormAlert, ImageCropper, SegmentedControl, type CropShape, type CropState } from '@djaber/ui';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n';

const VIEW = 240;
export const CROP_OUTPUT_PX = 512;

/** Name of the cropped file: same base name, extension of the output type. */
export const croppedName = (name: string, type: string) => `${name.replace(/\.[^.]+$/, '') || 'image'}.${type === 'image/jpeg' ? 'jpg' : 'png'}`;
/** JPEG stays JPEG (photos); every other type becomes PNG (keeps the transparency of a logo). */
export const croppedType = (type: string) => (type === 'image/jpeg' ? 'image/jpeg' : 'image/png');

export function CropDialog({ file, kind, uploading, error, onCancel, onConfirm }: { file: File | null; kind: 'avatar' | 'logo' | 'category_image'; uploading: boolean; error: string | null; onCancel: () => void; onConfirm: (cropped: File) => void }) {
  const t = useT();
  const [src, setSrc] = useState<string | null>(null);
  const [shape, setShape] = useState<CropShape>(kind === 'avatar' ? 'circle' : 'square');
  const [crop, setCrop] = useState<CropState>({ zoom: 1, x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const img = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!file) return setSrc(null);
    const url = URL.createObjectURL(file);
    setSrc(url);
    setCrop({ zoom: 1, x: 0, y: 0 });
    setShape(kind === 'avatar' ? 'circle' : 'square');
    setLocalError(null);
    return () => URL.revokeObjectURL(url);
  }, [file, kind]);

  const confirm = async () => {
    if (!file || !img.current) return;
    setBusy(true);
    setLocalError(null);
    try {
      const type = croppedType(file.type);
      const blob = await cropSquare(img.current, VIEW, crop, CROP_OUTPUT_PX, type);
      onConfirm(new File([blob], croppedName(file.name, type), { type }));
    } catch {
      setLocalError(t('error.IMAGE_TYPE_INVALID'));
    } finally {
      setBusy(false);
    }
  };
  const shown = error ?? localError;
  return (
    <Dialog
      open={!!file}
      onOpenChange={(o) => !o && !uploading && onCancel()}
      title={t('carry.crop.title')}
      description={t('settings.upload.hint')}
      closeLabel={t('action.close')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={uploading}>
            {t('action.cancel')}
          </Button>
          <Button variant="primary" onClick={() => void confirm()} loading={busy || uploading} disabled={!src} data-testid="crop-save">
            {uploading ? t('settings.upload.uploading') : t('action.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4" data-testid="crop-dialog">
        <SegmentedControl
          label={t('carry.crop.shape')}
          value={shape}
          onChange={setShape}
          options={[
            { value: 'circle', label: t('carry.crop.circle') },
            { value: 'square', label: t('carry.crop.square') },
          ]}
        />
        {src ? (
          <ImageCropper
            src={src}
            value={crop}
            onChange={setCrop}
            shape={shape}
            size={VIEW}
            label={t('carry.crop.frame')}
            zoomLabel={t('carry.crop.zoom')}
            onLoad={(el) => (img.current = el)}
          />
        ) : null}
        {shown ? <FormAlert className="w-full">{shown}</FormAlert> : null}
      </div>
    </Dialog>
  );
}
