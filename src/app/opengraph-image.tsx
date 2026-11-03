import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const alt = 'Sổ Chi';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const logo = await readFile(join(process.cwd(), 'public/icons/icon-512.png'));
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 64,
        background: '#13182a',
        color: '#ffffff',
      }}
    >
      {/* Satori only renders plain <img>; next/image doesn't apply here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoSrc} width={240} height={240} alt="" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 112, fontWeight: 600 }}>Sổ Chi</div>
        <div style={{ fontSize: 40, opacity: 0.7 }}>
          Quản lý chi tiêu cá nhân
        </div>
      </div>
    </div>,
    size,
  );
}
