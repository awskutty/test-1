var reqExpress = require('express');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
const { result } = require('lodash');
const { error } = require('shelljs');
var router = reqExpress.Router();
var serviceName = 'GetRedis';

router.post('/GetRedis', function (appRequest, appResponse) {

    try {
        var params = appRequest.body.PARAMS;
        var processName = params.PROCESS_NAME
        var selectedKey = params.SELECTED_KEY
        var redisindex = params.REDIS_INDEX;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            try {
                reqInstanceHelper.PrintInfo(serviceName, 'Getting Redis Connection. index | ' + redisindex)
                reqRedisInstance.GetRedisConnectionwithIndex(redisindex, async function (error, clientR) {
                    try {
                        if (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, "FAILURE", objLogInfo, 'ERR-AUTH-100005', 'Exception occured', error, "FAILURE")
                        } else {
                            reqInstanceHelper.PrintInfo(serviceName, 'Got the redis connection.')
                            if (processName == "LOAD" && selectedKey) {
                                getRedisValue(selectedKey)
                            } else if (processName == "LOAD") {
                                getRedis()
                            }
                            async function getRedis() {
                                try {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Listing all keys ')
                                    var result = await reqRedisInstance.ListAllKeys(clientR, objLogInfo)
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, result, objLogInfo, "", "", "", "SUCCESS")
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, "FAILURE", objLogInfo, 'ERR-AUTH-100008', 'Exception occured', error, "FAILURE")
                                }

                            }

                            async function getRedisValue(pselectedKey) {
                                try {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Getting Redis value for ' + pselectedKey)
                                    var redisvalue = await reqRedisInstance.GetKeyValue(clientR, pselectedKey, objLogInfo);
                                    var redisttl = await reqRedisInstance.getttl(clientR, pselectedKey, objLogInfo);
                                    var result = {
                                        RedisValue: redisvalue,
                                        TTL: redisttl
                                    }
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, result, objLogInfo, "", "", "", "SUCCESS")

                                } catch (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, "FAILURE", objLogInfo, 'ERR-AUTH-100007', 'Exception occured', error, "FAILURE")
                                }

                            }
                        }
                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, "FAILURE", objLogInfo, 'ERR-AUTH-100001', 'Exception occured', error, "FAILURE")
                    }


                })
            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, "FAILURE", objLogInfo, 'ERR-AUTH-100002', 'Exception occured', error, "FAILURE")
            }
        })
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, "FAILURE", objLogInfo, 'ERR-AUTH-100003', 'Exception occured', error, "FAILURE")
    }
})

module.exports = router