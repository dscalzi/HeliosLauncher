/**
 * VerifyClient
 *
 * Клиент проверки кода доступа «Пепел Эдема».
 * Контракт с бэкендом (pepel-backend):
 *   GET /verify?code=<PEPEL-XXXX-XXXX>&hwid=<fingerprint>&nick=<username>
 *   → 200 {"active": true|false, "tier": "iron"|"gold"|"diamond"|null}
 *
 * Бэкенд на паузе — пока используется мок (MOCK_VERIFY = true).
 * При подключении реального API: выставить MOCK_VERIFY = false и VERIFY_URL.
 *
 * @module verifyclient
 */
const { LoggerUtil } = require('helios-core')

const log = LoggerUtil.getLogger('VerifyClient')

// TODO: заменить на боевой URL при пробуждении pepel-backend.
const VERIFY_URL = 'http://localhost:8000/verify'
const MOCK_VERIFY = true

exports.CODE_REGEX = /^PEPEL-[A-Z0-9]{4}-[A-Z0-9]{4}$/

/**
 * Проверить код доступа на бэкенде.
 *
 * @param {string} code Код доступа (PEPEL-XXXX-XXXX).
 * @param {string} nick Ник игрока.
 * @param {string} hwid Отпечаток железа (пока не собирается — null).
 * @returns {Promise.<{active: boolean, tier: string|null}>}
 */
exports.verifyCode = async function(code, nick, hwid = null){
    if(MOCK_VERIFY){
        log.warn(`МОК-режим /verify: код ${code} принят без проверки (бэкенд на паузе).`)
        return { active: true, tier: 'iron' }
    }

    const params = new URLSearchParams({ code, nick })
    if(hwid != null){
        params.set('hwid', hwid)
    }
    const res = await fetch(`${VERIFY_URL}?${params.toString()}`)
    if(!res.ok){
        throw new Error(`Сервер проверки ответил ${res.status}`)
    }
    return await res.json()
}
