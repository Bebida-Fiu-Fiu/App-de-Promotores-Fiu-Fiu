import { inferMimeTypeFromFilename, isAcceptedImageFile } from '@/lib/file-utils';

describe('file-utils image acceptance', () => {
  it('accepts files with image mime types', () => {
    expect(isAcceptedImageFile({ name: 'foto.bin', type: 'image/heic' })).toBe(true);
  });

  it('accepts files with known image extensions even when mime type is empty', () => {
    expect(isAcceptedImageFile({ name: 'visita.HEIC', type: '' })).toBe(true);
    expect(isAcceptedImageFile({ name: 'camera.raw', type: '' })).toBe(true);
  });

  it('rejects files that do not look like images', () => {
    expect(isAcceptedImageFile({ name: 'planilha.xlsx', type: '' })).toBe(false);
    expect(isAcceptedImageFile({ name: 'contrato.pdf', type: 'application/pdf' })).toBe(false);
  });

  it('infers mime types from filenames when needed', () => {
    expect(inferMimeTypeFromFilename('foto.heic')).toBe('image/heic');
    expect(inferMimeTypeFromFilename('antes.JPG')).toBe('image/jpeg');
    expect(inferMimeTypeFromFilename('documento.sem-extensao')).toBe('');
  });
});
