import React from 'react';
import { Thing, sum } from '{{pkgname}}';

export default () => {
  return (
    <>
      <Thing />
      <div>{sum(1, 2)}</div>
    </>
  );
};
