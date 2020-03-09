import { hot } from 'react-hot-loader/root';
import * as React from 'react';
import Frame from './Frame';

const Application = () => (
    <>
    <Frame />
    <div>
        Hello World from Electron!
    </div>
    </>
);

export default hot(Application);