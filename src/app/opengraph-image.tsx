import { renderSocialImage, SOCIAL_IMAGE } from "@/lib/og";

export const alt = SOCIAL_IMAGE.alt;
export const size = SOCIAL_IMAGE.size;
export const contentType = SOCIAL_IMAGE.contentType;

export default function Image() {
  return renderSocialImage();
}
