const net = require('net');
const status = require('minecraft-server-status');

exports.getStatus = function(address, port = 25565){

    if(port == null || port == ''){
        port = 25565
    }
    if(typeof port === 'string'){
        port = parseInt(port)
    }

    return new Promise((resolve, reject) => {
        status(address, port = 25565, response => {
            if(response.online==true){
                resolve({
                    online: true,
                    motd: response.motd,
                    version: "1.8.9",
                    onlinePlayers: response.players.now,
                    maxPlayers: response.players.max
                })
            }
            else resolve({online:false})
        })
        })

}