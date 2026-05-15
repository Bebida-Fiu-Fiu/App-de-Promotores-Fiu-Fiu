import type { PromotorVisitImageUpload } from '@/types/promotor';

export async function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const [, base64 = ''] = result.split(',');
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Nao foi possivel ler o arquivo selecionado.'));
    reader.readAsDataURL(file);
  });
}

export async function fileToVisitImageUpload(file: File): Promise<PromotorVisitImageUpload> {
  return {
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    base64: await fileToBase64(file),
  };
}
