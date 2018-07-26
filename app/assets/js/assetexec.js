const { AssetGuard } = require('./assetguard')

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const tracker = new AssetGuard(process.argv[2], process.argv[3])
console.log('AssetExec Started')

// Temporary for debug purposes.
process.on('unhandledRejection', r => console.log(r))

tracker.on('validate', (data) => {
    process.send({context: 'validate', data})
})
tracker.on('progress', (data, acc, total) => {
    process.send({context: 'progress', data, value: acc, total, percent: parseInt((acc/total)*100)})
})
tracker.on('complete', (data, ...args) => {
    process.send({context: 'complete', data, args})
})
tracker.on('error', (data, error) => {
    process.send({context: 'error', data, error})
})

process.on('message', (msg) => {
    if(msg.task === 'execute'){
        const func = msg.function
        let nS = tracker[func]
        let iS = AssetGuard[func]
        if(typeof nS === 'function' || typeof iS === 'function'){
            const f = typeof nS === 'function' ? nS : iS
            const res = f.apply(f === nS ? tracker : null, msg.argsArr)
            if(res instanceof Promise){
                res.then((v) => {
                    process.send({result: v, context: func})
                }).catch((err) => {
                    process.send({result: err.message, context: func})
                })
            } else {
                process.send({result: res, context: func})
            }
        }
    }
})

process.on('disconnect', () => {
    console.log('AssetExec Disconnected')
    process.exit(0)
})