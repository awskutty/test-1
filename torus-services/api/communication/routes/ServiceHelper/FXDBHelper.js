function GetTableFromFXDB(pCasIns, pQuery, pValues, pLogInfo, pCallback) {
    try {
        pCasIns.execute(pQuery, pValues, {
            prepare: true
        }, function callbackGetTableFromFXDB(pError, pResult) {
            if (pError)
                console.log(pError.stack || pError)
            pCallback(pResult, pError)
        })
    } catch (ex) {
        console.log(ex.stack)
    }
}
module.exports = {
    GetTableFromFXDB: GetTableFromFXDB
}