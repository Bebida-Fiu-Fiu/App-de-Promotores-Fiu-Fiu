'use client';

import Image from 'next/image';
import { Camera, CheckCircle2, CircleAlert } from 'lucide-react';
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'; 
import { useRouter } from 'next/navigation';
import { saveWeeklyVehicleCheck, skipWeeklyVehicleCheck } from '@/lib/actions';

type WeeklyVehicleCheckGateProps = {
  initialCompletedForToday?: boolean;
  requirePhoto?: boolean;
  allowSkip?: boolean;
  redirectTo?: string;
  children: ReactNode;
};
 
export function WeeklyVehicleCheckGate({
  initialCompletedForToday = false,
  requirePhoto = true,
  allowSkip = false,
  redirectTo,
  children,
}: WeeklyVehicleCheckGateProps) {
  const router = useRouter();
  const previewUrlRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mileage, setMileage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConfirmedLocally, setIsConfirmedLocally] = useState(initialCompletedForToday);
  const [isSaving, setIsSaving] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const shouldShowGate = !initialCompletedForToday && !isConfirmedLocally;

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCameraStream();

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (shouldShowGate) {
      return;
    }

    stopCameraStream();
  }, [shouldShowGate]);

  useEffect(() => {
    const videoElement = videoRef.current;
    const stream = streamRef.current;

    if (!isCameraOpen || !videoElement || !stream) {
      return;
    }

    videoElement.srcObject = stream;
    void videoElement.play().catch((error) => {
      console.error('Camera preview play error:', error);
    });
  }, [isCameraOpen]);

  const replaceSelectedImage = (nextFile: File | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    setSelectedImage(nextFile);
    if (nextFile) {
      const nextPreviewUrl = URL.createObjectURL(nextFile);
      previewUrlRef.current = nextPreviewUrl;
      setPreviewUrl(nextPreviewUrl);
    } else {
      setPreviewUrl(null);
    }

    setIsConfirmedLocally(false);
    setErrorMessage(null);
  };

  const handleOpenCamera = async () => {
    try {
      stopCameraStream();

      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: 'environment',
          },
        },
        audio: false,
      });

      streamRef.current = nextStream;
      setIsCameraOpen(true);
      setErrorMessage(null);
    } catch (error) {
      console.error('Camera access error:', error);
      setIsCameraOpen(false);
      setErrorMessage('Nao foi possivel abrir a camera. Verifique a permissao do aparelho.');
    }
  };

  const handleTakePhoto = async () => {
    const video = videoRef.current;

    if (!video) {
      setErrorMessage('Nao foi possivel acessar a camera.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 1600;

    const context = canvas.getContext('2d');

    if (!context) {
      setErrorMessage('Nao foi possivel capturar a foto.');
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92);
    });

    if (!blob) {
      setErrorMessage('Nao foi possivel capturar a foto.');
      return;
    }

    const fileName = `quilometragem-${Date.now()}.jpg`;
    replaceSelectedImage(new File([blob], fileName, { type: 'image/jpeg' }));
    stopCameraStream();
    setIsCameraOpen(false);
  };

  const handleConfirm = async () => {
    if (!mileage.trim()) {
      setErrorMessage('Informe a quilometragem antes de confirmar.');
      return;
    }

    if (requirePhoto && !selectedImage) {
      setErrorMessage('Tire uma foto do painel antes de continuar.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('mileage', mileage.trim());
    if (selectedImage) {
      formData.append('image', selectedImage);
    }

    const result = await saveWeeklyVehicleCheck(formData, {
      allowWithoutPhoto: !requirePhoto,
    });

    setIsSaving(false);

    if (!result.success) {
      setErrorMessage(result.error ?? 'Nao foi possivel salvar a quilometragem.');
      return;
    }

    setIsConfirmedLocally(true);
    if (redirectTo) {
      router.push(redirectTo);
      router.refresh();
    }
  };

  const handleSkip = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    const result = await skipWeeklyVehicleCheck();

    setIsSaving(false);

    if (!result.success) {
      setErrorMessage(result.error ?? 'Nao foi possivel registrar o pulo da quilometragem.');
      return;
    }

    setIsConfirmedLocally(true);
    if (redirectTo) {
      router.push(redirectTo);
      router.refresh();
    }
  };

  return (
    <>
      {children}

      {shouldShowGate && (
        <div className="fixed inset-0 z-[100] flex min-h-screen items-start justify-center overflow-y-auto bg-[#091c27] px-4 py-8">
          <section className="">
            <div className="">
              <h2 className="mx-auto max-w-[14rem] text-center text-[1.75rem] font-semibold leading-tight">
                Digite a Quilometragem do Veículo
              </h2>

              <input
                type="text"
                inputMode="numeric"
                placeholder="Ex.: 45230"
                value={mileage}
                onChange={(event) => {
                  setMileage(event.target.value.replace(/[^\d]/g, ''));
                  setErrorMessage(null);
                }}
                className="mt-7 h-12 w-full rounded-2xl border border-[#5a6b74] bg-white px-4 text-center text-lg text-[#1c2428]"
              />

              <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-[#5a6b74] bg-white">
                <div className="relative flex aspect-[4/5] items-center justify-center bg-[linear-gradient(180deg,_#ffffff_0%,_#f2ede2_100%)] p-4">
                  {isCameraOpen ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full w-full rounded-[1.25rem] object-cover"
                    />
                  ) : previewUrl ? (
                    <Image
                      src={previewUrl}
                      alt="Preview da foto do veículo"
                      fill
                      unoptimized
                      className="h-full w-full rounded-[1.25rem] object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-center text-[#48565d]">
                      <Camera size={42} strokeWidth={1.8} />
                      <p className="text-xl font-medium">Preview da imagem</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => void (isCameraOpen ? handleTakePhoto() : handleOpenCamera())}
                  className="flex h-28 w-28 items-center justify-center rounded-full border border-[#354f5d] bg-white text-lg font-semibold text-[#1c2428] shadow-[0_10px_24px_rgba(0,0,0,0.08)] transition hover:bg-[#f3efe6]"
                >
                  {isCameraOpen ? 'Tirar foto' : 'Camera'}
                </button>

                {!requirePhoto && !selectedImage && (
                  <p className="max-w-[16rem] text-center text-xs font-medium text-white/70">
                    Visao de teste: a foto pode ser pulada nesta tela.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-full bg-[#0d8b62] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0a724f] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <CheckCircle2 size={18} />
                  {isSaving ? 'Salvando...' : 'Confirmar e continuar'}
                </button>

                {allowSkip && (
                  <button
                    type="button"
                    onClick={() => void handleSkip()}
                    disabled={isSaving}
                    className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    Pular quilometragem
                  </button>
                )}
              </div>

              {errorMessage && (
                <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-[#a34034]">
                  <CircleAlert size={16} />
                  {errorMessage}
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
