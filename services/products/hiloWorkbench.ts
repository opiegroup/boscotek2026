import { makeCodeGetter } from './common';
import { ConfigurationState, ProductDefinition } from '../../types';

export const generateHiLoWorkbenchRef = (config: ConfigurationState, product: ProductDefinition): string => {
  const getCode = makeCodeGetter(config, product);

  const liftModel = getCode('lift_model');
  const size = getCode('size');
  const worktop = getCode('worktop');
  const aboveBench = getCode('above_bench');

  // Format: BTHILO.{LiftModel}.{Width}.750.{TopMaterial}[-{AboveBench}]
  // Depth is fixed at 750mm for HiLo
  let ref = `BTHILO.${liftModel}.${size}.750.${worktop}`;
  if (aboveBench && aboveBench !== '00') ref += `-${aboveBench}`;

  return ref;
};

