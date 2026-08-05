import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#c7f36b", color: "#153d34", border: "5px solid #153d34", borderRadius: 16, fontSize: 38, fontWeight: 900 }}>M</div>,
    size,
  );
}
