'use client';
import { useCallback, useState, DragEvent, ChangeEvent } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Image, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

type FileType = 'pdf' | 'image';
type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

interface UploadZoneProps {
  onUploadComplete: (filePath: string, fileType: FileType) => void;
  onError?: (message: string) => void;
  maxSizeMB?: number;
  acceptedTypes?: string[];
}

export function UploadZone({ onUploadComplete, onError, maxSizeMB = 10, acceptedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] }: UploadZoneProps) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (f: File): FileType | null => {
    if (!acceptedTypes.includes(f.type)) {
      setError('Tipo de archivo no permitido. Use PDF, JPG, PNG o WebP.');
      return null;
    }
    if (f.size > maxSizeMB * 1024 * 1024) {
      setError(`El archivo excede ${maxSizeMB} MB.`);
      return null;
    }
    return f.type === 'application/pdf' ? 'pdf' : 'image';
  };

  const handleFileSelect = useCallback((f: File) => {
    setError(null);
    const type = validateFile(f);
    if (type) {
      setFile(f);
      setStatus('idle');
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFileSelect(f);
  }, [handleFileSelect]);

  const removeFile = useCallback(() => {
    setFile(null);
    setStatus('idle');
    setProgress(0);
    setError(null);
  }, []);

  const uploadFile = async (file: File, type: FileType) => {
    setStatus('uploading');
    setProgress(0);
    setError(null);

    try {
      // 1. Obtener URL firmada
      const response = await fetch('/api/upload/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });
      if (!response.ok) throw new Error('Error obteniendo URL de subida');
      const { uploadUrl, filePath } = await response.json();

      // 2. Subir a Cloud Storage
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error('Error subiendo archivo');

      setStatus('processing');
      setProgress(100);

      // 3. Notificar al padre
      onUploadComplete(filePath, type);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error subiendo archivo';
      setError(message);
      onError?.(message);
      setStatus('error');
    }
  };

  const handleStartUpload = useCallback(() => {
    if (file) {
      const type = validateFile(file);
      if (type) uploadFile(file, type);
    }
  }, [file, validateFile, uploadFile]);

  if (status === 'success') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-medium text-green-800 dark:text-green-200">Archivo listo</p>
              <p className="text-sm text-green-600 dark:text-green-400">{file?.name}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={removeFile}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (file && status !== 'idle') {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {file.type === 'application/pdf' ? (
              <FileText className="h-6 w-6 text-red-600" />
            ) : (
              <Image className="h-6 w-6 text-blue-600" />
            )}
            <div className="min-w-0">
              <p className="font-medium truncate">{file.name}</p>
              <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
          </div>
          {status === 'error' && (
            <Button variant="ghost" size="icon" onClick={removeFile}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-300',
              status === 'error' ? 'bg-red-500' : 'bg-primary'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        {status === 'uploading' && <p className="text-sm text-muted-foreground text-center">Subiendo... {progress}%</p>}
        {status === 'processing' && (
          <p className="text-sm text-muted-foreground text-center flex items-center justify-center gap-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            Procesando con IA...
          </p>
        )}
        {status === 'error' && (
          <p className="text-sm text-red-600 dark:text-red-400 text-center flex items-center justify-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative rounded-lg border-2 border-dashed p-8 text-center transition-colors',
        status === 'idle' ? 'border-muted-foreground/25 hover:border-primary/50' : 'border-primary'
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <input
        type="file"
        id="file-upload"
        accept={acceptedTypes.join(',')}
        onChange={handleInputChange}
        className="sr-only"
        disabled={status !== 'idle'}
      />
      <label htmlFor="file-upload" className="cursor-pointer">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Upload className="h-6 w-6" />
        </div>
        <p className="text-lg font-medium">Arrastra tu PDF o imagen aquí</p>
        <p className="text-sm text-muted-foreground mt-1">o haz clic para seleccionar</p>
        <p className="text-xs text-muted-foreground mt-2">Máx. {maxSizeMB} MB · PDF, JPG, PNG, WebP</p>
      </label>
      {file && status === 'idle' && (
        <Button className="mt-4" onClick={handleStartUpload}>
          <Upload className="h-4 w-4 mr-2" />
          Subir y procesar con IA
        </Button>
      )}
    </div>
  );
}