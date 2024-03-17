try {
    /****
  Descriptions - To consume SCHEDULER_REDIS_PUBSUB topic to start/stop Job in Multi node Concept
  @Last_Error_Code              : ERR-SCHEDULER-PUBSUB-0003
 ****/

    // Require dependencies
    var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
    var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
    var reqJobHelper = require('./helper/jobHelper');
    var reqSchedulerUtil = require('./util/schedulerUtil');
    var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
    var ServiceName = 'SchedulerPubsub';

    // Starting redis consumer for topic SCHEDULER_REDIS_PUBSUB
    function StartConsuming() {
        try {
            var objLogInfo = {};
            var schJobRedisKeyTTL = 5; // Need to be paramterized
            reqInstanceHelper.PrintInfo(ServiceName, 'Started consuming', objLogInfo);
            reqLogWriter.EventUpdate(objLogInfo);
            console.log('******** Going TO Subscribe a topic "SCHEDULER_REDIS_PUBSUB" in Redis **********');
            reqRedisInstance.GetRedisConnectionwithIndex(6, function (error, redisClientDB6) {
                if (error) {
                    reqInstanceHelper.PrintError(ServiceName, params.objLogInfo, 'ERR-SCHEDULER-PUBSUB-0001', 'Error while Getting Redis Connection()...', error);
                } else {
                    reqRedisInstance.GetRedisConnectionwithIndex(4, async function (error, redisClientDB4) {
                        try {
                            // redisClientDB6.subscribe('SCHEDULER_REDIS_PUBSUB', function () {
                            await redisClientDB6.subscribe('SCHEDULER_REDIS_PUBSUB', async (message) => {
                                redisClientDB6.on("error", function (err) {
                                    console.log("Error While Subscribing From the Redis " + err);
                                });
                                // redisClientDB6.on('message', (channel, message) => {
                                // if (channel !== 'SCHEDULER_REDIS_PUBSUB') {
                                //     return;
                                // }
                                if (message) {
                                    // console.log(message, '-------------');
                                    message = JSON.parse(message);
                                    message = reqInstanceHelper.ArrKeyToUpperCase([message])[0];
                                    if (message.PROCESS == 'START_JOB') {
                                        var StartJobCommonReqObj = {};
                                        StartJobCommonReqObj.req = {};
                                        StartJobCommonReqObj.req.body = message.PAYLOAD.clientParams;
                                        StartJobCommonReqObj.req.headers = message.PAYLOAD.headers;
                                        reqInstanceHelper.PrintInfo(ServiceName, 'START_JOB Message Received from the SCHEDULER_REDIS_PUBSUB Successfully...', objLogInfo);
                                        var schJobRedisKey = 'START_JOB_' + message.PAYLOAD.clientParams.job_info.job_name;
                                        var result = await redisClientDB4.set(schJobRedisKey, '', { EX: schJobRedisKeyTTL, NX: true });
                                        if (!result) {
                                            console.log('============================ Already START JOB Process Called From Another Node Service=============================');
                                            StartJobCommonReqObj.req.doDBOperations = false;
                                        } else {
                                            StartJobCommonReqObj.req.doDBOperations = true;
                                            StartJobCommonReqObj.req.scheduleTheJob = true;
                                        }
                                        // StartJobCommonReqObj.req.scheduleTheJob = true;
                                        console.log('============================ Going Calling START JOB Process =============================');
                                        reqJobHelper.StartJobCommon(StartJobCommonReqObj, function () {
                                        });

                                    } else if (message.PROCESS == 'STOP_JOB' || message.PROCESS == 'DELETE_JOB') { // Reusing Code For Stop and Delete Job
                                        var schJobRedisKey = message.PROCESS + '_' + message.PAYLOAD.jobName;
                                        var RemoveCronJobObj = {};
                                        var result = await redisClientDB4.set(schJobRedisKey, '', { EX: schJobRedisKeyTTL, NX: true });
                                        RemoveCronJobObj.doDBOperations = false;
                                        reqInstanceHelper.PrintInfo(ServiceName, 'STOP_JOB Message Received from the SCHEDULER_REDIS_PUBSUB Successfully...', objLogInfo);
                                        reqSchedulerUtil.RemoveCronJob(RemoveCronJobObj, message.PAYLOAD.jobName, message.PAYLOAD.appID);

                                    }
                                }

                            });
                        } catch (error) {
                            console.log(error)
                        }

                        const expired_subKey = '__keyevent@' + 5 + '__:expired'; // Subscribing Expired keys from the DB5 Only which is used in thread calling preocess for updating as timout error if execeeding the maximum time
                        redisClientDB6.subscribe(expired_subKey, function () {
                            redisClientDB6.on("error", function (err) {
                                console.log("Error While Subscribing " + expired_subKey + " From the Redis " + err);
                            });
                            redisClientDB6.on('message', (channel, message) => {
                                if (channel == 'SCHEDULER_REDIS_PUBSUB') {
                                    return;
                                }
                                console.log(message, '-------------');
                                // Sample Msg will be message = APP_ID + '_' + JOB_CODE + '_' + THREAD_ID + '_' + start_time;
                                if (message) {
                                    var schJobRedisKey = 'EXPIRED_REDIS_KEYS_' + message;
                                    message = message.split('_');
                                    redisClientDB4.set(schJobRedisKey, '', 'NX', 'EX', schJobRedisKeyTTL, function (error, result) {
                                        if (error || !result) {
                                            console.log('============================ Already Expired Redis Keys Event Called From Another Node Service=============================');
                                            return;
                                        } else {
                                            var objLogInfo = { doDBOperations: true };
                                            reqJobHelper.AddThreadLogVariableParameter({}, 'update', objLogInfo, '', message[1], message[2], 'No Result', message[3], new Date(), '', message[0], '', '', function (params) { });
                                        }
                                    });

                                }
                            });
                        });
                    });
                }
            });
        } catch (error) {
            reqInstanceHelper.PrintError(ServiceName, objLogInfo, 'ERR-SCHEDULER-PUBSUB-0002', 'Catch Error in startConsuming()...', error);
        }
    }

    module.exports = {
        StartConsuming: StartConsuming
    };
    /******** End of File **********/
} catch (error) {
    reqInstanceHelper.PrintError('SCHEDULER_CONSUMER', null, 'ERR-SCHEDULER-PUBSUB-0003', 'Catch Error in scheduler consumer...', error);
}