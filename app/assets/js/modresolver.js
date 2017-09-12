function _shouldInclude(mdle){
    return mdle.required == null || mdle.required.value == null || mdle.required.value === true || (mdle.required.value === false && mdle.required.def === true)
}

function resolveForgeFromDistro(moduleArr){
    const mods = []

    for(let i=0; i<moduleArr.length; ++i){
        if(moduleArr[i].type != null && moduleArr[i].type === 'forgemod'){
            if(_shouldInclude(moduleArr[i])){
                mods.push(moduleArr[i])
            }
        }
    }

    return mods
}