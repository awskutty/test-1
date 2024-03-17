/* @LAST_ERROR_CODE: ERR_TRAN_DATA_PRODUCER_APP_0003 */

var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqProducer = require('./routes/Producer');
var serviceName = 'TranDataProducer';
var reqAsync = require('async');
var logFilePath = 'bgprocess/producer/tran-dataproducer';
var objLogInfo = {};
var reqCron = require('node-cron');
var reqOs = require('os');
var containerName = reqOs.hostname();
var allowMultiProducers = false;

// Include the cluster module
var reqCluster = require('cluster');
// Code to run if we're in the master process
if (!reqCluster.isMaster) {
    // Count the machine's CPUs
    var cpuCount = reqOs.cpus().length;
    // Create a worker for each CPU
    for (var i = 0; i < cpuCount; i += 1) {
        reqCluster.fork();
    }
    // Listen for dying workers
    reqCluster.on('exit', function (worker) {
        // Replace the dead worker, we're not sentimental
        reqInstanceHelper.PrintWarn(serviceName, 'Worker %d died :(', worker.id, objLogInfo);
        reqCluster.fork();
    });
    // Code to run if we're in a worker process
} else {
    var reqEvents = require('events');
    var reqAppHelper = require('../../../../torus-references/instance/AppHelper');

    var objEvents = new reqEvents();
    objEvents.on('EventAfterInit', AfterInitDBListener);
    process.title = 'Torus_Bg_TranDataProducer';
    // reqAppHelper.LoadAllInstanses(serviceName, function (pResult) {
    //     if (pResult == 'SUCCESS') {
    //         reqInstanceHelper.PrintInfo(serviceName, 'Instances loaded successfully.', objLogInfo);
    //         objEvents.emit('EventAfterInit');
    //     }
    // });

    reqInstanceHelper.GetConfig('SERVICE_MODEL', function (ResSvcModel) {
        reqDBInstance.LoadServiceModel('SERVICE_MODEL', JSON.parse(ResSvcModel), function (res) {
            reqInstanceHelper.PrintInfo(serviceName, 'Instances loaded successfully.', null);
            objEvents.emit('EventAfterInit');
        });
    })

    function AfterInitDBListener() {
        try {
            var GetTenantTimezoneInfoReqObj = {
                objLogInfo: objLogInfo
            };
            reqInstanceHelper.GetTenantTimezoneInfo(GetTenantTimezoneInfoReqObj, function (GetTenantTimezoneInfoStatus) {
                if (GetTenantTimezoneInfoStatus) {

                    // Cron Job to Check Redis Key on Every One Minute
                    var DoRedisSetnxReqObj = {
                        objLogInfo,
                        DB: 8,
                        TTL: 600,
                        KEY: 'TRAN_DATA_PRODUCER_INSTANCE_STARTED',
                        VALUE: {
                            // CONTAINER_NAME: 'containerName',
                            CONTAINER_NAME: containerName,
                            SERVICE_NAME: 'TRAN_DATA_PRODUCER'
                        }
                    };
                    var isTranDataProducerStarted = false;
                    // InittiateProducerSvc() // For Development

                    // reqCron.schedule('*/1 * * * * *', function () {
                    reqCron.schedule('*/1 * * * *', function () {
                        try {

                            // for Development
                            // if (isTranDataProducerStarted) {
                            //     return;
                            // }
                            // isTranDataProducerStarted = true;

                            var GetRedisServiceParamConfigObj = { SERVICE_NAME: serviceName };
                            reqInstanceHelper.GetRedisServiceParamConfig(GetRedisServiceParamConfigObj, function (error, serviceParams) {
                                if (error) {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Error While Getting Redis Service Param Config', objLogInfo);
                                } else {
                                    if (serviceParams && Object.keys(serviceParams).length) {
                                        if ('ALLOW_MULTIPLE_PRODUCERS' in serviceParams) {
                                            allowMultiProducers = serviceParams.ALLOW_MULTIPLE_PRODUCERS;
                                        }
                                    }
                                }
                                if (allowMultiProducers) { // Need Multiple Producers
                                    if (!isTranDataProducerStarted) { // If not Producer Svc already Started
                                        InittiateProducerSvc();
                                    }
                                } else {

                                    // Need only one producer at all. Hence applying Redis setnx Logic
                                    DoRedisSetnxReqObj.VALUE.DATE_AND_TIME = new Date().toLocaleString();
                                    if (!isTranDataProducerStarted) {
                                        DoRedisSetnxReqObj.NEED_SETNX = true;
                                    } else {
                                        DoRedisSetnxReqObj.NEED_SETNX = false;
                                    }
                                    reqInstanceHelper.DoRedisSetnx(DoRedisSetnxReqObj, function (error, setnxResult) {
                                        if (setnxResult) {
                                            // if (1) {
                                            if (!isTranDataProducerStarted) { // If not Producer Svc already Started
                                                InittiateProducerSvc();

                                            }
                                        }
                                    });
                                }
                            });



                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_TRAN_DATA_PRODUCER_APP_0002', 'Catch Error While Doing Redis Setnx Verification...', error);
                        }
                    });

                } else {
                    reqInstanceHelper.PrintError(servicePath, objLogInfo, 'ERR_TRAN_DATA_PRODUCER_APP_0001', 'Error While Getting Timezone Informations based on Tenant', '');
                    return;
                }

                function InittiateProducerSvc() {
                    try {
                        var GetTenantTimezoneInfoReqObj = {
                            objLogInfo: objLogInfo
                        };

                        reqInstanceHelper.GetAllUniqueTranDBKeys(GetTenantTimezoneInfoReqObj, function (error, arrRoutingKeys) {

                            reqAsync.forEachOfSeries(arrRoutingKeys, function (eachTranDBKey, i, nextTranDBKey) {
                                var headers = {
                                    routingkey: eachTranDBKey,
                                    LOG_INFO: JSON.stringify(GetObjLogInfo())
                                };
                                var jsonToSend = {
                                    headers: headers,
                                    SERVICE_NAME: serviceName
                                };
                                // eachTranDBKey | 'TRANDB~CLT-1304~APP-109~TNT-0~ENV-DEV'
                                reqProducer.ProduceWithTranDBKey(jsonToSend, function () {
                                    nextTranDBKey();
                                });
                            }, function () {
                                reqInstanceHelper.PrintInfo(serviceName, 'All Threads are started successfully', objLogInfo);
                                isTranDataProducerStarted = true;
                                // this is for check service running
                                var arrRoutes = [];
                                var reqPing = require('./routes/Ping');
                                arrRoutes.push(reqPing);
                                reqAppHelper.StartService(serviceName, arrRoutes, __dirname);
                            });
                        })
                    } catch (error) {

                        reqInstanceHelper.PrintError(servicePath, objLogInfo, 'ERR_TRAN_DATA_PRODUCER_APP_0003', 'Catch error in InittiateProducerSvc()', error);
                    }
                }


                function GetObjLogInfo() {
                    try {
                        return reqLogWriter.GetLogInfo('TRAN_DATA_PRODUCER', 'TRAN_DATA_PRODUCER_PROCESS', 'TRAN_DATA_PRODUCER_ACTION', logFilePath);
                    } catch (error) {
                        return {};
                    }
                }

            });
        } catch (error) {
            reqInstanceHelper.PrintError(serviceName, error, '', objLogInfo);
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_TRAN_DATA_PRODUCER_APP_0000', 'Catch Error in Service Startup', error);
        }




    }
}