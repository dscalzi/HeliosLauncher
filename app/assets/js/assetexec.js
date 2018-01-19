const {AssetGuard} = require('./assetguard.js')

const tracker = new AssetGuard(process.argv[2], process.argv[3])
console.log('AssetExec Started')

// Temporary for debug purposes.
process.on('unhandledRejection', r => console.log(r))

tracker.on('totaldlprogress', (data) => {
    process.send({task: 0, total: data.total, value: data.acc, percent: parseInt((data.acc/data.total)*100)})
})

tracker.on('dlcomplete', () => {
    process.send({task: 1})
})

process.on('message', (msg) => {
    if(msg.task === 0){
        const func = msg.content
        if(typeof tracker[func] === 'function'){
            const f = tracker[func]
            const res = f.apply(tracker, msg.argsArr)
            if(res instanceof Promise){
                res.then((v) => {
                    process.send({result: v})
                })
            } else {
                process.send({result: res})
            }
        }
    }
})

process.on('disconnect', () => {
    console.log('AssetExec Disconnected')
    process.exit(0)
})