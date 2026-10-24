import { model, Schema, type Types } from 'mongoose';
import {
  COMPONENT_BRANDS,
  COMPONENT_SEGMENTS,
  COMPONENT_TYPES,
  OPERATING_SYSTEMS,
  type ComponentBrand,
  type ComponentSegment,
  type ComponentType,
  type OperatingSystem,
} from '@tgh/shared';

export interface ComponentDoc {
  _id: Types.ObjectId;
  /** Stable reference used by seed data and requirement mapping, e.g. "gpu-rtx-3060". */
  key: string;
  type: ComponentType;
  brand: ComponentBrand;
  model: string;
  series: string;
  segment: ComponentSegment;
  searchText: string;
  /** Relative performance index — comparable within a component type only. */
  score: number;
  vramGb: number | null;
  releaseYear: number | null;
  /** Only filled from a named, dated local source. Never estimated. */
  priceTnd: { amount: number; source: string; updatedAt: Date } | null;
}

const componentSchema = new Schema<ComponentDoc>({
  key: { type: String, required: true, unique: true },
  type: { type: String, enum: COMPONENT_TYPES, required: true },
  brand: { type: String, enum: COMPONENT_BRANDS, required: true },
  model: { type: String, required: true },
  series: { type: String, required: true },
  segment: { type: String, enum: COMPONENT_SEGMENTS, required: true },
  searchText: { type: String, required: true },
  score: { type: Number, required: true },
  vramGb: { type: Number, default: null },
  releaseYear: { type: Number, default: null },
  priceTnd: {
    type: new Schema(
      { amount: Number, source: String, updatedAt: Date },
      { _id: false },
    ),
    default: null,
  },
});

componentSchema.index({ type: 1, score: 1 });
componentSchema.index({ type: 1, brand: 1, segment: 1, score: -1 });
componentSchema.index({ type: 1, searchText: 1 });

export const HardwareComponent = model<ComponentDoc>('HardwareComponent', componentSchema);

export interface PcSpecDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  cpuId: Types.ObjectId;
  gpuId: Types.ObjectId;
  ramGb: number;
  storageGb: number | null;
  os: OperatingSystem;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const pcSpecSchema = new Schema<PcSpecDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    cpuId: { type: Schema.Types.ObjectId, ref: 'HardwareComponent', required: true },
    gpuId: { type: Schema.Types.ObjectId, ref: 'HardwareComponent', required: true },
    ramGb: { type: Number, required: true },
    storageGb: { type: Number, default: null },
    os: { type: String, enum: OPERATING_SYSTEMS, default: 'windows-11' },
    isPrimary: { type: Boolean, default: false },
  },
  { timestamps: true },
);

pcSpecSchema.index({ userId: 1, createdAt: 1 });

export const PcSpec = model<PcSpecDoc>('PcSpec', pcSpecSchema);
