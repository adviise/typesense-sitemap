let shouldEmitLogs = false;

export const log = (message: any) => {
    if (shouldEmitLogs) {
        // eslint-disable-next-line no-console
        console.log(message);
    }
};

export const initLogger = (emitLogs: boolean) => {
    shouldEmitLogs = emitLogs;
    return log;
};

export const getLogEmitStatus = () => shouldEmitLogs;
