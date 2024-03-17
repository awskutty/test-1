/*
@Api_Name           : /ClearCache,
@Description        : To  clear the users session  call from press F9 key press,
@Last_Error_Code    : ERR-AUT-10713
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqCacheRedisInstance = require('../../../../torus-references/instance/CacheRedisInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var serviceName = 'ClearCache';

// API hosting
router.post('/ClearCache', function (appRequest, appResponse) {
    try {
        var objLogInfo;
        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            try {
                objLogInfo.PROCESS = 'ClearCache-Authentication';
                objLogInfo.ACTION = 'ClearCache';
                objLogInfo.HANDLER_CODE = 'Clear_WP_UserSessions';
                reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
                // Initialize local variables
                var headers = appRequest.headers;
                var params = appRequest.body.PARAMS;
                var appId = params.APP_ID;
                var clearMode = params.CACHE_TYPE;
                var selectedKeys = params.kEYS;
                var delReqKeys = []
                if (selectedKeys) {
                    for (var d = 0; d < selectedKeys.length; d++){
                        delReqKeys.push(selectedKeys[d].key)
                    }
                }
                reqCacheRedisInstance.GetRedisConnection(headers, function (pRedisClient) {
                    try {
                        if (clearMode == 'ALL') {
                            doClearCache();
                        } else if (clearMode == 'META') {
                            doClearCache('db0');
                        } else if (clearMode == 'TRAN') {
                            doClearCache('db1');
                        } else if (clearMode == 'SELECTED') {
                            doClearCache('db1', delReqKeys);
                        } else {
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, 'FAILURE', objLogInfo);
                        }
                        function doClearCache(db, selKeys) {
                            try {
                                reqCacheRedisInstance.ClearCache(headers, { db: db, clearAll: (db ? false : true), selectedKeys: selKeys }, objLogInfo, function (result) {
                                    try {
                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, result, objLogInfo);
                                    } catch (error) {
                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-10713', 'errmsg', error);
                                    }
                                });
                            } catch (error) {
                                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errcode', 'errmsg', error);
                            }
                        }
                    } catch (error) {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errcode', 'errmsg', error);
                    }
                });
            } catch (error) {
                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errcode', 'errmsg', error);
            }
        });
    } catch (error) {
        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errcode', 'errmsg', error);
    }
});

module.exports = router;
//*******End of Serive*******//