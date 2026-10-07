/** Макс. размер одного файла (JPEG/PNG/WebP). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Верхняя граница фото на публикацию (см. `maxImagesForPostType`). */
export const MAX_IMAGES_PER_POST = 10;

/** Запас на поля формы и multipart boundaries (Server Action с фото). */
export const SERVER_ACTION_MULTIPART_OVERHEAD_BYTES = 2 * 1024 * 1024;

/** Макс. тело Server Action: все слоты фото + overhead. */
export const MAX_SERVER_ACTION_BODY_BYTES =
  MAX_IMAGES_PER_POST * MAX_UPLOAD_BYTES +
  SERVER_ACTION_MULTIPART_OVERHEAD_BYTES;

/**
 * Лимит для `next.config` → `experimental.serverActions.bodySizeLimit`.
 * Override при сборке: `SERVER_ACTION_BODY_SIZE_LIMIT=60mb` (или число байт).
 */
export function resolveServerActionBodySizeLimit(): number | string {
  const override = process.env.SERVER_ACTION_BODY_SIZE_LIMIT?.trim();
  if (override) {
    const asNumber = Number(override);
    return Number.isFinite(asNumber) ? asNumber : override;
  }
  return MAX_SERVER_ACTION_BODY_BYTES;
}
