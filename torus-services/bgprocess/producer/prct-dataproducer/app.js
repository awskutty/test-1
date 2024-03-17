
/* @LAST_ERROR_CODE: ERR_PRCT_DATA_PRODUCER_APP_0001 */
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var serviceName = 'Processtokenproducer';
var reqAsync = require('async');
var logFilePath = 'bgprocess/producer/prct-dataproducer';
var objLogInfo = {};

// Include the cluster modules
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
        reqInstanceHelper.PrintWarn(serviceName, 'Worker %d died :(', worker.id, objLogInfo);
        reqCluster.fork();
    });
    // Code to run if we're in a worker process
} else {
    var reqEvents = require('events');
    var cron = require('node-cron');
    var reqAppHelper = require('../../../../torus-references/instance/AppHelper');
    var task = null;

    var objEvents = new reqEvents();
    objEvents.on('EventAfterInit', AfterInitDBListener);
    process.title = 'Torus_Bg_PrctProducer';
    // reqAppHelper.LoadAllInstanses(serviceName, function (pResult) {
    //     if (pResult == 'SUCCESS') {
    //         reqInstanceHelper.PrintInfo(serviceName, 'Instances loaded successfully.', objLogInfo);
    //         var serviceModel = (reqFXDBInstance.DBInstanceSession && reqFXDBInstance.DBInstanceSession['SERVICE_MODEL']) || null;
    //         // To set the latest platform version property in the global to access anywhere without writing extra code..
    //         if (serviceModel && serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
    //             global.isLatestPlatformVersion = true;
    //         } else {
    //             global.isLatestPlatformVersion = false;
    //         }
    //         objEvents.emit('EventAfterInit');
    //     }
    // });

    reqInstanceHelper.GetConfig('SERVICE_MODEL', function (ResSvcModel) {
        reqFXDBInstance.LoadServiceModel('SERVICE_MODEL', JSON.parse(ResSvcModel), function (res) {
            reqInstanceHelper.PrintInfo(serviceName, 'Instances loaded successfully.', null);
            var serviceModel = (reqFXDBInstance.DBInstanceSession && reqFXDBInstance.DBInstanceSession['SERVICE_MODEL']) || null;
            // To set the latest platform version property in the global to access anywhere without writing extra code..
            if (serviceModel && serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                global.isLatestPlatformVersion = true;
            } else {
                global.isLatestPlatformVersion = false;
            }
            objEvents.emit('EventAfterInit');
        });
    })

    function AfterInitDBListener() {
        try {
            var reqProducer = require('./routes/Processtokenproducer');
            var GetTenantTimezoneInfoReqObj = {
                objLogInfo: objLogInfo
            };
            reqInstanceHelper.GetTenantTimezoneInfo(GetTenantTimezoneInfoReqObj, function (GetTenantTimezoneInfoStatus) {
                if (GetTenantTimezoneInfoStatus) {

                    InittiateProducerSvc();
                } else {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_PRCT_DATA_PRODUCER_APP_0001', 'Error While Getting Timezone Informations based on Tenant', '');
                    return;
                }
            });
            // InittiateProducerSvc(); // For Development

            function InittiateProducerSvc() {
                try {
                    var GetAllUniqueTranDBKeysReqObj = {
                        objLogInfo: objLogInfo
                    };

                    reqInstanceHelper.GetAllUniqueTranDBKeys(GetAllUniqueTranDBKeysReqObj, function (error, arrRoutingKeys) {

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
                            // this is for check service running
                            var arrRoutes = [];
                            var reqPing = require('./routes/Ping');
                            arrRoutes.push(reqPing);
                            reqAppHelper.StartService(serviceName, arrRoutes, __dirname);
                        });
                    })
                } catch (error) {

                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_TRAN_DATA_PRODUCER_APP_0003', 'Catch error in InittiateProducerSvc()', error);
                }
            }

            function GetObjLogInfo() {
                try {
                    return reqLogWriter.GetLogInfo('PRCT_DATA_PRODUCER', 'PRCT_DATA_PRODUCER_PROCESS', 'PRCT_DATA_PRODUCER_ACTION', logFilePath);
                } catch (error) {
                    return {};
                }
            }


        } catch (error) {
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_PRCT_DATA_PRODUCER_APP_0000', 'Catch Error in Service Startup', error);
        }
    }
}