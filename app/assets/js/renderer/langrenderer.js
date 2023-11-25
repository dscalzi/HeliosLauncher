// HACK FIXME

let lang

export async function loadLanguage() {
    lang = await window.api.Lang.getLang()
}

export function query(id, placeHolders){
    let query = id.split('.')
    let res = lang
    for(let q of query){
        res = res[q]
    }
    let text = res === lang ? '' : res
    if (placeHolders) {
        Object.entries(placeHolders).forEach(([key, value]) => {
            text = text.replace(`{${key}}`, value)
        })
    }
    return text
}

export function queryJS(id, placeHolders){
    return query(`js.${id}`, placeHolders)
}

export function queryEJS(id, placeHolders){
    return query(`ejs.${id}`, placeHolders)
}