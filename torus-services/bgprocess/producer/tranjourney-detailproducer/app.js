/* @LAST_ERROR_CODE: ERR_TRAN_JOURNEY_DATA_PRODUCER_APP_0001 */

var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var servicePath = 'TRANJourneyDetailProducer';
var objLogInfo = {};
var reqCron = require('node-cron');
var reqOs = require('os');
var containerName = reqOs.hostname();

// Include the cluster module
var reqCluster = require('cluster');
// Code to run if we're in the master process
if (!reqCluster.isMaster) {
    // Count the machine's CPUs
    var cpuCount = require('os').cpus().length;
    // Create a worker for each CPU
    for (var i = 0; i < cpuCount; i += 1) {
        reqCluster.fork();
    }
    // Listen for dying workers
    reqCluster.on('exit', function (worker) {
        // Replace the dead worker, we're not sentimental
        reqInstanceHelper.PrintWarn(servicePath, 'Worker %d died :(', worker.id, objLogInfo);
        reqCluster.fork();
    });
    // Code to run if we're in a worker process
} else {
    var reqEvents = require('events');
    var reqAppHelper = require('../../../../torus-references/instance/AppHelper');


    var objEvents = new reqEvents();
    objEvents.on('EventAfterInit', AfterInitDBListener);
    process.title = 'Torus_Bg_TRANJourneyDetailProducer';
    // reqAppHelper.LoadAllInstanses(servicePath, function (pResult) {
    //     if (pResult == 'SUCCESS') {
    //         reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', objLogInfo);
    //         objEvents.emit('EventAfterInit');
    //     }
    // });

    reqInstanceHelper.GetConfig('SERVICE_MODEL', function (ResSvcModel) {
        reqDBInstance.LoadServiceModel('SERVICE_MODEL', JSON.parse(ResSvcModel), function (res) {
            reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
            objEvents.emit('EventAfterInit');
        });
    })

    function AfterInitDBListener() {
        try {

            var reqProducer = require('./routes/Producer');

            // Cron Job to Check Redis Key on Every One Minute
            var DoRedisSetnxReqObj = {
                objLogInfo,
                DB: 8,
                TTL: 600,
                KEY: 'TRAN_JOURNEY_DETAIL_PRODUCER_INSTANCE_STARTED',
                VALUE: {
                    // CONTAINER_NAME: 'containerName',
                    CONTAINER_NAME: containerName,
                    SERVICE_NAME: 'TRAN_JOURNEY_DETAIL_PRODUCER'
                }
            };
            var isTranJourneyDetailProducerStarted = false;
            reqCron.schedule('*/1 * * * * *', function () {
                // reqCron.schedule('*/1 * * * *', function () {
                try {
                    DoRedisSetnxReqObj.VALUE.DATE_AND_TIME = new Date().toLocaleString();
                    if (!isTranJourneyDetailProducerStarted) {
                        DoRedisSetnxReqObj.NEED_SETNX = true;
                    } else {
                        DoRedisSetnxReqObj.NEED_SETNX = false;
                    }
                    reqInstanceHelper.DoRedisSetnx(DoRedisSetnxReqObj, function (error, setnxResult) {
                        // if (setnxResult) {
                        if (1) {
                            if (!isTranJourneyDetailProducerStarted) {
                                var GetTenantTimezoneInfoReqObj = {
                                    objLogInfo: objLogInfo
                                };
                                reqInstanceHelper.GetTenantTimezoneInfo(GetTenantTimezoneInfoReqObj, function (GetTenantTimezoneInfoStatus) {
                                    if (GetTenantTimezoneInfoStatus) {
                                        reqAppHelper.GetPlatformVersion(null, function (GetPlatformVersionResult) {
                                            reqProducer.ProduceWithAllTranDBKeys({ SERVICE_NAME: servicePath }, function () {
                                                reqInstanceHelper.PrintInfo(servicePath, 'All Threads started successfully.', objLogInfo);
                                            });
                                        });
                                    } else {
                                        reqInstanceHelper.PrintError(servicePath, objLogInfo, 'ERR_ATMT_DATA_PRODUCER_APP_0001', 'Error While Getting Timezone Informations based on Tenant', '');
                                        return;
                                    }
                                });
                                isTranJourneyDetailProducerStarted = true;
                            }
                        }
                    });
                } catch (error) {
                    reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR_TRANJOURNEY_00014', 'Catch Error While Doing Redis Setnx Verification...', error);
                }
            });

            // this is for check service running
            var arrRoutes = [];
            var reqPing = require('./routes/Ping');
            arrRoutes.push(reqPing);
            reqAppHelper.StartService(servicePath, arrRoutes, __dirname);
        } catch (error) {
            reqInstanceHelper.PrintError(servicePath, objLogInfo, 'ERR_TRAN_JOURNEY_DATA_PRODUCER_APP_0000', 'Catch Error in Service Startup', error);
        }
    }
}