/**
 *Decsription      : To get report config and maintain
 *Last Error Code  : ERR-RPT-60724
 **/

//var reqConfig = require('../../config/config.json');
var reqRedis = require('redis');
var reqInstanceHelper = require('../common/InstanceHelper');
var mRptSessionValue = {};
var strReport = 'JASPER_SERVER';
var arrConnectedServers = [];
var defaultRedisKey = 'clt-0~app-0~tnt-0~env-0';

var serviceName = 'ReportInstance';
var objLogInfo = null;

function SetReportConfig(pKey, pVal, pCallback) {
    try {
        if (!mRptSessionValue[pKey.toUpperCase()]) {
            mRptSessionValue[pKey.toUpperCase()] = pVal
        }
        pCallback({
            status: 'SUCCESS'
        })
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-RPT-60716', 'Error in SetReportConfig function', error);
    }
}

function GetReportConfig(pHeaders, pLogInfo, pCallback) {
    try {
        var strRptConfig = null;
        var sysRoutingId = '';
        if (!pHeaders) {
            pHeaders = {};
        }
        _PrintInfo(pLogInfo, 'routingkey ==== ' + pHeaders['routingkey'])
        reqInstanceHelper.GetRedisKey(strReport, pHeaders['routingkey'], function (redisKey) {
            try {
                var NeedSysRouting = 'N';
                var sessId = "SESSIONID-" + pHeaders['session-id'];
                reqInstanceHelper.GetConfig(sessId, function (redisSession) {
                    if (redisSession != 0) {
                        // reqInstanceHelper.PrintInfo(serviceName, 'Got the session id', tmpObjLogInfo);
                        var parsedSession = JSON.parse(redisSession);
                        if (parsedSession.length) {
                            NeedSysRouting = parsedSession[0].NEED_SYSTEM_ROUTING;
                            sysRoutingId = parsedSession[1].RoutingSId;
                        }

                    }
                    if (NeedSysRouting == 'Y') {
                        // redisKey = redisKey + '~' + sysRoutingId
                    }
                    reqInstanceHelper.IsRedisKeyAvail(redisKey, function (result) {
                        try {
                            if (result) {
                                if (mRptSessionValue[redisKey.toUpperCase()]) {
                                    _PrintInfo(pLogInfo, 'JASPER_SERVER key available')
                                    strRptConfig = mRptSessionValue[redisKey.toUpperCase()];
                                    return _PrepareAndSendCallback('SUCCESS', strRptConfig, '', '', null, null, pCallback)

                                } else {
                                    _PrintInfo(pLogInfo, 'Jasper report config')
                                    reqInstanceHelper.GetRedisValue(strReport, pHeaders, function (pKey, pErr) {
                                        try {
                                            if (pErr)
                                                strRptConfig = mRptSessionValue[(strReport + '~' + defaultRedisKey).toUpperCase()];
                                            else {
                                                mRptSessionValue[redisKey.toUpperCase()] = pKey
                                                strRptConfig = pKey
                                            }
                                            return _PrepareAndSendCallback('SUCCESS', strRptConfig, '', '', null, null, pCallback)
                                        } catch (error) {
                                            return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60717', 'Error in GetReportConfig() function', error, null, pCallback)
                                        }
                                    })
                                }
                            } else {
                                _PrintInfo(pLogInfo, 'Default JASPER_SERVER')
                                strRptConfig = mRptSessionValue[(strReport + '~' + defaultRedisKey).toUpperCase()];
                                if (!strRptConfig) {
                                    _PrintInfo(pLogInfo, 'Jasper report config')
                                    reqInstanceHelper.GetRedisValue(strReport, pHeaders, function (pKey, pErr) {
                                        try {
                                            if (pErr)
                                                strRptConfig = mRptSessionValue[(strReport + '~' + defaultRedisKey).toUpperCase()];
                                            else {
                                                mRptSessionValue[redisKey.toUpperCase()] = pKey
                                                strRptConfig = pKey
                                            }
                                            return _PrepareAndSendCallback('SUCCESS', strRptConfig, '', '', null, null, pCallback)
                                        } catch (error) {
                                            return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60717', 'Error in GetReportConfig() function', error, null, pCallback)
                                        }
                                    })
                                } else {
                                    return _PrepareAndSendCallback('SUCCESS', strRptConfig, '', '', null, null, pCallback)
                                }
                            }
                        } catch (error) {
                            return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60718', 'Error in GetReportConfig() function', error, null, pCallback)
                        }
                    });

                });


            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60719', 'Error in GetReportConfig() function', error, null, pCallback)
            }
        });
    } catch (error) {
        return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60720', 'Error in GetReportConfig() function', error, null, pCallback)
    }
}

// To print the information 
function _PrintInfo(pLogInfo, pMessage) {
    reqInstanceHelper.PrintInfo('ReportInstance', pMessage, pLogInfo);
}

// To prepare and send callback object
function _PrepareAndSendCallback(pStatus, pData, pErrorCode, pErrMsg, pError, pWarning, pCallback) {
    var objCallback = {
        Status: pStatus,
        Data: pData,
        ErrorCode: pErrorCode,
        ErrorMsg: pErrMsg,
        Error: pError,
        Warning: pWarning
    }
    return pCallback(objCallback)
}

module.exports = {
    GetReportConfig: GetReportConfig,
    SetReportConfig: SetReportConfig
}