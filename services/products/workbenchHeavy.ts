import { makeCodeGetter } from './common';
import { ConfigurationState, ProductDefinition } from '../../types';

export const generateWorkbenchHeavyRef = (config: ConfigurationState, product: ProductDefinition): string => {
  const getCode = makeCodeGetter(config, product);

  const size = getCode('size');
  const under = getCode('under_bench');
  const pos = getCode('under_bench_pos');
  const above = getCode('above_bench');
  const inc = getCode('shelf_incline');
  const mobility = getCode('mobility');
  
  // Format: WBH.Size.UnderBench(Pos).AboveBench(Inc)[-Mobility]
  let ref = `WBH.${size}.${under}`;
  if (pos) ref += `.${pos}`;
  ref += `.${above}`;
  if (inc) ref += `.${inc}`;
  if (mobility) ref += `-${mobility}`;
  return ref;
};

