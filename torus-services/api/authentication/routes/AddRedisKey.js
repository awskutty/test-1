var reqExpress = require('express');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var InstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
const { param } = require('./GetRedis');
var router = reqExpress.Router();
var serviceName = 'addRedisKey';

router.post('/addRedisKey', function (appRequest, appResponse) {
    try {
        var params = appRequest.body.PARAMS
        var rediskey = params.REDIS_KEY
        var rvalue
        try {
            rvalue = JSON.parse(params.REDIS_VALUE)
        } catch (err) {
            rvalue = params.REDIS_VALUE
        }
        var reqParamTTL = params.TTL;
        var headers = appRequest.headers;
        var redisdb = params.REDIS_INDEX
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            try {
                reqTranDBHelper.GetTranDBConn(headers, false, function (tran_db_instance) {
                    objLogInfo.PROCESS_INFO.PROCESS_NAME = "Redis_Insert"
                    reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, function (error, prct_id) {
                        reqRedisInstance.GetRedisConnectionwithIndex(redisdb, async function (err, clientR) {
                            try {
                                if (reqParamTTL && reqParamTTL == '-1') {
                                    addRediskey(rediskey, rvalue)
                                } else {
                                    addRediswithttl(rediskey, rvalue, reqParamTTL)
                                }

                                async function addRediswithttl(rediskey, value, ttlValueFromReq) {
                                    try {
                                        if (error) {
                                            InstanceHelper.SendResponse(serviceName, appResponse, "FAILURE", objLogInfo, 'ERR-AUTH-10002', 'Error occured', error, "FAILURE")
                                        } else {
                                            var redisvalue = await reqRedisInstance.GetKeyValue(clientR, rediskey, objLogInfo);
                                            var ttlvalueFromRedis = ''
                                            var actionName = 'ADD'
                                            if (redisvalue) {
                                                ttlvalueFromRedis = await reqRedisInstance.getttl(clientR, rediskey, objLogInfo);
                                                actionName = "MODIFY"
                                            }
                                            await reqRedisInstance.RedisInsertWithTTL(clientR, rediskey, value, ttlValueFromReq)
                                            InstanceHelper.PrintInfo(serviceName, "Add a new Rediskey with TTL", objLogInfo)

                                            if (ttlvalueFromRedis == ttlValueFromReq) {
                                                ttlValueFromReq = ''
                                            }
                                            // insert into hst table
                                            reqTranDBHelper.InsertTranDB(tran_db_instance, 'hst_redis_config_mgr', [{
                                                db_index: redisdb,
                                                key_name: rediskey,
                                                old_value: redisvalue,
                                                new_value: value,
                                                created_by: sessionInfo.U_ID,
                                                created_by_name: objLogInfo.LOGIN_NAME,
                                                client_ip: objLogInfo.CLIENTIP,
                                                created_date: reqDateFormater.GetTenantCurrentDateTime(headers, objLogInfo),
                                                created_date_utc: reqDateFormater.GetCurrentDateInUTC(headers, objLogInfo),
                                                prct_id: prct_id,
                                                old_ttl_value: ttlvalueFromRedis,
                                                new_ttl_value: ttlValueFromReq,
                                                action_name: actionName
                                            }], objLogInfo, function (res, err) {
                                                if (err) {
                                                    InstanceHelper.SendResponse(serviceName, appResponse, err, objLogInfo, 'ERR-AUTH-10009', 'Exception occured', '', "FAILURE")
                                                } else {
                                                    InstanceHelper.SendResponse(serviceName, appResponse, "SUCCESS", objLogInfo, "", "", "", "SUCCESS")
                                                }
                                            })
                                        }
                                    } catch (error) {
                                        InstanceHelper.SendResponse(serviceName, appResponse, "FAILURE", objLogInfo, 'ERR-AUTH-10001', 'Exception occured', error, "FAILURE")
                                    }

                                }

                                async function addRediskey(prediskey, pvalue) {
                                    try {
                                        if (error) {
                                            InstanceHelper.SendResponse(serviceName, appResponse, "FAILURE", objLogInfo, 'ERR-AUTH-10003', 'Error occured', error, "FAILURE")
                                        } else {
                                            var redisvalue = await reqRedisInstance.GetKeyValue(clientR, prediskey, objLogInfo);
                                            var RedisTTLValue = ''
                                            var actionName = 'ADD'
                                            if (redisvalue) {
                                                actionName = 'MODIFY'
                                                RedisTTLValue = await reqRedisInstance.getttl(clientR, rediskey, objLogInfo);
                                            }
                                        }
                                        var result = await reqRedisInstance.redisInsert(clientR, prediskey, pvalue)
                                        InstanceHelper.PrintInfo(serviceName, "Add a new Rediskey", objLogInfo);
                                        if (reqParamTTL == RedisTTLValue) {
                                            reqParamTTL = ''
                                        }
                                        reqTranDBHelper.InsertTranDB(tran_db_instance, 'hst_redis_config_mgr', [{
                                            db_index: redisdb,
                                            key_name: prediskey,
                                            old_value: redisvalue,
                                            new_value: pvalue,
                                            created_by: sessionInfo.U_ID,
                                            created_by_name: objLogInfo.LOGIN_NAME,
                                            client_ip: objLogInfo.CLIENTIP,
                                            created_date: reqDateFormater.GetTenantCurrentDateTime(headers, objLogInfo),
                                            created_date_utc: reqDateFormater.GetCurrentDateInUTC(headers, objLogInfo),
                                            prct_id: prct_id,
                                            old_ttl_value: RedisTTLValue,
                                            new_ttl_value: reqParamTTL,
                                            action_name: actionName

                                        }], objLogInfo, function (res, err) {
                                            if (err) {
                                                InstanceHelper.SendResponse(serviceName, appResponse, err, objLogInfo, 'ERR-AUTH-10009', 'Exception occured', '', "FAILURE")
                                            } else {
                                                InstanceHelper.SendResponse(serviceName, appResponse, "SUCCESS", objLogInfo, "", "", "", "SUCCESS")
                                            }
                                        })
                                    }
                                    catch (error) {
                                        InstanceHelper.SendResponse(serviceName, appResponse, "FAILURE", objLogInfo, 'ERR-AUTH-10005', 'Exception occured', error, "FAILURE")
                                    }
                                }
                            } catch (error) {
                                InstanceHelper.SendResponse(serviceName, appResponse, "FAILURE", objLogInfo, 'ERR-AUTH-10002', 'Exception occured', error, "FAILURE")
                            }
                        });
                    });
                });
            } catch (error) {
                InstanceHelper.SendResponse(serviceName, appResponse, "FAILURE", objLogInfo, 'ERR-AUTH-10004', 'Exception occured', error, "FAILURE")
            }
        })
    } catch (error) {
        InstanceHelper.SendResponse(serviceName, appResponse, "FAILURE", objLogInfo, 'ERR-AUTH-10003', 'Exception occured', error, "FAILURE")
    }
})

module.exports = router