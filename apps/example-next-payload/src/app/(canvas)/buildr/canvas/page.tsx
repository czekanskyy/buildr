import { BuildrCanvasPage, canvasMetadata } from '@next-buildr/next/canvas';
import { isSignedIn } from '../../../../lib/auth.ts';
import { CanvasClient } from './canvas-client.tsx';

export const metadata = canvasMetadata;

export default function Canvas() {
  return (
    <BuildrCanvasPage authorize={() => isSignedIn()}>
      <CanvasClient />
    </BuildrCanvasPage>
  );
}
