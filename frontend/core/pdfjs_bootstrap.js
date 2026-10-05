// FinObra Patch 10 — bootstrap PDF.js para CSP
import * as pdfjsLib from '/js/vendor/pdf.min.mjs';
    window.pdfjsLib = pdfjsLib;
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/vendor/pdf.worker.min.mjs';
