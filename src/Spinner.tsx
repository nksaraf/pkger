import React from 'react';
import { Box } from 'ink';
import { Color } from 'ink';
import spinners from 'cli-spinners';
export function Spinner({ type, children = null, color = 'white' }) {
  const [frame, setFrame] = React.useState(0);
  const spinnerRef = React.useRef(typeof type === 'string' ? spinners[type] : type || spinners.dots);
  const frameRef = React.useRef(frame);
  frameRef.current = frame;
  React.useEffect(() => {
    const switchFrame = () => {
      const spinner = spinnerRef.current;
      const frame = frameRef.current;
      const isLastFrame = frameRef.current === spinner.frames.length - 1;
      const nextFrame = isLastFrame ? 0 : frame + 1;
      setFrame(nextFrame);
    };
    let timer = setInterval(switchFrame, spinnerRef.current.interval);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return (<Box>
    <Color {...{ [color]: true }}>
      {spinnerRef.current.frames[frame]} {children}
    </Color>
  </Box>);
}
