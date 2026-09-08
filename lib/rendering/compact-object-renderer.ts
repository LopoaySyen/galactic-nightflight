import type { CompactObject } from './compact-object-catalog.ts';
import type { Vector3 } from '../physics/vector.ts';
import type { ViewCamera } from './contracts.ts';
import { lensView } from '../physics/gravitational-lensing.ts';
import { projectDirectionPerspective } from './projection.ts';

/** Accretion emission is a clearly labelled visual model, not measured photometry. */
export function drawCompactObject(context: CanvasRenderingContext2D, object: CompactObject, observer: Vector3,
  camera: ViewCamera, width: number, height: number) {
  const lens=lensView(object,observer);
  if(!lens)return;
  const projected=projectDirectionPerspective(lens.direction,camera,width,height);
  if(!projected.visible)return;
  const focal=width/(2*Math.tan(camera.horizontalFieldOfViewDegrees*Math.PI/360));
  const shadow=Math.tan(lens.shadowAngle)*focal;
  if(shadow<1)return;
  const x=projected.canvasX,y=projected.canvasY;
  context.save(); context.globalCompositeOperation='screen';
  context.translate(x,y);context.rotate(-.25);
  // A thin inclined emitting flow around the Schwarzschild shadow.
  const glow=context.createRadialGradient(0,0,shadow,0,0,shadow*4.5);
  glow.addColorStop(0,'rgba(255,223,175,0)');
  glow.addColorStop(.18,'rgba(255,204,127,.78)');
  glow.addColorStop(.44,'rgba(238,113,57,.38)');glow.addColorStop(1,'rgba(146,58,34,0)');
  context.save();context.scale(1,.34);context.fillStyle=glow;context.fillRect(-shadow*5,-shadow*5,shadow*10,shadow*10);context.restore();
  context.globalCompositeOperation='source-over';context.fillStyle='#010103';
  context.beginPath();context.arc(0,0,shadow,0,2*Math.PI);context.fill();
  context.strokeStyle='rgba(255,211,159,.62)';context.lineWidth=Math.max(.7,shadow*.055);
  context.beginPath();context.arc(0,0,shadow*1.04,0,2*Math.PI);context.stroke();context.restore();
}
