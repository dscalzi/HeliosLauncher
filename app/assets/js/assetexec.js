const {AssetGuard} = require('./assetguard.js')

const tracker = new AssetGuard(process.argv[2], process.argv[3], process.argv[4])
console.log('AssetExec Started')

// Temporary for debug purposes.
process.on('unhandledRejection', r => console.log(r))

tracker.on('assetVal', (data) => {
    process.send({task: 0, total: data.total, value: data.acc, content: 'validateAssets'})
})

tracker.on('totaldlprogress', (data) => {
    process.send({task: 0, total: data.total, value: data.acc, percent: parseInt((data.acc/data.total)*100), content: 'dl'})
})

tracker.on('extracting', () => {
    process.send({task: 0.7, content: 'dl'})
})

tracker.on('dlcomplete', () => {
    process.send({task: 1, content: 'dl'})
})

tracker.on('jExtracted', (jPath) => {
    process.send({task: 2, content: 'dl', jPath})
})

tracker.on('dlerror', (err) => {
    process.send({task: 0.9, content: 'dl', err})
})

process.on('message', (msg) => {
    if(msg.task === 0){
        const func = msg.content
        let nS = tracker[func]
        let iS = AssetGuard[func]
        if(typeof nS === 'function' || typeof iS === 'function'){
            const f = typeof nS === 'function' ? nS : iS
            const res = f.apply(f === nS ? tracker : null, msg.argsArr)
            if(res instanceof Promise){
                res.then((v) => {
                    process.send({result: v, content: msg.content})
                }).catch((err) => {
                    process.send({result: err, content: msg.content})
                })
            } else {
                process.send({result: res, content: msg.content})
            }
        }
    }
})

process.on('disconnect', () => {
    console.log('AssetExec Disconnected')
    process.exit(0)
})