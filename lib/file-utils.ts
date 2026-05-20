import type { PromotorVisitImageUpload } from '@/types/promotor';

const MAX_IMAGE_DIMENSION = 1600;
const TARGET_IMAGE_SIZE_IN_BYTES = 900 * 1024;
const DEFAULT_IMAGE_QUALITY = 0.78;
const MIN_IMAGE_QUALITY = 0.52;

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

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Nao foi possivel preparar a imagem selecionada.'));
    };
    reader.onerror = () => reject(new Error('Nao foi possivel ler o arquivo selecionado.'));
    reader.readAsDataURL(file);
  });
}

async function loadImageElement(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Nao foi possivel processar a imagem selecionada.'));
    image.src = source;
  });
}

function buildUploadFilename(file: File) {
  return file.name.replace(/\.[^.]+$/, '') + '.jpg';
}

async function compressImage(file: File) {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImageElement(source);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Nao foi possivel preparar a imagem selecionada.');
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  let quality = DEFAULT_IMAGE_QUALITY;
  let compressedBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality);
  });

  while (compressedBlob && compressedBlob.size > TARGET_IMAGE_SIZE_IN_BYTES && quality > MIN_IMAGE_QUALITY) {
    quality = Math.max(MIN_IMAGE_QUALITY, quality - 0.08);
    compressedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });
  }

  if (!compressedBlob) {
    throw new Error('Nao foi possivel compactar a imagem selecionada.');
  }

  if (compressedBlob.size >= file.size && scale === 1) {
    return file;
  }

  return new File([compressedBlob], buildUploadFilename(file), {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  });
}

export async function fileToVisitImageUpload(file: File): Promise<PromotorVisitImageUpload> {
  const optimizedFile = await compressImage(file);

  return {
    filename: optimizedFile.name,
    contentType: optimizedFile.type || 'application/octet-stream',
    base64: await fileToBase64(optimizedFile),
  };
}

export async function mapFilesToUploadPayload(files: File[]) {
  return Promise.all(files.map((file) => fileToVisitImageUpload(file)));
}
