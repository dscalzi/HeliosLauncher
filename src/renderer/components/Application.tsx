import { hot } from 'react-hot-loader/root';
import * as React from 'react';
import Frame from './frame/Frame';
import Welcome from './welcome/Welcome';

const Application = () => (
    <>
    <Frame />
    <Welcome />
    </>
);

export default hot(Application);