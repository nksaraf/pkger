import React, { Component } from 'react';
import { render } from 'ink';
import { GluegunToolbox } from 'gluegun';
import { ToolboxProvider } from '../components/Toolbox';

declare module 'gluegun' {
  interface GluegunInk {
    render: typeof render;
  }

  interface GluegunToolbox {
    ink: GluegunInk;
  }
}

export default (toolbox: GluegunToolbox) => {
  toolbox.ink = {
    render: (children) => {
      return render(
        <ToolboxProvider toolbox={toolbox}>{children}</ToolboxProvider>
      );
    },
  };
};
