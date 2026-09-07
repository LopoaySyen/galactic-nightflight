export interface SkyPointerInput {
  pointerId:number;pointerType:string;clientX:number;clientY:number;buttons:number;button?:number;isPrimary?:boolean;
}
export interface CompletedSkyGesture {pointerId:number;pointerType:string;x:number;y:number;dragged:boolean}

/** A press is only a possible click. Panning requires both a held primary
 * button and actual movement; finishing always clears state before any picking. */
export function createSkyPointerController(threshold=5) {
  let active: {id:number;type:string;x:number;y:number;startX:number;startY:number;dragged:boolean}|null=null;
  return {
    get activePointerId(){return active?.id??null;},
    begin(event:SkyPointerInput){
      if(event.isPrimary===false || (event.button!==undefined && event.button!==0))return false;
      active={id:event.pointerId,type:event.pointerType,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,dragged:false};
      return true;
    },
    move(event:SkyPointerInput){
      if(!active||active.id!==event.pointerId)return null;
      if((event.buttons&1)===0){active=null;return null;}
      const wasDragging=active.dragged;
      const dragged=wasDragging||Math.hypot(event.clientX-active.startX,event.clientY-active.startY)>threshold;
      const deltaX=event.clientX-(wasDragging?active.x:active.startX),deltaY=event.clientY-(wasDragging?active.y:active.startY);
      active={...active,x:event.clientX,y:event.clientY,dragged};
      return dragged?{deltaX,deltaY,started:!wasDragging}:null;
    },
    end(event:Pick<SkyPointerInput,'pointerId'|'clientX'|'clientY'>):CompletedSkyGesture|null{
      if(!active||active.id!==event.pointerId)return null;
      const previous=active;active=null;
      return {pointerId:previous.id,pointerType:previous.type,x:event.clientX,y:event.clientY,
        dragged:previous.dragged||Math.hypot(event.clientX-previous.startX,event.clientY-previous.startY)>threshold};
    },
    cancel(){active=null;},
  };
}
