import os from 'os';

export function resolveMaxRAM() {
    const mem = os.totalmem();
    return mem >= 8000000000 ? "4G" : mem >= 6000000000 ? "3G" : "2G";
}

export function resolveMinRAM() {
    return resolveMaxRAM();
}