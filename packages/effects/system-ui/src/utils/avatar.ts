import { getSystemApiClient } from '../api/client';

/** 压缩后头像的边长（像素）。顶栏、列表里显示的头像最大也就一两百像素。 */
export const AVATAR_SIZE = 256;

/**
 * 头像对象键 → 可直接放进 `<img src>` 的地址。
 *
 * 后端 `sys_user.avatar` 存的是 `StorageProvider` 的对象键（形如 `avatar/1/<随机串>.webp`），
 * 不是 URL；读取端点是 `GET /api/system/avatar/{userId}/{file}`，正好等于 `/system/` + 键。
 * 该端点**免登录**（`<img>` 不带 Authorization 头），见后端 `SysAvatarController`。
 *
 * 没有头像时返回空串，由调用方回落到默认头像或首字母。
 */
export function avatarUrl(key?: null | string): string {
  if (!key) {
    return '';
  }
  const base = (getSystemApiClient().getBaseUrl() ?? '').replace(/\/+$/, '');
  return `${base}/system/${key}`;
}

/**
 * 把用户选的图片居中裁成正方形、缩到 {@link AVATAR_SIZE}，重新编码后返回。
 *
 * 用 canvas 实现，不引依赖。重新编码有两个作用：
 * 一是手机拍的照片动辄几 MB，压完只剩几十 KB，不会撞后端 1MB 的上限；
 * 二是 GIF、BMP 这些后端不收的格式，也在这里统一转成 WebP（浏览器不支持 WebP 编码时转成 PNG）。
 * 后端照样会按魔数再校验一遍，这里只是为了体验，不是安全边界。
 */
export async function compressAvatar(file: File): Promise<File> {
  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  if (!side) {
    throw new Error('图片无法识别');
  }
  const target = Math.min(side, AVATAR_SIZE);
  const canvas = document.createElement('canvas');
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('当前浏览器不支持图片处理');
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    img,
    (img.naturalWidth - side) / 2,
    (img.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    target,
    target,
  );

  // 浏览器不支持 WebP 编码时，toBlob 会按规范回落成 PNG，blob.type 会如实反映，
  // 所以扩展名跟着 blob.type 走，不能假定一定是 webp
  const blob = await toBlob(canvas, 'image/webp', 0.9);
  const ext = blob.type === 'image/webp' ? 'webp' : 'png';
  return new File([blob], `avatar.${ext}`, { type: blob.type });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.addEventListener('load', () => {
      URL.revokeObjectURL(url);
      resolve(img);
    });
    img.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片无法识别'));
    });
    img.src = url;
  });
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片压缩失败'))),
      type,
      quality,
    );
  });
}
