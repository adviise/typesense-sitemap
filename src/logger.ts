let shouldEmitLogs = false;

export const log = (message: unknown) => {
    if (shouldEmitLogs) {
        console.log(message);
    }
};

export const initLogger = (emitLogs: boolean) => {
    shouldEmitLogs = emitLogs;
    return log;
};

export const getLogEmitStatus = () => shouldEmitLogs;
