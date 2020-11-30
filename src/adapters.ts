import { Adapters } from '@leancloud/adapter-types';

const ADAPTERS: Partial<Adapters> = {};

const onSetListeners: Array<(adapters: Readonly<Partial<Adapters>>) => void> = [];

export function setAdapters(adapters: Partial<Adapters>): void {
  Object.assign(ADAPTERS, adapters);
  onSetListeners.forEach((listener) => listener(ADAPTERS));
}

export function getAdapters(): Readonly<Partial<Adapters>> {
  return ADAPTERS;
}

export function onAdaptersSet(listener: (adapters: Readonly<Partial<Adapters>>) => void): void {
  onSetListeners.push(listener);
}
