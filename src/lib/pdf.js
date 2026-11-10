// =============================================================================
// PDF HELPERS: check and read a PDF that Lars attaches in the chat.
// See src/components/PdfAttach.jsx for the on-screen part.
// =============================================================================

// Netlify accepts requests up to about 6 MB, and a PDF grows by a third when
// sent, so 4 MB is the safe maximum.
export const MAX_PDF_BYTES = 4 * 1024 * 1024;

export function formatSize(bytes) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Checks the file and reads it. Returns { pdf } or { problem } (a sentence for Lars).
export async function readPdf(file) {
  if (!file) return { problem: "No file found." };
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) return { problem: `"${file.name}" isn't a PDF. Only PDFs can be attached for now.` };
  if (file.size > MAX_PDF_BYTES) {
    return {
      problem: `"${file.name}" is ${formatSize(file.size)}. The limit is 4 MB, so try a smaller or compressed version.`,
    };
  }
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  }).catch(() => "");
  if (!data) return { problem: `Couldn't read "${file.name}". Try again.` };
  return { pdf: { name: file.name, size: file.size, data } };
}
