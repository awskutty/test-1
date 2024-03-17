/*
  @Decsription      : To handle analytics related operations
  @Last Error Code  : 'ERR-KNEX-231107'
*/

// Require dependencies
var reqInstanceHelper = require('../common/InstanceHelper');
var reqTranDB = require('../instance/TranDBInstance');
var infoKeyWord = 'INFO';
var warnKeyWord = 'WARN';
var errKeyWord = 'ERROR';
var defaultRoutingKey = 'CLT-0~APP-0~TNT-0~ENV-0';
var strConString = 'ANALYTICS';
var serviceName = 'AnalyticsHelper';
var mAnalyticsSessionValue = {};
var strAnalyConfig = null;


//GET Trandb instance for ANALYTICS KEY FROM REDIS
function createAnalyticInstance(pHeaders, pCallback) {
    if (!pHeaders) {
        pHeaders = {};
        pHeaders.routingkey = 'CLT-0~APP-0~TNT-0~ENV-0'
    }
    GetAnalyticsConfig(pHeaders, null, function callbackGetAnalyticConfig(pErr, pConfig) {
        try {
            if (pErr) {
                _PrintError(null, '', 'Error on getting Analytics key', pErr)
                pCallback(pErr);
            } else {
                reqTranDB.CreateTranDBInstance('knex', defaultRoutingKey, JSON.parse(pConfig), function callbackTranDBIns(pResult) {
                    return pCallback(pResult);
                })
            }
        } catch (error) {
            return pCallback('Error');
        }
    })
}

//GET ANALYTICS KEYvalue FROM REDIS
function GetAnalyticsConfig(pHeaders, pLogInfo, pCallback) {
    try {
        _PrintInfo(pLogInfo, 'routingkey ==== ' + pHeaders['routingkey'])
        reqInstanceHelper.GetRedisKey(strConString, pHeaders['routingkey'], function callbackGetRedisKey(pAnlKey) {
            reqInstanceHelper.GetRedisValue(strConString, pHeaders, function (pAnlValue, pErr) {
                try {
                    if (pErr) {
                        _PrintError(pLogInfo, '', 'Error on getting Analytics key', pErr)
                        return pCallback(pErr, null)
                    } else {
                        return pCallback(null, pAnlValue)
                    }
                } catch (error) {
                    return pCallback(error, null)
                }
            })
        })
    } catch (error) {
        return pCallback(error, null)
    }
}



function _PrintInfo(pLogInfo, pMessage) {
    reqInstanceHelper.PrintInfo('AnalyticsHelper', pMessage, pLogInfo)
}

function _PrintError(pLogInfo, pErrCode, pMessage, pError) {
    reqInstanceHelper.PrintError('AnalyticsHelper', pError, pErrCode, pLogInfo, pMessage)
}

module.exports = {
    CreateAnalyticInstance: createAnalyticInstance

}