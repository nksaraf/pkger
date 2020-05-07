import React from 'react';

export const sum = (a: number, b: number) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('boop');
  }
  return a + b;
};

export const Thing = () => {
  return <div>Hello world</div>;
};
