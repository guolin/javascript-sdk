export interface Pointer {
  __type: 'Pointer';
  className: string;
  objectId: string;
}

export function pointer({ className, objectId }: { className: string; objectId: string }): Pointer {
  return { __type: 'Pointer', className, objectId };
}

export function ensurePointer(className: string, object: string | { objectId: string }): Pointer {
  const objectId = typeof object === 'string' ? object : object.objectId;
  return pointer({ className, objectId });
}
