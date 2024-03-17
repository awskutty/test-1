/*
@Api_Name           : /GetCacheKeys,
@Description        : To get the cache keys from cache redis
@Last_Error_Code    : ERR-AUT-10713
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqCacheRedisInstance = require('../../../../torus-references/instance/CacheRedisInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqEncryptionInstance = require('../../../../torus-references/common/crypto/EncryptionInstance');
var serviceName = 'GetCacheKeys';
// API hosting
router.post('/GetCacheKeys', function (appRequest, appResponse) {
    try {
        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            objLogInfo.PROCESS = 'ClearCache-Authentication';
            objLogInfo.ACTION = 'ClearCache';
            objLogInfo.HANDLER_CODE = 'Clear_WP_UserSessions';
            reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
            var headers = appRequest.headers;
            reqCacheRedisInstance.GetRedisConnection(headers, async function (pRedisClient) {
                // var allKeys = await pRedisClient.db1.keys('*');
                // console.log(pRedisClient)\
                if (pRedisClient) {

                    var Rkeys = await pRedisClient.db1.keys('*')
                    // pRedisClient.db1.keys('*', function (error, Rkeys) {
                    var arrRes = []

                    for (var i = 0; i < Rkeys.length; i++) {
                        var resobj = {}
                        resobj['key'] = Rkeys[i];
                        arrRes.push(resobj)
                    }
                    reqInstanceHelper.SendResponse(serviceName, appResponse, arrRes, objLogInfo, null, null, null, '', '');
                    // })
                }
            })

        })
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, "", objLogInfo, "ERR-AUTH-45000", "Exception occured ", error, '', '');
    }
})
module.exports = router