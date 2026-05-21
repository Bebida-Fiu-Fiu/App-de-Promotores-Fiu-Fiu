import type { PromotorVisitImageUpload } from '@/types/promotor';

const MAX_IMAGE_DIMENSION = 1600;
const TARGET_IMAGE_SIZE_IN_BYTES = 900 * 1024;
const DEFAULT_IMAGE_QUALITY = 0.78;
const MIN_IMAGE_QUALITY = 0.52;
const IMAGE_FILENAME_EXTENSION_PATTERN =
  /\.(avif|bmp|cr2|cr3|dng|gif|heic|heif|ico|jfif|jpe|jpeg|jpg|nef|nrw|orf|pef|png|psd|raf|raw|rw2|sr2|srw|svg|tif|tiff|webp)$/i;
const MIME_TYPE_BY_EXTENSION = new Map<string, string>([
  ['.avif', 'image/avif'],
  ['.bmp', 'image/bmp'],
  ['.cr2', 'image/x-canon-cr2'],
  ['.cr3', 'image/x-canon-cr3'],
  ['.dng', 'image/x-adobe-dng'],
  ['.gif', 'image/gif'],
  ['.heic', 'image/heic'],
  ['.heif', 'image/heif'],
  ['.ico', 'image/x-icon'],
  ['.jfif', 'image/jpeg'],
  ['.jpe', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.nef', 'image/x-nikon-nef'],
  ['.nrw', 'image/x-nikon-nrw'],
  ['.orf', 'image/x-olympus-orf'],
  ['.pef', 'image/x-pentax-pef'],
  ['.png', 'image/png'],
  ['.psd', 'image/vnd.adobe.photoshop'],
  ['.raf', 'image/x-fuji-raf'],
  ['.raw', 'image/x-panasonic-raw'],
  ['.rw2', 'image/x-panasonic-rw2'],
  ['.sr2', 'image/x-sony-sr2'],
  ['.srw', 'image/x-samsung-srw'],
  ['.svg', 'image/svg+xml'],
  ['.tif', 'image/tiff'],
  ['.tiff', 'image/tiff'],
  ['.webp', 'image/webp'],
]);

function getFilenameExtension(filename: string) {
  const extensionIndex = filename.lastIndexOf('.');

  if (extensionIndex < 0) {
    return '';
  }

  return filename.slice(extensionIndex).toLowerCase();
}

export function isAcceptedImageFile(file: Pick<File, 'name' | 'type'>) {
  return file.type.startsWith('image/') || IMAGE_FILENAME_EXTENSION_PATTERN.test(file.name);
}

export function inferMimeTypeFromFilename(filename: string) {
  return MIME_TYPE_BY_EXTENSION.get(getFilenameExtension(filename)) ?? '';
}

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
  if (!isAcceptedImageFile(file)) {
    return file;
  }

  try {
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
      return file;
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
      return file;
    }

    if (compressedBlob.size >= file.size && scale === 1) {
      return file;
    }

    return new File([compressedBlob], buildUploadFilename(file), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

export async function fileToVisitImageUpload(file: File): Promise<PromotorVisitImageUpload> {
  const optimizedFile = await compressImage(file);
  const contentType = optimizedFile.type || inferMimeTypeFromFilename(optimizedFile.name) || 'application/octet-stream';

  return {
    filename: optimizedFile.name,
    contentType,
    base64: await fileToBase64(optimizedFile),
  };
}

export async function mapFilesToUploadPayload(files: File[]) {
  return Promise.all(files.map((file) => fileToVisitImageUpload(file)));
}
