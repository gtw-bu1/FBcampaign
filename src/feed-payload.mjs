// Vercel Functions accept request bodies up to 4.5 MB, including the JSON envelope.
const MAX_BODY_BYTES = 4_500_000;

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('讀取附加圖片失敗，請重新選取。'));
    reader.readAsDataURL(file);
  });
}

export async function makeFeedPayload(message, poster, files, scheduledPublishTime) {
  const error = '圖片總量過大，請縮小圖片或減少張數。';
  const estimated = files.reduce((sum, file) => sum + 4 * Math.ceil(file.size / 3), poster.length);
  if (estimated > MAX_BODY_BYTES) throw new Error(error);
  const images = files.length ? { imageDataUrls: [poster, ...await Promise.all(files.map(readImage))] } : { imageDataUrl: poster };
  const payload = JSON.stringify({ message, ...images, scheduledPublishTime });
  if (new Blob([payload]).size > MAX_BODY_BYTES) throw new Error(error);
  return payload;
}
