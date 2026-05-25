import { useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import logger from '../lib/logger';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

/**
 * Loads a drawing (PDF or image) onto the supplied canvas ref.
 * Returns nothing; side effect is canvas drawing + scale state update via setScale.
 */
export default function useDrawingLoader(selectedDrawing, canvasRef, setScale) {
  useEffect(() => {
    if (!selectedDrawing) return;

    let cancelled = false;

    const renderPDFPage = async (pdf, pageNum) => {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
    };

    const load = async () => {
      try {
        const response = await fetch(`${API}/drawings/${selectedDrawing.id}/download`, {
          credentials: 'include',
        });
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }

        if (selectedDrawing.filename.toLowerCase().endsWith('.pdf')) {
          const loadingTask = pdfjsLib.getDocument(url);
          const pdf = await loadingTask.promise;
          if (!cancelled) await renderPDFPage(pdf, 1);
        } else {
          const img = new Image();
          img.onload = () => {
            if (cancelled) return;
            const canvas = canvasRef.current;
            if (!canvas) return;
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext('2d').drawImage(img, 0, 0);
          };
          img.src = url;
        }

        setScale({
          factor: selectedDrawing.scale_factor || 1.0,
          ratio: selectedDrawing.scale_ratio || '1:1',
        });
      } catch (error) {
        logger.error('Error loading drawing:', error);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedDrawing, canvasRef, setScale]);
}
