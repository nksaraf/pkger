import React, { Component } from 'react';
import { render } from 'ink';
import { Toolbox, GluegunToolbox } from 'gluegun';
import { ToolboxProvider } from '../components/Toolbox';

declare module 'gluegun' {
  interface GluegunInk {
    render: typeof render;
  }

  interface Toolbox extends GluegunToolbox {
    ink: GluegunInk;
  }
}

export default (toolbox: Toolbox) => {
  toolbox.ink = {
    render: (children) => {
      return render(
        <ToolboxProvider toolbox={toolbox}>{children}</ToolboxProvider>
      );
    },
  };
};
