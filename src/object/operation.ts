import { pointer } from './pointer';
import { ensureArray } from '../utils';

export function unset() {
  return { __op: 'Delete' };
}

export function increment(amount = 1) {
  return { __op: 'Increment', amount };
}

export function decrement(amount = 1) {
  return { __op: 'Decrement', amount };
}

export function add(objects: any | any[]) {
  return { __op: 'Add', objects: ensureArray(objects) };
}

export function addUnique(objects: any | any[]) {
  return { __op: 'AddUnique', objects: ensureArray(objects) };
}

export function remove(objects: any | any[]) {
  return { __op: 'Remove', objects: ensureArray(objects) };
}

export function bitAnd(value: number) {
  return { __op: 'BitAnd', value };
}

export function bitOr(value: number) {
  return { __op: 'BitOr', value };
}

export function bitXor(value: number) {
  return { __op: 'BitXor', value };
}

interface LCObjectInfo {
  className: string;
  objectId: string;
}

export function addRelation(objects: LCObjectInfo | LCObjectInfo[]) {
  return {
    __op: 'AddRelation',
    objects: ensureArray(objects).map((object) => pointer(object)),
  };
}

export function removeRelation(objects: LCObjectInfo | LCObjectInfo[]) {
  return {
    __op: 'RemoveRelation',
    objects: ensureArray(objects).map((object) => pointer(object)),
  };
}
