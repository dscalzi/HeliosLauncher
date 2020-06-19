let target = require('./assetguard')[process.argv[2]]
if(target == null){
    process.send({context: 'error', data: null, error: 'Invalid class name'})
    console.error('Invalid class name passed to argv[2], cannot continue.')
    process.exit(1)
}
let tracker = new target(...(process.argv.splice(3)))

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

//const tracker = new AssetGuard(process.argv[2], process.argv[3])
console.log('AssetExec Started')

// Temporary for debug purposes.
process.on('unhandledRejection', r => console.log(r))

let percent = 0
function assignListeners(){
    tracker.on('validate', (data) => {
        process.send({context: 'validate', data})
    })
    tracker.on('progress', (data, acc, total) => {
        const currPercent = parseInt((acc/total) * 100)
        if (currPercent !== percent) {
            percent = currPercent
            process.send({context: 'progress', data, value: acc, total, percent})
        }
    })
    tracker.on('complete', (data, ...args) => {
        process.send({context: 'complete', data, args})
    })
    tracker.on('error', (data, error) => {
        process.send({context: 'error', data, error})
    })
}

assignListeners()

process.on('message', (msg) => {
    if(msg.task === 'execute'){
        const func = msg.function
        let nS = tracker[func] // Nonstatic context
        let iS = target[func] // Static context
        if(typeof nS === 'function' || typeof iS === 'function'){
            const f = typeof nS === 'function' ? nS : iS
            const res = f.apply(f === nS ? tracker : null, msg.argsArr)
            if(res instanceof Promise){
                res.then((v) => {
                    process.send({result: v, context: func})
                }).catch((err) => {
                    process.send({result: err.message || err, context: func})
                })
            } else {
                process.send({result: res, context: func})
            }
        } else {
            process.send({context: 'error', data: null, error: `Function ${func} not found on ${process.argv[2]}`})
        }
    } else if(msg.task === 'changeContext'){
        target = require('./assetguard')[msg.class]
        if(target == null){
            process.send({context: 'error', data: null, error: `Invalid class ${msg.class}`})
        } else {
            tracker = new target(...(msg.args))
            assignListeners()
        }
    }
})

process.on('disconnect', () => {
    console.log('AssetExec Disconnected')
    process.exit(0)
})