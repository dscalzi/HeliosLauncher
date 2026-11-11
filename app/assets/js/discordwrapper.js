// Work in progress
const { LoggerUtil } = require('helios-core')

const { Client } = require('discord-rpc-patch')

const Lang = require('./langloader')

let client
let activity

exports.initRPC = function(){ LoggerUtil.info('Discord RPC disabled.') }
exports.updateDetails = function(){}
exports.shutdownRPC = function(){}