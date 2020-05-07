import React, { Component } from 'react';
import { render } from 'ink';
import { GluegunToolbox } from 'gluegun';
import { ToolboxProvider } from '../components/Toolbox';

export default (toolbox: GluegunToolbox) => {
  toolbox.render = (children) => {
    return render(
      <ToolboxProvider toolbox={toolbox}>{children}</ToolboxProvider>
    );
  };
};
