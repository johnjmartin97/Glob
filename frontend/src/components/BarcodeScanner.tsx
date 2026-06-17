import { useEffect, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);
  onDetectedRef.current = onDetected;
  onCloseRef.current = onClose;

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    let stopFn: (() => void) | null = null;
    let done = false;

    codeReader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result, _err, controls) => {
        if (!stopFn) stopFn = () => controls.stop();
        if (result && !done) {
          done = true;
          controls.stop();
          onDetectedRef.current(result.getText());
        }
      })
      .catch(() => onCloseRef.current());

    return () => {
      done = true;
      stopFn?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-4">
        <p className="text-lg font-medium text-white">Scan barcode</p>
        <button type="button" onClick={onClose} className="text-sm text-emerald-400">
          Cancel
        </button>
      </div>
      <div className="relative flex-1">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-32 w-64 rounded border-2 border-emerald-400" />
        </div>
      </div>
    </div>
  );
}
